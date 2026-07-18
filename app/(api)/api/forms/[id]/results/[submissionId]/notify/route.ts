import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { invalidateSubmissionCache } from "@/lib/cache";
import { pool } from "@/lib/db";
import { isSameOriginMutation } from "@/lib/form-submission-access";
import {
    sendGradingCompletedNotification,
    sendProcessingChangedNotification,
} from "@/lib/form-notifications";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") return null;
    return session;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; submissionId: string }> },
) {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: "未授权" }, { status: 403 });
    if (!isSameOriginMutation(request)) {
        return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
    }

    const { id, submissionId } = await params;
    const body = await request.json().catch(() => null) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ error: "请求数据格式无效" }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const clientRequestId = typeof payload.clientRequestId === "string" ? payload.clientRequestId.trim() : "";
    const note = typeof payload.note === "string" ? payload.note.trim() || null : null;
    const confirmRepeat = payload.confirmRepeat === true;
    if (clientRequestId.length < 8) {
        return NextResponse.json({ error: "缺少有效的发送请求标识" }, { status: 400 });
    }

    const result = await pool.query<{
        current_revision_id: string | null;
        grading_status: string;
        processing_status: string;
    }>(
        `SELECT current_revision_id, grading_status, processing_status
         FROM form_submissions
         WHERE id = $1 AND form_id = $2`,
        [submissionId, id],
    );
    const submission = result.rows[0];
    if (!submission) return NextResponse.json({ error: "结果不存在" }, { status: 404 });
    if (!submission.current_revision_id) {
        return NextResponse.json({ error: "结果缺少当前修订信息" }, { status: 409 });
    }

    const eventType = submission.processing_status === "approved" || submission.processing_status === "rejected"
        ? "processing_changed"
        : submission.grading_status === "graded" || submission.grading_status === "auto_graded"
            ? "grading_completed"
            : null;
    if (!eventType) {
        return NextResponse.json({ error: "当前结果尚未形成可通知的批改或处理结论" }, { status: 409 });
    }

    if (!confirmRepeat) {
        const sentResult = await pool.query(
            `SELECT id
             FROM submission_notifications
             WHERE submission_id = $1
               AND revision_id = $2
               AND event_type = $3
               AND ($3 <> 'processing_changed' OR payload->>'processingStatus' = $4)
               AND status = 'sent'
             LIMIT 1`,
            [submissionId, submission.current_revision_id, eventType, submission.processing_status],
        );
        if (sentResult.rows.length > 0) {
            return NextResponse.json({
                error: "该结果已发送过同类通知，请确认后再次发送",
                code: "confirmation_required",
            }, { status: 409 });
        }
    }

    const notification = eventType === "processing_changed"
        ? await sendProcessingChangedNotification({
            submissionId,
            formId: id,
            revisionId: submission.current_revision_id,
            actorId: session.user.id,
            note,
            manual: true,
            clientRequestId,
        })
        : await sendGradingCompletedNotification({
            submissionId,
            formId: id,
            revisionId: submission.current_revision_id,
            actorId: session.user.id,
            manual: true,
            clientRequestId,
        });
    invalidateSubmissionCache({ submissionId });

    if (notification.status === "not_found") {
        return NextResponse.json({ error: notification.error }, { status: 404 });
    }
    if (notification.status === "failed") {
        return NextResponse.json({ error: "结果通知发送失败", notification }, { status: 502 });
    }
    if (notification.status === "skipped" || notification.status === "sending") {
        return NextResponse.json({ error: notification.error || "结果通知未完成", notification }, { status: 409 });
    }
    return NextResponse.json({ notification });
}
