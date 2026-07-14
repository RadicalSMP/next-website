import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { invalidateSubmissionCache } from "@/lib/cache";
import { sendFormResultNotificationEmail } from "@/lib/email";
import { normalizeFormFields, normalizeResultConfig } from "@/lib/forms";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

function readMappedValue(data: unknown, key: string | null | undefined) {
    if (!key || typeof data !== "object" || data === null || Array.isArray(data)) {
        return null;
    }
    const value = (data as Record<string, unknown>)[key];
    if (value === null || value === undefined) {
        return null;
    }
    if (Array.isArray(value)) {
        return value.join("、");
    }
    return String(value);
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
    const body = await request.json().catch(() => ({}));
    const note = typeof body.note === "string" ? body.note.trim() || null : null;

    const result = await pool.query(
        `SELECT fs.id, fs.form_id, fs.user_email, fs.data, fs.processing_status,
                fs.processing_note, fs.total_score, fs.max_score,
                f.title AS form_title,
                fv.fields, fv.result_config,
                u.email AS account_email,
                u.name AS user_name
         FROM form_submissions fs
         INNER JOIN forms f ON f.id = fs.form_id
         INNER JOIN form_versions fv ON fv.id = fs.form_version_id
         LEFT JOIN "user" u ON fs.user_id = u.id
         WHERE fs.id = $1 AND fs.form_id = $2`,
        [submissionId, id],
    );

    const submission = result.rows[0];
    if (!submission) {
        return NextResponse.json({ error: "结果不存在" }, { status: 404 });
    }

    const fields = normalizeFormFields(submission.fields);
    const resultConfig = normalizeResultConfig(submission.result_config, fields);
    if (!resultConfig.notifications.enabled || !resultConfig.notifications.template) {
        return NextResponse.json({ error: "该表单版本未启用结果通知" }, { status: 400 });
    }

    const recipient = resultConfig.notifications.recipient.source === "account_email"
        ? submission.account_email || submission.user_email
        : readMappedValue(
            submission.data,
            resultConfig.notifications.recipient.fieldKey || resultConfig.fieldMappings.email,
        );

    if (!recipient) {
        return NextResponse.json({ error: "无法解析通知收件人" }, { status: 400 });
    }

    const recipientName = readMappedValue(submission.data, resultConfig.fieldMappings.playerName)
        || submission.user_name
        || null;

    try {
        await sendFormResultNotificationEmail({
            to: recipient,
            template: resultConfig.notifications.template,
            formTitle: submission.form_title,
            recipientName,
            processingStatus: submission.processing_status,
            totalScore: submission.total_score,
            maxScore: submission.max_score,
            note: note || submission.processing_note,
        });

        await pool.query(
            `INSERT INTO submission_events
                (submission_id, form_id, event_type, action, to_status, note, score, max_score, actor_id, metadata)
             VALUES ($1, $2, 'notification', 'sent', $3, $4, $5, $6, $7, $8)`,
            [
                submissionId,
                id,
                submission.processing_status,
                note,
                submission.total_score,
                submission.max_score,
                session.user.id,
                JSON.stringify({
                    template: resultConfig.notifications.template,
                    recipientSource: resultConfig.notifications.recipient.source,
                }),
            ],
        );

        invalidateSubmissionCache();
        return NextResponse.json({ success: true });
    } catch (error) {
        await pool.query(
            `INSERT INTO submission_events
                (submission_id, form_id, event_type, action, to_status, note, score, max_score, actor_id, metadata)
             VALUES ($1, $2, 'notification', 'failed', $3, $4, $5, $6, $7, $8)`,
            [
                submissionId,
                id,
                submission.processing_status,
                note,
                submission.total_score,
                submission.max_score,
                session.user.id,
                JSON.stringify({
                    template: resultConfig.notifications.template,
                    recipientSource: resultConfig.notifications.recipient.source,
                    error: error instanceof Error ? error.message : "unknown",
                }),
            ],
        );
        invalidateSubmissionCache();
        return NextResponse.json({ error: "通知发送失败，已记录事件" }, { status: 502 });
    }
}
