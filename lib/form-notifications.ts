import { randomUUID } from "node:crypto";
import { pool } from "@/lib/db";
import {
    buildRevisionRequestedEmail,
    sendFormEmail,
} from "@/lib/email";
import {
    createSubmissionAccessToken,
    revokeRevisionAccessTokens,
} from "@/lib/form-submission-access";
import { resolveSubmissionRecipient } from "@/lib/form-submission-recipient";
import {
    normalizeFormFields,
    normalizeResultConfig,
} from "@/lib/forms";

type RevisionNotificationRow = {
    submission_id: string;
    form_id: string;
    user_id: string | null;
    user_email: string | null;
    account_email: string | null;
    data: Record<string, unknown>;
    field_snapshot: unknown;
    result_config: unknown;
    form_title: string;
    current_revision_id: string;
    request_id: string;
    edit_scope: "all" | "selected";
    editable_field_keys: string[];
    reason: string;
    request_status: string;
    expires_at: Date | null;
};

function getAppUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function buildNotificationError(error: unknown) {
    const message = error instanceof Error ? error.message : "未知邮件错误";
    return message.replace(/[\r\n]+/g, " ").slice(0, 500);
}

export async function sendRevisionRequestNotification(input: {
    submissionId: string;
    formId?: string;
    revisionRequestId: string;
    actorId: string;
    manual?: boolean;
    clientRequestId?: string | null;
}) {
    const dataResult = await pool.query<RevisionNotificationRow>(
        `SELECT fs.id AS submission_id, fs.form_id, fs.user_id, fs.user_email,
                fs.data, fs.field_snapshot, fs.current_revision_id,
                f.title AS form_title, fv.result_config,
                u.email AS account_email,
                srr.id AS request_id, srr.edit_scope, srr.editable_field_keys,
                srr.reason, srr.status AS request_status, srr.expires_at
         FROM form_submissions fs
         INNER JOIN forms f ON f.id = fs.form_id
         INNER JOIN form_versions fv ON fv.id = fs.form_version_id
         INNER JOIN submission_revision_requests srr ON srr.id = $2 AND srr.submission_id = fs.id
         LEFT JOIN "user" u ON u.id = fs.user_id
         WHERE fs.id = $1
           AND ($3::UUID IS NULL OR fs.form_id = $3)`,
        [input.submissionId, input.revisionRequestId, input.formId ?? null],
    );
    const row = dataResult.rows[0];
    if (!row) {
        return { status: "not_found" as const, error: "补交请求不存在" };
    }
    if (row.request_status !== "open") {
        return { status: "skipped" as const, error: "补交请求已结束" };
    }
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
        return { status: "skipped" as const, error: "补交请求已过期" };
    }

    const fields = normalizeFormFields(row.field_snapshot);
    const config = normalizeResultConfig(row.result_config, fields);
    const recipient = resolveSubmissionRecipient({
        userId: row.user_id,
        userEmail: row.user_email,
        accountEmail: row.account_email,
        data: row.data,
        fieldSnapshot: row.field_snapshot,
        resultConfig: row.result_config,
    });
    if (!recipient.email) {
        return { status: "skipped" as const, error: "无法解析补交通知收件人" };
    }

    const shouldAutoSend = config.notifications.enabled &&
        config.notifications.autoSend &&
        config.notifications.events.revisionRequested;
    if (!input.manual && row.user_id && !shouldAutoSend) {
        return { status: "skipped" as const, error: null };
    }

    const editableFieldLabels = row.edit_scope === "all"
        ? []
        : row.editable_field_keys.map((key) => fields.find((field) => field.key === key)?.label ?? key);
    const clientRequestId = input.clientRequestId?.trim() || randomUUID();
    const idempotencyKey = input.manual
        ? `form-notify:v1:manual:revision_requested:${row.request_id}:${clientRequestId}`
        : `form-notify:v1:auto:revision_requested:${row.request_id}`;
    const payload = {
        formTitle: row.form_title,
        reason: row.reason,
        editScope: row.edit_scope,
        editableFieldLabels,
        expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
        recipientSource: recipient.source,
        manual: Boolean(input.manual),
    };

    const client = await pool.connect();
    let notificationId: string;
    let rawAccessToken: string | null = null;
    let created = false;
    try {
        await client.query("BEGIN");
        const notificationResult = await client.query<{ id: string; status: string }>(
            `INSERT INTO submission_notifications
                (submission_id, revision_id, revision_request_id, event_type, template,
                 recipient, payload, status, idempotency_key)
             VALUES ($1, $2, $3, 'revision_requested', 'revision_requested', $4, $5, 'pending', $6)
             ON CONFLICT (idempotency_key) DO NOTHING
             RETURNING id, status`,
            [
                row.submission_id,
                row.current_revision_id,
                row.request_id,
                recipient.email,
                JSON.stringify(payload),
                idempotencyKey,
            ],
        );
        created = notificationResult.rows.length > 0;
        if (created) {
            notificationId = notificationResult.rows[0].id;
        } else {
            const existingResult = await client.query<{ id: string; status: string }>(
                `SELECT id, status FROM submission_notifications WHERE idempotency_key = $1`,
                [idempotencyKey],
            );
            const existing = existingResult.rows[0];
            await client.query("COMMIT");
            return {
                status: (existing?.status ?? "skipped") as "pending" | "sending" | "sent" | "failed" | "skipped",
                notificationId: existing?.id ?? null,
                duplicate: true,
            };
        }

        if (!row.user_id) {
            if (input.manual) {
                await revokeRevisionAccessTokens(client, row.request_id);
            }
            const expiresAt = row.expires_at
                ? new Date(row.expires_at)
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const token = await createSubmissionAccessToken(client, {
                submissionId: row.submission_id,
                revisionRequestId: row.request_id,
                scopes: ["view", "revise"],
                expiresAt,
            });
            rawAccessToken = token.token;
        }
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

    if (!created) {
        return { status: "skipped" as const, notificationId: null };
    }

    const accessUrl = row.user_id
        ? new URL(`/forms/submissions/${row.submission_id}`, getAppUrl()).toString()
        : new URL(`/forms/submissions/access?token=${encodeURIComponent(rawAccessToken ?? "")}`, getAppUrl()).toString();
    const content = buildRevisionRequestedEmail({
        formTitle: row.form_title,
        reason: row.reason,
        editableFieldLabels,
        expiresAt: row.expires_at ? new Date(row.expires_at) : null,
        accessUrl,
    });

    const claimed = await pool.query(
        `UPDATE submission_notifications
         SET status = 'sending', attempts = attempts + 1, updated_at = NOW()
         WHERE id = $1 AND status = 'pending'
         RETURNING id`,
        [notificationId!],
    );
    if (claimed.rows.length === 0) {
        return { status: "skipped" as const, notificationId: notificationId! };
    }

    try {
        const sent = await sendFormEmail({ to: recipient.email, content });
        await pool.query(
            `UPDATE submission_notifications
             SET status = 'sent', provider_message_id = $1, sent_at = NOW(),
                 last_error = NULL, updated_at = NOW()
             WHERE id = $2`,
            [sent.providerMessageId, notificationId!],
        );
        await pool.query(
            `INSERT INTO submission_events
                (submission_id, form_id, event_type, action, revision_id,
                 revision_request_id, notification_id, actor_id, metadata)
             VALUES ($1, $2, 'notification', 'sent', $3, $4, $5, $6, $7)`,
            [
                row.submission_id,
                row.form_id,
                row.current_revision_id,
                row.request_id,
                notificationId!,
                input.actorId,
                JSON.stringify({ eventType: "revision_requested", manual: Boolean(input.manual) }),
            ],
        );
        return { status: "sent" as const, notificationId: notificationId! };
    } catch (error) {
        const lastError = buildNotificationError(error);
        await pool.query(
            `UPDATE submission_notifications
             SET status = 'failed', last_error = $1, updated_at = NOW()
             WHERE id = $2`,
            [lastError, notificationId!],
        );
        await pool.query(
            `INSERT INTO submission_events
                (submission_id, form_id, event_type, action, revision_id,
                 revision_request_id, notification_id, actor_id, metadata)
             VALUES ($1, $2, 'notification', 'failed', $3, $4, $5, $6, $7)`,
            [
                row.submission_id,
                row.form_id,
                row.current_revision_id,
                row.request_id,
                notificationId!,
                input.actorId,
                JSON.stringify({ eventType: "revision_requested", manual: Boolean(input.manual), error: lastError }),
            ],
        );
        return { status: "failed" as const, notificationId: notificationId!, error: lastError };
    }
}
