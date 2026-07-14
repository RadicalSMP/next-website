import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { invalidateSubmissionCache } from "@/lib/cache";
import {
    normalizeFormFields,
    normalizeResultConfig,
    type SubmissionProcessingStatus,
} from "@/lib/forms";

type ProcessAction = "approve" | "reject" | "request_changes" | "comment";

const actionToStatus = {
    approve: "approved",
    reject: "rejected",
    request_changes: "needs_changes",
    comment: null,
} as const;

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

function isProcessAction(value: unknown): value is ProcessAction {
    return value === "approve" ||
        value === "reject" ||
        value === "request_changes" ||
        value === "comment";
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; submissionId: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { id, submissionId } = await params;
    const body = await request.json().catch(() => null) as unknown;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return NextResponse.json({ error: "请求数据格式无效" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const actionValue = payload.action;
    if (!isProcessAction(actionValue)) {
        return NextResponse.json({ error: "无效的处理动作" }, { status: 400 });
    }
    const action = actionValue;

    const note = typeof payload.note === "string" ? payload.note.trim() || null : null;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const result = await client.query(
            `SELECT fs.id, fs.form_id, fs.processing_status, fs.total_score, fs.max_score,
                    fv.fields, fv.result_config
             FROM form_submissions fs
             INNER JOIN form_versions fv ON fv.id = fs.form_version_id
             WHERE fs.id = $1 AND fs.form_id = $2
             FOR UPDATE`,
            [submissionId, id],
        );
        const submission = result.rows[0];
        if (!submission) {
            await client.query("ROLLBACK");
            return NextResponse.json({ error: "结果不存在" }, { status: 404 });
        }

        const fields = normalizeFormFields(submission.fields);
        const resultConfig = normalizeResultConfig(submission.result_config, fields);
        if (!resultConfig.processing.enabled) {
            await client.query("ROLLBACK");
            return NextResponse.json({ error: "该表单未启用结果处理状态" }, { status: 400 });
        }

        const nextStatusCandidate = actionToStatus[action] ?? submission.processing_status;
        if (
            typeof nextStatusCandidate !== "string" ||
            !resultConfig.processing.statuses.includes(nextStatusCandidate as SubmissionProcessingStatus)
        ) {
            await client.query("ROLLBACK");
            return NextResponse.json({ error: "目标处理状态不在该版本配置中" }, { status: 400 });
        }
        const nextStatus = nextStatusCandidate as SubmissionProcessingStatus;

        await client.query(
            `UPDATE form_submissions
             SET processing_status = $1,
                 processed_by = $2,
                 processed_at = NOW(),
                 processing_note = $3
             WHERE id = $4`,
            [nextStatus, session.user.id, note, submissionId],
        );

        await client.query(
            `INSERT INTO submission_events
                (submission_id, form_id, event_type, action, from_status, to_status, note, score, max_score, actor_id, metadata)
             VALUES ($1, $2, 'processing', $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                submissionId,
                id,
                action,
                submission.processing_status,
                nextStatus,
                note,
                submission.total_score,
                submission.max_score,
                session.user.id,
                JSON.stringify({ processingEnabled: true }),
            ],
        );

        await client.query("COMMIT");
        invalidateSubmissionCache();

        return NextResponse.json({ processingStatus: nextStatus });
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
