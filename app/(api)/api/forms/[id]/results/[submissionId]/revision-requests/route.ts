import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { invalidateSubmissionCache } from "@/lib/cache";
import { pool } from "@/lib/db";
import {
    createRevisionRequest,
    FormRevisionError,
} from "@/lib/form-revisions";
import { isSameOriginMutation } from "@/lib/form-submission-access";
import { resolveSubmissionRecipient } from "@/lib/form-submission-recipient";
import { sendRevisionRequestNotification } from "@/lib/form-notifications";
import type { RevisionEditScope } from "@/lib/forms";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; submissionId: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }
    if (!isSameOriginMutation(request)) {
        return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
    }

    const { id, submissionId } = await params;
    const body = await request.json().catch(() => null) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ error: "请求数据格式无效" }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const reason = typeof payload.reason === "string" ? payload.reason : "";
    const editScope = payload.editScope as RevisionEditScope;
    const editableFieldKeys = Array.isArray(payload.editableFieldKeys)
        ? payload.editableFieldKeys.filter((key): key is string => typeof key === "string")
        : [];
    const expiresAtValue = typeof payload.expiresAt === "string" ? payload.expiresAt.trim() : "";
    const expiresAt = expiresAtValue ? new Date(expiresAtValue) : null;

    const recipientResult = await pool.query<{
        user_id: string | null;
        user_email: string | null;
        account_email: string | null;
        data: Record<string, unknown>;
        field_snapshot: unknown;
        result_config: unknown;
    }>(
        `SELECT fs.user_id, fs.user_email, u.email AS account_email,
                fs.data, fs.field_snapshot, fv.result_config
         FROM form_submissions fs
         INNER JOIN form_versions fv ON fv.id = fs.form_version_id
         LEFT JOIN "user" u ON u.id = fs.user_id
         WHERE fs.id = $1 AND fs.form_id = $2`,
        [submissionId, id],
    );
    const submission = recipientResult.rows[0];
    if (!submission) {
        return NextResponse.json({ error: "提交结果不存在" }, { status: 404 });
    }
    const recipient = resolveSubmissionRecipient({
        userId: submission.user_id,
        userEmail: submission.user_email,
        accountEmail: submission.account_email,
        data: submission.data,
        fieldSnapshot: submission.field_snapshot,
        resultConfig: submission.result_config,
    });
    if (!submission.user_id && !recipient.email) {
        return NextResponse.json(
            { error: "匿名提交未提供有效邮箱，无法向填写者发起补交" },
            { status: 400 },
        );
    }

    const client = await pool.connect();
    let revisionRequest;
    try {
        await client.query("BEGIN");
        revisionRequest = await createRevisionRequest(client, {
            submissionId,
            formId: id,
            editScope,
            editableFieldKeys,
            reason,
            expiresAt,
            requestedBy: session.user.id,
        });
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        if (error instanceof FormRevisionError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }
        throw error;
    } finally {
        client.release();
    }

    let notification:
        | Awaited<ReturnType<typeof sendRevisionRequestNotification>>
        | { status: "failed"; notificationId: null; error: string };
    try {
        notification = await sendRevisionRequestNotification({
            submissionId,
            formId: id,
            revisionRequestId: revisionRequest.id,
            actorId: session.user.id,
        });
    } catch (error) {
        notification = {
            status: "failed",
            notificationId: null,
            error: error instanceof Error ? error.message : "创建补交通知失败",
        };
    }
    invalidateSubmissionCache({
        submissionId,
        userId: submission.user_id,
    });
    return NextResponse.json({
        request: revisionRequest,
        recipient: {
            email: recipient.email,
            source: recipient.source,
        },
        notification,
    }, { status: 201 });
}
