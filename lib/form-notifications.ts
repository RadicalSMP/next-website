import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import {
    buildGradingCompletedEmail,
    buildProcessingResultEmail,
    buildRevisionRequestedEmail,
    sendFormEmail,
    type FormEmailContent,
    type GradingEmailItem,
} from "@/lib/email";
import { createSubmissionAccessToken } from "@/lib/form-submission-access";
import { resolveSubmissionRecipient } from "@/lib/form-submission-recipient";
import {
    normalizeFormFields,
    normalizeResultConfig,
    type SubmissionNotificationEvent,
    type SubmissionNotificationStatus,
} from "@/lib/forms";

type NotificationMode = "auto" | "manual";
type NotificationTransport = typeof sendFormEmail;

type NotificationContextRow = {
    submission_id: string;
    form_id: string;
    user_id: string | null;
    user_email: string | null;
    account_email: string | null;
    user_name: string | null;
    data: Record<string, unknown>;
    field_snapshot: unknown;
    result_config: unknown;
    form_title: string;
    current_revision_id: string;
    grading_status: string;
    processing_status: string;
    processing_note: string | null;
    total_score: string | number | null;
    max_score: string | number | null;
};

type NotificationRow = {
    id: string;
    submission_id: string;
    form_id: string;
    revision_id: string | null;
    revision_request_id: string | null;
    event_type: SubmissionNotificationEvent;
    template: string;
    recipient: string;
    payload: Record<string, unknown>;
    status: SubmissionNotificationStatus;
    attempts: number;
    idempotency_key: string;
};

type DeliveryResult = {
    status: SubmissionNotificationStatus | "skipped";
    notificationId: string;
    duplicate?: boolean;
    error?: string | null;
};

const STALE_SENDING_INTERVAL = "10 minutes";

function getAppUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function buildNotificationError(error: unknown) {
    const message = error instanceof Error ? error.message : "未知邮件错误";
    return message.replace(/[\r\n]+/g, " ").slice(0, 500);
}

function readTextValue(data: Record<string, unknown>, key: string | null) {
    if (!key) return null;
    const value = data[key];
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return value.join("、");
    return String(value);
}

async function loadNotificationContext(submissionId: string, formId?: string) {
    const result = await pool.query<NotificationContextRow>(
        `SELECT fs.id AS submission_id, fs.form_id, fs.user_id, fs.user_email,
                fs.data, fs.field_snapshot, fs.current_revision_id,
                fs.grading_status, fs.processing_status, fs.processing_note,
                fs.total_score, fs.max_score,
                f.title AS form_title, fv.result_config,
                u.email AS account_email, u.name AS user_name
         FROM form_submissions fs
         INNER JOIN forms f ON f.id = fs.form_id
         INNER JOIN form_versions fv ON fv.id = fs.form_version_id
         LEFT JOIN "user" u ON u.id = fs.user_id
         WHERE fs.id = $1
           AND ($2::UUID IS NULL OR fs.form_id = $2)`,
        [submissionId, formId ?? null],
    );
    return result.rows[0] ?? null;
}

function resolveContextRecipient(row: NotificationContextRow) {
    return resolveSubmissionRecipient({
        userId: row.user_id,
        userEmail: row.user_email,
        accountEmail: row.account_email,
        data: row.data,
        fieldSnapshot: row.field_snapshot,
        resultConfig: row.result_config,
    });
}

async function createNotification(input: {
    context: NotificationContextRow;
    revisionId: string | null;
    revisionRequestId: string | null;
    eventType: SubmissionNotificationEvent;
    template: string;
    recipient: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
}) {
    const result = await pool.query<{ id: string; status: SubmissionNotificationStatus }>(
        `INSERT INTO submission_notifications
            (submission_id, revision_id, revision_request_id, event_type, template,
             recipient, payload, status, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id, status`,
        [
            input.context.submission_id,
            input.revisionId,
            input.revisionRequestId,
            input.eventType,
            input.template,
            input.recipient,
            JSON.stringify(input.payload),
            input.idempotencyKey,
        ],
    );
    if (result.rows[0]) {
        return { ...result.rows[0], duplicate: false };
    }
    const existing = await pool.query<{ id: string; status: SubmissionNotificationStatus }>(
        `SELECT id, status FROM submission_notifications WHERE idempotency_key = $1`,
        [input.idempotencyKey],
    );
    return existing.rows[0] ? { ...existing.rows[0], duplicate: true } : null;
}

async function loadNotification(notificationId: string, submissionId?: string, formId?: string) {
    const result = await pool.query<NotificationRow>(
        `SELECT sn.*, fs.form_id
         FROM submission_notifications sn
         INNER JOIN form_submissions fs ON fs.id = sn.submission_id
         WHERE sn.id = $1
           AND ($2::UUID IS NULL OR sn.submission_id = $2)
           AND ($3::UUID IS NULL OR fs.form_id = $3)`,
        [notificationId, submissionId ?? null, formId ?? null],
    );
    return result.rows[0] ?? null;
}

async function createAccessUrl(row: NotificationRow, context: NotificationContextRow) {
    if (context.user_id) {
        return {
            url: new URL(`/forms/submissions/${row.submission_id}`, getAppUrl()).toString(),
            tokenId: null,
        };
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const isRevisionRequest = row.event_type === "revision_requested";
        let expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        if (isRevisionRequest && row.revision_request_id) {
            const requestResult = await client.query<{ status: string; expires_at: Date | null }>(
                `SELECT status, expires_at
                 FROM submission_revision_requests
                 WHERE id = $1 AND submission_id = $2
                 FOR UPDATE`,
                [row.revision_request_id, row.submission_id],
            );
            const request = requestResult.rows[0];
            if (!request || request.status !== "open") throw new Error("补交请求已结束");
            if (request.expires_at) expiresAt = new Date(request.expires_at);
            if (expiresAt.getTime() <= Date.now()) throw new Error("补交请求已过期");
        }
        const token = await createSubmissionAccessToken(client, {
            submissionId: row.submission_id,
            revisionRequestId: isRevisionRequest ? row.revision_request_id : null,
            scopes: isRevisionRequest ? ["view", "revise"] : ["view"],
            expiresAt,
        });
        await client.query("COMMIT");
        return {
            url: new URL(`/forms/submissions/access?token=${encodeURIComponent(token.token)}`, getAppUrl()).toString(),
            tokenId: token.id,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function revokeUnusedAccessToken(tokenId: string | null) {
    if (!tokenId) return;
    await pool.query(
        `UPDATE submission_access_tokens
         SET revoked_at = COALESCE(revoked_at, NOW())
         WHERE id = $1`,
        [tokenId],
    );
}

async function buildNotificationContent(
    row: NotificationRow,
    context: NotificationContextRow,
    resultUrl: string,
): Promise<FormEmailContent> {
    const fields = normalizeFormFields(context.field_snapshot);
    const config = normalizeResultConfig(context.result_config, fields);
    const recipientName = readTextValue(context.data, config.fieldMappings.playerName) || context.user_name;

    if (row.event_type === "revision_requested") {
        const requestResult = await pool.query<{
            reason: string;
            edit_scope: "all" | "selected";
            editable_field_keys: string[];
            expires_at: Date | null;
            status: string;
        }>(
            `SELECT reason, edit_scope, editable_field_keys, expires_at, status
             FROM submission_revision_requests
             WHERE id = $1 AND submission_id = $2`,
            [row.revision_request_id, row.submission_id],
        );
        const request = requestResult.rows[0];
        if (!request || request.status !== "open") throw new Error("补交请求已结束");
        const editableFieldLabels = request.edit_scope === "all"
            ? []
            : request.editable_field_keys.map((key) => fields.find((field) => field.key === key)?.label ?? key);
        return buildRevisionRequestedEmail({
            formTitle: context.form_title,
            reason: request.reason,
            editableFieldLabels,
            expiresAt: request.expires_at ? new Date(request.expires_at) : null,
            accessUrl: resultUrl,
        });
    }

    const template = row.template as "join_application_result" | "score_result" | "generic_result";
    if (row.event_type === "grading_completed") {
        const gradeResult = await pool.query<{
            field_label: string;
            score: string | number | null;
            max_score: string | number;
            comment: string | null;
            expected_answer: unknown;
        }>(
            `SELECT field_label, score, max_score, comment, expected_answer
             FROM submission_grades
             WHERE submission_id = $1 AND revision_id = $2
             ORDER BY created_at`,
            [row.submission_id, row.revision_id],
        );
        const items: GradingEmailItem[] = gradeResult.rows.map((grade) => ({
            label: grade.field_label,
            score: grade.score,
            maxScore: grade.max_score,
            comment: grade.comment,
            correctAnswer: config.notifications.content.includeCorrectAnswers
                ? grade.expected_answer
                : undefined,
        }));
        return buildGradingCompletedEmail({
            template,
            formTitle: context.form_title,
            recipientName,
            totalScore: row.payload.totalScore as string | number | null,
            maxScore: row.payload.maxScore as string | number | null,
            items,
            includeQuestionScores: config.notifications.content.includeQuestionScores,
            includeComments: config.notifications.content.includeComments,
            includeCorrectAnswers: config.notifications.content.includeCorrectAnswers,
            resultUrl,
        });
    }

    const processingStatus = row.payload.processingStatus;
    if (processingStatus !== "approved" && processingStatus !== "rejected") {
        throw new Error("处理状态不支持结果通知");
    }
    return buildProcessingResultEmail({
        template,
        formTitle: context.form_title,
        recipientName,
        processingStatus,
        note: typeof row.payload.note === "string" ? row.payload.note : null,
        resultUrl,
    });
}

async function writeDeliveryEvent(client: PoolClient, input: {
    row: NotificationRow;
    actorId: string;
    action: "sent" | "failed";
    error?: string;
    retry: boolean;
}) {
    await client.query(
        `INSERT INTO submission_events
            (submission_id, form_id, event_type, action, revision_id,
             revision_request_id, notification_id, actor_id, metadata)
         VALUES ($1, $2, 'notification', $3, $4, $5, $6, $7, $8)`,
        [
            input.row.submission_id,
            input.row.form_id,
            input.action,
            input.row.revision_id,
            input.row.revision_request_id,
            input.row.id,
            input.actorId,
            JSON.stringify({
                eventType: input.row.event_type,
                retry: input.retry,
                ...(input.error ? { error: input.error } : {}),
            }),
        ],
    );
}

async function finalizeRevisionToken(client: PoolClient, row: NotificationRow, tokenId: string | null) {
    if (row.event_type !== "revision_requested" || !row.revision_request_id || !tokenId) return;
    await client.query(
        `UPDATE submission_access_tokens
         SET scopes = CASE
                 WHEN scopes @> ARRAY['view']::TEXT[] THEN ARRAY_REMOVE(scopes, 'revise')
                 ELSE scopes
             END,
             revoked_at = CASE
                 WHEN scopes @> ARRAY['view']::TEXT[] THEN revoked_at
                 ELSE NOW()
             END
         WHERE revision_request_id = $1
           AND id <> $2
           AND scopes @> ARRAY['revise']::TEXT[]
           AND revoked_at IS NULL`,
        [row.revision_request_id, tokenId],
    );
}

async function markDeliveryFailed(row: NotificationRow, actorId: string, error: unknown, retry: boolean) {
    const lastError = buildNotificationError(error);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `UPDATE submission_notifications
             SET status = 'failed', last_error = $1, updated_at = NOW()
             WHERE id = $2 AND status = 'sending'`,
            [lastError, row.id],
        );
        await writeDeliveryEvent(client, { row, actorId, action: "failed", error: lastError, retry });
        await client.query("COMMIT");
    } catch (databaseError) {
        await client.query("ROLLBACK");
        throw databaseError;
    } finally {
        client.release();
    }
    return { status: "failed" as const, notificationId: row.id, error: lastError };
}

async function deliverNotification(
    notificationId: string,
    actorId: string,
    retry: boolean,
    transport: NotificationTransport = sendFormEmail,
): Promise<DeliveryResult> {
    const claim = await pool.query<{ attempts: number }>(
        retry
            ? `UPDATE submission_notifications
               SET status = 'sending', attempts = attempts + 1, last_error = NULL, updated_at = NOW()
               WHERE id = $1
                 AND (status = 'failed' OR (status = 'sending' AND updated_at < NOW() - $2::INTERVAL))
               RETURNING attempts`
            : `UPDATE submission_notifications
               SET status = 'sending', attempts = attempts + 1, last_error = NULL, updated_at = NOW()
               WHERE id = $1 AND status = 'pending'
               RETURNING attempts`,
        retry ? [notificationId, STALE_SENDING_INTERVAL] : [notificationId],
    );
    if (!claim.rows[0]) {
        const existing = await loadNotification(notificationId);
        return {
            status: existing?.status ?? "skipped",
            notificationId,
            error: existing ? "通知当前状态不允许发送" : "通知不存在",
        };
    }

    const row = await loadNotification(notificationId);
    if (!row) return { status: "skipped", notificationId, error: "通知不存在" };
    const context = await loadNotificationContext(row.submission_id, row.form_id);
    if (!context) return markDeliveryFailed(row, actorId, new Error("提交结果不存在"), retry);

    let access: { url: string; tokenId: string | null } | null = null;
    let content: FormEmailContent;
    try {
        access = await createAccessUrl(row, context);
        content = await buildNotificationContent(row, context, access.url);
    } catch (error) {
        await revokeUnusedAccessToken(access?.tokenId ?? null);
        return markDeliveryFailed(row, actorId, error, retry);
    }

    let providerMessageId: string;
    try {
        const sent = await transport({
            to: row.recipient,
            content,
            idempotencyKey: row.idempotency_key,
        });
        providerMessageId = sent.providerMessageId;
    } catch (error) {
        await revokeUnusedAccessToken(access.tokenId);
        return markDeliveryFailed(row, actorId, error, retry);
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `UPDATE submission_notifications
             SET status = 'sent', provider_message_id = $1, sent_at = NOW(),
                 last_error = NULL, updated_at = NOW()
             WHERE id = $2 AND status = 'sending'`,
            [providerMessageId, row.id],
        );
        await finalizeRevisionToken(client, row, access.tokenId);
        await writeDeliveryEvent(client, { row, actorId, action: "sent", retry });
        await client.query("COMMIT");
        return { status: "sent", notificationId: row.id };
    } catch (error) {
        await client.query("ROLLBACK");
        return {
            status: "sending",
            notificationId: row.id,
            error: `邮件已提交，但状态确认失败：${buildNotificationError(error)}`,
        };
    } finally {
        client.release();
    }
}

function getEventEnabled(config: ReturnType<typeof normalizeResultConfig>, eventType: SubmissionNotificationEvent) {
    if (eventType === "revision_requested") return config.notifications.events.revisionRequested;
    if (eventType === "grading_completed") return config.notifications.events.gradingCompleted;
    return config.notifications.events.processingChanged;
}

async function dispatchResultNotification(input: {
    submissionId: string;
    formId?: string;
    revisionId: string;
    eventType: "grading_completed" | "processing_changed";
    actorId: string;
    mode: NotificationMode;
    clientRequestId?: string | null;
    processingEventId?: string | null;
    note?: string | null;
    transport?: NotificationTransport;
}) {
    const context = await loadNotificationContext(input.submissionId, input.formId);
    if (!context) return { status: "not_found" as const, error: "提交结果不存在" };
    if (context.current_revision_id !== input.revisionId) {
        return { status: "skipped" as const, error: "通知修订已不是当前修订" };
    }
    if (
        input.eventType === "grading_completed" &&
        context.grading_status !== "graded" &&
        context.grading_status !== "auto_graded"
    ) {
        return { status: "skipped" as const, error: "当前修订尚未完成批改" };
    }
    if (
        input.eventType === "processing_changed" &&
        context.processing_status !== "approved" &&
        context.processing_status !== "rejected"
    ) {
        return { status: "skipped" as const, error: "当前处理状态不支持结果通知" };
    }
    if (input.eventType === "processing_changed" && input.mode === "auto" && !input.processingEventId) {
        return { status: "skipped" as const, error: "自动处理通知缺少处理事件" };
    }
    const fields = normalizeFormFields(context.field_snapshot);
    const config = normalizeResultConfig(context.result_config, fields);
    if (!config.notifications.enabled || !config.notifications.template) {
        return { status: "skipped" as const, error: "该表单版本未启用结果通知" };
    }
    if (input.mode === "auto" && (!config.notifications.autoSend || !getEventEnabled(config, input.eventType))) {
        return { status: "skipped" as const, error: null };
    }
    const recipient = resolveContextRecipient(context);
    if (!recipient.email) return { status: "skipped" as const, error: "无法解析通知收件人" };

    const payload: Record<string, unknown> = {
        recipientSource: recipient.source,
        mode: input.mode,
        totalScore: context.total_score,
        maxScore: context.max_score,
    };
    let idempotencyKey: string;
    if (input.eventType === "grading_completed") {
        idempotencyKey = input.mode === "auto"
            ? `form-notify:v1:auto:grading_completed:rev:${input.revisionId}`
            : `form-notify:v1:manual:grading_completed:${input.submissionId}:${input.revisionId}:${input.clientRequestId?.trim() || randomUUID()}`;
    } else {
        payload.processingStatus = context.processing_status;
        payload.note = input.note ?? context.processing_note;
        if (input.processingEventId) payload.processingEventId = input.processingEventId;
        idempotencyKey = input.mode === "auto"
            ? `form-notify:v1:auto:processing_changed:event:${input.processingEventId}`
            : `form-notify:v1:manual:processing_changed:${input.submissionId}:${input.revisionId}:${input.clientRequestId?.trim() || randomUUID()}`;
    }

    const notification = await createNotification({
        context,
        revisionId: input.revisionId,
        revisionRequestId: null,
        eventType: input.eventType,
        template: config.notifications.template,
        recipient: recipient.email,
        payload,
        idempotencyKey,
    });
    if (!notification) return { status: "failed" as const, notificationId: null, error: "创建通知记录失败" };
    if (notification.duplicate) {
        return {
            status: notification.status,
            notificationId: notification.id,
            duplicate: true,
        };
    }
    return deliverNotification(notification.id, input.actorId, false, input.transport);
}

export async function sendRevisionRequestNotification(input: {
    submissionId: string;
    formId?: string;
    revisionRequestId: string;
    actorId: string;
    manual?: boolean;
    clientRequestId?: string | null;
    transport?: NotificationTransport;
}) {
    const context = await loadNotificationContext(input.submissionId, input.formId);
    if (!context) return { status: "not_found" as const, error: "补交请求不存在" };
    const requestResult = await pool.query<{ id: string; status: string; expires_at: Date | null }>(
        `SELECT id, status, expires_at
         FROM submission_revision_requests
         WHERE id = $1 AND submission_id = $2`,
        [input.revisionRequestId, input.submissionId],
    );
    const request = requestResult.rows[0];
    if (!request) return { status: "not_found" as const, error: "补交请求不存在" };
    if (request.status !== "open") return { status: "skipped" as const, error: "补交请求已结束" };
    if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) {
        return { status: "skipped" as const, error: "补交请求已过期" };
    }

    const fields = normalizeFormFields(context.field_snapshot);
    const config = normalizeResultConfig(context.result_config, fields);
    const recipient = resolveContextRecipient(context);
    if (!recipient.email) return { status: "skipped" as const, error: "无法解析补交通知收件人" };
    const mode: NotificationMode = input.manual ? "manual" : "auto";
    const shouldAutoSend = config.notifications.enabled &&
        config.notifications.autoSend &&
        config.notifications.events.revisionRequested;
    if (mode === "auto" && context.user_id && !shouldAutoSend) {
        return { status: "skipped" as const, error: null };
    }

    const idempotencyKey = mode === "auto"
        ? `form-notify:v1:auto:revision_requested:req:${request.id}`
        : `form-notify:v1:manual:revision_requested:${request.id}:${input.clientRequestId?.trim() || randomUUID()}`;
    const notification = await createNotification({
        context,
        revisionId: context.current_revision_id,
        revisionRequestId: request.id,
        eventType: "revision_requested",
        template: "revision_requested",
        recipient: recipient.email,
        payload: { recipientSource: recipient.source, mode },
        idempotencyKey,
    });
    if (!notification) return { status: "failed" as const, notificationId: null, error: "创建通知记录失败" };
    if (notification.duplicate) {
        return { status: notification.status, notificationId: notification.id, duplicate: true };
    }
    return deliverNotification(notification.id, input.actorId, false, input.transport);
}

export function sendGradingCompletedNotification(input: {
    submissionId: string;
    formId?: string;
    revisionId: string;
    actorId: string;
    manual?: boolean;
    clientRequestId?: string | null;
    transport?: NotificationTransport;
}) {
    return dispatchResultNotification({
        ...input,
        eventType: "grading_completed",
        mode: input.manual ? "manual" : "auto",
    });
}

export function sendProcessingChangedNotification(input: {
    submissionId: string;
    formId?: string;
    revisionId: string;
    processingEventId?: string | null;
    actorId: string;
    note?: string | null;
    manual?: boolean;
    clientRequestId?: string | null;
    transport?: NotificationTransport;
}) {
    return dispatchResultNotification({
        ...input,
        eventType: "processing_changed",
        mode: input.manual ? "manual" : "auto",
    });
}

export async function retrySubmissionNotification(input: {
    submissionId: string;
    formId?: string;
    notificationId: string;
    actorId: string;
    transport?: NotificationTransport;
}) {
    const row = await loadNotification(input.notificationId, input.submissionId, input.formId);
    if (!row) return { status: "not_found" as const, error: "通知记录不存在" };
    if (row.status !== "failed" && row.status !== "sending") {
        return { status: "skipped" as const, notificationId: row.id, error: "只有失败或超时的通知可以重试" };
    }
    if (row.event_type !== "revision_requested") {
        const context = await loadNotificationContext(row.submission_id, row.form_id);
        if (!context || context.current_revision_id !== row.revision_id) {
            return { status: "skipped" as const, notificationId: row.id, error: "通知对应的修订已不是当前修订" };
        }
    }
    return deliverNotification(row.id, input.actorId, true, input.transport);
}
