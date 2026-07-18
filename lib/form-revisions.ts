import type { PoolClient } from "pg";
import {
    buildSubmissionGradeResult,
    normalizeFormFields,
    normalizeResultConfig,
    validateSubmissionValues,
    type FormField,
    type FormSubmissionRevision,
    type RevisionEditScope,
    type SubmissionRevisionRequest,
    type SubmissionRevisionSource,
} from "@/lib/forms";
import {
    consumeRevisionAccessTokens,
    revokeRevisionAccessTokens,
} from "@/lib/form-submission-access";

export class FormRevisionError extends Error {
    constructor(
        message: string,
        public readonly status: 400 | 403 | 404 | 409 | 410,
        public readonly code: string,
    ) {
        super(message);
        this.name = "FormRevisionError";
    }
}

type RevisionRow = {
    id: string;
    submission_id: string;
    revision_number: number;
    source_request_id: string | null;
    data: Record<string, unknown>;
    field_snapshot: unknown;
    submitted_by: string | null;
    submitted_via: SubmissionRevisionSource;
    ip_address: string | null;
    user_agent: string | null;
    fingerprint: string | null;
    duration: number | null;
    created_at: Date;
};

type RevisionRequestRow = {
    id: string;
    submission_id: string;
    base_revision_id: string;
    edit_scope: RevisionEditScope;
    editable_field_keys: string[];
    reason: string;
    status: "open" | "fulfilled" | "cancelled" | "expired";
    expires_at: Date | null;
    requested_by: string;
    fulfilled_revision_id: string | null;
    created_at: Date;
    fulfilled_at: Date | null;
    cancelled_at: Date | null;
};

function mapRevision(row: RevisionRow): FormSubmissionRevision {
    return {
        id: row.id,
        submissionId: row.submission_id,
        revisionNumber: row.revision_number,
        sourceRequestId: row.source_request_id,
        data: row.data,
        fieldSnapshot: normalizeFormFields(row.field_snapshot),
        submittedBy: row.submitted_by,
        submittedVia: row.submitted_via,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        fingerprint: row.fingerprint,
        duration: row.duration,
        createdAt: new Date(row.created_at).toISOString(),
    };
}

function mapRevisionRequest(row: RevisionRequestRow): SubmissionRevisionRequest {
    return {
        id: row.id,
        submissionId: row.submission_id,
        baseRevisionId: row.base_revision_id,
        editScope: row.edit_scope,
        editableFieldKeys: row.editable_field_keys,
        reason: row.reason,
        status: row.status,
        expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
        requestedBy: row.requested_by,
        fulfilledRevisionId: row.fulfilled_revision_id,
        createdAt: new Date(row.created_at).toISOString(),
        fulfilledAt: row.fulfilled_at ? new Date(row.fulfilled_at).toISOString() : null,
        cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : null,
    };
}

export async function getCurrentRevision(
    client: PoolClient,
    submissionId: string,
    options: { forUpdate?: boolean } = {},
) {
    const result = await client.query<RevisionRow>(
        `SELECT r.*
         FROM form_submissions fs
         INNER JOIN form_submission_revisions r ON r.id = fs.current_revision_id
         WHERE fs.id = $1
         ${options.forUpdate ? "FOR UPDATE OF r" : ""}`,
        [submissionId],
    );
    return result.rows[0] ? mapRevision(result.rows[0]) : null;
}

export async function getRevisionHistory(client: PoolClient, submissionId: string) {
    const result = await client.query<RevisionRow>(
        `SELECT *
         FROM form_submission_revisions
         WHERE submission_id = $1
         ORDER BY revision_number DESC`,
        [submissionId],
    );
    return result.rows.map(mapRevision);
}

function normalizeComparableAnswer(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(normalizeComparableAnswer).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, normalizeComparableAnswer(item)]),
        );
    }
    return value ?? null;
}

function answersEqual(left: unknown, right: unknown) {
    return JSON.stringify(normalizeComparableAnswer(left)) === JSON.stringify(normalizeComparableAnswer(right));
}

export function compareRevisions(
    before: Pick<FormSubmissionRevision, "data" | "fieldSnapshot">,
    after: Pick<FormSubmissionRevision, "data" | "fieldSnapshot">,
) {
    const fieldMap = new Map<string, FormField>();
    for (const field of [...before.fieldSnapshot, ...after.fieldSnapshot]) {
        fieldMap.set(field.key, field);
    }
    const keys = Array.from(new Set([...Object.keys(before.data), ...Object.keys(after.data)]));

    return keys.map((fieldKey) => {
        const previousValue = before.data[fieldKey] ?? null;
        const nextValue = after.data[fieldKey] ?? null;
        return {
            fieldKey,
            fieldLabel: fieldMap.get(fieldKey)?.label ?? fieldKey,
            previousValue,
            nextValue,
            changed: !answersEqual(previousValue, nextValue),
        };
    });
}

async function expireOpenRequest(
    client: PoolClient,
    input: {
        request: RevisionRequestRow;
        formId: string;
        currentRevisionId: string;
        currentProcessingStatus: string;
    },
) {
    await client.query(
        `UPDATE submission_revision_requests
         SET status = 'expired'
         WHERE id = $1 AND status = 'open'`,
        [input.request.id],
    );
    await revokeRevisionAccessTokens(client, input.request.id);
    await client.query(
        `UPDATE form_submissions
         SET active_revision_request_id = NULL,
             revision_status = CASE WHEN revision_count > 1 THEN 'resubmitted' ELSE 'none' END,
             processing_status = CASE WHEN processing_status = 'needs_changes' THEN 'pending' ELSE processing_status END
         WHERE id = $1 AND active_revision_request_id = $2`,
        [input.request.submission_id, input.request.id],
    );
    await client.query(
        `INSERT INTO submission_events
            (submission_id, form_id, event_type, action, revision_id, revision_request_id,
             from_status, to_status, note, actor_id, metadata)
         VALUES ($1, $2, 'revision', 'request_expired', $3, $4, $5, 'pending', $6, NULL, $7)`,
        [
            input.request.submission_id,
            input.formId,
            input.currentRevisionId,
            input.request.id,
            input.currentProcessingStatus,
            input.request.reason,
            JSON.stringify({ editScope: input.request.edit_scope }),
        ],
    );
}

export async function createRevisionRequest(
    client: PoolClient,
    input: {
        submissionId: string;
        formId?: string;
        editScope: RevisionEditScope;
        editableFieldKeys?: string[];
        reason: string;
        expiresAt?: Date | null;
        requestedBy: string;
    },
) {
    const reason = input.reason.trim();
    if (!reason) {
        throw new FormRevisionError("请填写需要补充的原因", 400, "reason_required");
    }
    if (input.editScope !== "all" && input.editScope !== "selected") {
        throw new FormRevisionError("无效的字段修改范围", 400, "edit_scope_invalid");
    }
    if (
        input.expiresAt &&
        (!Number.isFinite(input.expiresAt.getTime()) || input.expiresAt.getTime() <= Date.now())
    ) {
        throw new FormRevisionError("截止时间必须晚于当前时间", 400, "invalid_expiry");
    }

    const submissionResult = await client.query<{
        id: string;
        form_id: string;
        current_revision_id: string | null;
        active_revision_request_id: string | null;
        revision_count: number;
        processing_status: string;
        field_snapshot: unknown;
        result_config: unknown;
    }>(
        `SELECT fs.id, fs.form_id, fs.current_revision_id, fs.active_revision_request_id,
                fs.revision_count, fs.processing_status, fs.field_snapshot, fv.result_config
         FROM form_submissions fs
         INNER JOIN form_versions fv ON fv.id = fs.form_version_id
         WHERE fs.id = $1
         FOR UPDATE OF fs`,
        [input.submissionId],
    );
    const submission = submissionResult.rows[0];
    if (!submission || (input.formId && submission.form_id !== input.formId)) {
        throw new FormRevisionError("提交结果不存在", 404, "submission_not_found");
    }
    if (!submission.current_revision_id) {
        throw new FormRevisionError("提交结果缺少当前修订", 409, "current_revision_missing");
    }

    const fields = normalizeFormFields(submission.field_snapshot);
    const resultConfig = normalizeResultConfig(submission.result_config, fields);
    if (
        !resultConfig.processing.enabled ||
        !resultConfig.processing.statuses.includes("needs_changes") ||
        !resultConfig.processing.statuses.includes("pending")
    ) {
        throw new FormRevisionError("该表单版本未启用补交所需的处理状态", 400, "revision_processing_disabled");
    }

    const openRequestResult = await client.query<RevisionRequestRow>(
        `SELECT * FROM submission_revision_requests
         WHERE submission_id = $1 AND status = 'open'
         FOR UPDATE`,
        [input.submissionId],
    );
    const openRequest = openRequestResult.rows[0];
    if (openRequest) {
        if (openRequest.expires_at && new Date(openRequest.expires_at).getTime() <= Date.now()) {
            await expireOpenRequest(client, {
                request: openRequest,
                formId: submission.form_id,
                currentRevisionId: submission.current_revision_id,
                currentProcessingStatus: submission.processing_status,
            });
        } else {
            throw new FormRevisionError("该提交已有待处理的补交请求", 409, "revision_request_exists");
        }
    }

    const enabledKeys = new Set(fields.filter((field) => field.enabled).map((field) => field.key));
    const editableFieldKeys = Array.from(new Set(input.editableFieldKeys ?? []));
    if (input.editScope === "selected") {
        if (editableFieldKeys.length === 0) {
            throw new FormRevisionError("指定字段模式至少需要选择一个字段", 400, "editable_fields_required");
        }
        const invalidKey = editableFieldKeys.find((key) => !enabledKeys.has(key));
        if (invalidKey) {
            throw new FormRevisionError(`字段「${invalidKey}」不存在或不可填写`, 400, "editable_field_invalid");
        }
    }

    const requestResult = await client.query<RevisionRequestRow>(
        `INSERT INTO submission_revision_requests
            (submission_id, base_revision_id, edit_scope, editable_field_keys,
             reason, expires_at, requested_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
            input.submissionId,
            submission.current_revision_id,
            input.editScope,
            input.editScope === "selected" ? editableFieldKeys : [],
            reason,
            input.expiresAt ?? null,
            input.requestedBy,
        ],
    );
    const request = requestResult.rows[0];

    await client.query(
        `UPDATE form_submissions
         SET active_revision_request_id = $1,
             revision_status = 'requested',
             processing_status = 'needs_changes',
             processed_by = $2,
             processed_at = NOW(),
             processing_note = $3
         WHERE id = $4`,
        [request.id, input.requestedBy, reason, input.submissionId],
    );
    await client.query(
        `INSERT INTO submission_events
            (submission_id, form_id, event_type, action, revision_id, revision_request_id,
             from_status, to_status, note, actor_id, metadata)
         VALUES ($1, $2, 'revision', 'request_created', $3, $4, $5, 'needs_changes', $6, $7, $8)`,
        [
            input.submissionId,
            submission.form_id,
            submission.current_revision_id,
            request.id,
            submission.processing_status,
            reason,
            input.requestedBy,
            JSON.stringify({
                editScope: input.editScope,
                editableFieldKeys: input.editScope === "selected" ? editableFieldKeys : [],
                expiresAt: input.expiresAt?.toISOString() ?? null,
            }),
        ],
    );

    return mapRevisionRequest(request);
}

export async function cancelRevisionRequest(
    client: PoolClient,
    input: {
        submissionId: string;
        requestId: string;
        formId?: string;
        cancelledBy: string;
    },
) {
    const requestResult = await client.query<RevisionRequestRow>(
        `SELECT * FROM submission_revision_requests
         WHERE id = $1 AND submission_id = $2
         FOR UPDATE`,
        [input.requestId, input.submissionId],
    );
    const request = requestResult.rows[0];
    if (!request) {
        throw new FormRevisionError("补交请求不存在", 404, "revision_request_not_found");
    }
    const submissionResult = await client.query<{
        form_id: string;
        current_revision_id: string;
        processing_status: string;
        active_revision_request_id: string | null;
    }>(
        `SELECT form_id, current_revision_id, processing_status, active_revision_request_id
         FROM form_submissions
         WHERE id = $1
         FOR UPDATE`,
        [input.submissionId],
    );
    const submission = submissionResult.rows[0];
    if (!submission || (input.formId && submission.form_id !== input.formId)) {
        throw new FormRevisionError("提交结果不存在", 404, "submission_not_found");
    }
    if (request.status !== "open" || submission.active_revision_request_id !== request.id) {
        throw new FormRevisionError("补交请求已结束", 409, "revision_request_closed");
    }

    const expired = Boolean(request.expires_at && new Date(request.expires_at).getTime() <= Date.now());
    if (expired) {
        await expireOpenRequest(client, {
            request,
            formId: submission.form_id,
            currentRevisionId: submission.current_revision_id,
            currentProcessingStatus: submission.processing_status,
        });
        return { ...mapRevisionRequest(request), status: "expired" as const };
    }

    const cancelledResult = await client.query<RevisionRequestRow>(
        `UPDATE submission_revision_requests
         SET status = 'cancelled', cancelled_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [request.id],
    );
    await revokeRevisionAccessTokens(client, request.id);
    await client.query(
        `UPDATE form_submissions
         SET active_revision_request_id = NULL,
             revision_status = CASE WHEN revision_count > 1 THEN 'resubmitted' ELSE 'none' END,
             processing_status = 'pending',
             processed_by = NULL,
             processed_at = NULL,
             processing_note = NULL
         WHERE id = $1`,
        [input.submissionId],
    );
    await client.query(
        `INSERT INTO submission_events
            (submission_id, form_id, event_type, action, revision_id, revision_request_id,
             from_status, to_status, note, actor_id, metadata)
         VALUES ($1, $2, 'revision', 'request_cancelled', $3, $4,
                 $5, 'pending', $6, $7, $8)`,
        [
            input.submissionId,
            submission.form_id,
            submission.current_revision_id,
            request.id,
            submission.processing_status,
            request.reason,
            input.cancelledBy,
            JSON.stringify({ editScope: request.edit_scope }),
        ],
    );

    return mapRevisionRequest(cancelledResult.rows[0]);
}

export async function submitRevision(
    client: PoolClient,
    input: {
        submissionId: string;
        requestId: string;
        formId?: string;
        data: Record<string, unknown>;
        submittedBy: string | null;
        submittedVia: Exclude<SubmissionRevisionSource, "initial">;
        ipAddress?: string | null;
        userAgent?: string | null;
        fingerprint?: string | null;
        duration?: number | null;
    },
) {
    const submissionResult = await client.query<{
        id: string;
        form_id: string;
        form_version_id: string;
        current_revision_id: string | null;
        active_revision_request_id: string | null;
        processing_status: string;
        data: Record<string, unknown>;
        field_snapshot: unknown;
        result_config: unknown;
    }>(
        `SELECT fs.id, fs.form_id, fs.form_version_id, fs.current_revision_id,
                fs.active_revision_request_id, fs.processing_status, fs.data,
                fs.field_snapshot, fv.result_config
         FROM form_submissions fs
         INNER JOIN form_versions fv ON fv.id = fs.form_version_id
         WHERE fs.id = $1
         FOR UPDATE OF fs`,
        [input.submissionId],
    );
    const submission = submissionResult.rows[0];
    if (!submission || (input.formId && submission.form_id !== input.formId)) {
        throw new FormRevisionError("提交结果不存在", 404, "submission_not_found");
    }
    if (!submission.current_revision_id) {
        throw new FormRevisionError("提交结果缺少当前修订", 409, "current_revision_missing");
    }

    const requestResult = await client.query<RevisionRequestRow>(
        `SELECT * FROM submission_revision_requests
         WHERE id = $1 AND submission_id = $2
         FOR UPDATE`,
        [input.requestId, input.submissionId],
    );
    const request = requestResult.rows[0];
    if (!request) {
        throw new FormRevisionError("补交请求不存在", 404, "revision_request_not_found");
    }
    if (request.status !== "open" || submission.active_revision_request_id !== request.id) {
        throw new FormRevisionError("补交请求已完成或已取消", 409, "revision_request_closed");
    }
    if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) {
        throw new FormRevisionError("补交请求已过期", 410, "revision_request_expired");
    }
    if (request.base_revision_id !== submission.current_revision_id) {
        throw new FormRevisionError("当前结果已发生变化，请刷新后重试", 409, "revision_conflict");
    }

    const currentRevision = await getCurrentRevision(client, input.submissionId, { forUpdate: true });
    if (!currentRevision || currentRevision.id !== submission.current_revision_id) {
        throw new FormRevisionError("当前修订不存在", 409, "current_revision_missing");
    }
    const fields = normalizeFormFields(currentRevision.fieldSnapshot);
    const fieldMap = new Map(fields.map((field) => [field.key, field]));
    const allowedKeys = request.edit_scope === "all"
        ? new Set(fields.filter((field) => field.enabled).map((field) => field.key))
        : new Set(request.editable_field_keys);
    const merged = { ...currentRevision.data };
    const changedKeys: string[] = [];

    for (const [key, value] of Object.entries(input.data)) {
        const field = fieldMap.get(key);
        const previousValue = currentRevision.data[key];
        const changed = !answersEqual(previousValue, value);
        if (!field || !field.enabled || !allowedKeys.has(key)) {
            if (changed) {
                throw new FormRevisionError(`字段「${field?.label ?? key}」不在本次可修改范围内`, 403, "field_not_editable");
            }
            continue;
        }
        merged[key] = value;
        if (changed) {
            changedKeys.push(key);
        }
    }

    if (changedKeys.length === 0) {
        throw new FormRevisionError("没有检测到需要提交的修改", 400, "no_changes");
    }
    const validation = validateSubmissionValues(fields, merged);
    if (!validation.ok) {
        throw new FormRevisionError(validation.error, 400, "submission_invalid");
    }

    const resultConfig = normalizeResultConfig(submission.result_config, fields);
    const gradeResult = buildSubmissionGradeResult(fields, validation.value, resultConfig);
    const revisionNumber = currentRevision.revisionNumber + 1;
    const revisionResult = await client.query<RevisionRow>(
        `INSERT INTO form_submission_revisions
            (submission_id, revision_number, source_request_id, data, field_snapshot,
             submitted_by, submitted_via, ip_address, user_agent, fingerprint, duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
            input.submissionId,
            revisionNumber,
            request.id,
            JSON.stringify(validation.value),
            JSON.stringify(fields),
            input.submittedBy,
            input.submittedVia,
            input.ipAddress ?? null,
            input.userAgent ?? null,
            input.fingerprint ?? null,
            input.duration ?? null,
        ],
    );
    const revision = revisionResult.rows[0];

    for (const grade of gradeResult.grades) {
        await client.query(
            `INSERT INTO submission_grades
                (submission_id, revision_id, field_key, field_label, field_type,
                 answer, expected_answer, score, max_score, grading_type, matched,
                 comment, rule_snapshot, graded_by, graded_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
                input.submissionId,
                revision.id,
                grade.fieldKey,
                grade.fieldLabel,
                grade.fieldType,
                JSON.stringify(grade.answer),
                JSON.stringify(grade.expectedAnswer),
                grade.score,
                grade.maxScore,
                grade.gradingType,
                grade.matched,
                grade.comment,
                JSON.stringify(grade.ruleSnapshot),
                grade.gradedBy,
                grade.gradedAt,
            ],
        );
    }

    await client.query(
        `UPDATE form_submissions
         SET current_revision_id = $1,
             active_revision_request_id = NULL,
             revision_count = $2,
             revision_status = 'resubmitted',
             last_resubmitted_at = NOW(),
             data = $3,
             field_snapshot = $4,
             grading_status = $5,
             total_score = $6,
             max_score = $7,
             processing_status = 'pending',
             processed_by = NULL,
             processed_at = NULL,
             processing_note = NULL
         WHERE id = $8`,
        [
            revision.id,
            revisionNumber,
            JSON.stringify(validation.value),
            JSON.stringify(fields),
            gradeResult.gradingStatus,
            gradeResult.totalScore,
            gradeResult.maxScore,
            input.submissionId,
        ],
    );
    await client.query(
        `UPDATE submission_revision_requests
         SET status = 'fulfilled',
             fulfilled_revision_id = $1,
             fulfilled_at = NOW()
         WHERE id = $2`,
        [revision.id, request.id],
    );
    await consumeRevisionAccessTokens(client, request.id);
    await client.query(
        `INSERT INTO submission_events
            (submission_id, form_id, event_type, action, revision_id, revision_request_id,
             from_status, to_status, score, max_score, actor_id, metadata)
         VALUES ($1, $2, 'revision', 'submitted', $3, $4, $5, 'pending', $6, $7, $8, $9)`,
        [
            input.submissionId,
            submission.form_id,
            revision.id,
            request.id,
            submission.processing_status,
            gradeResult.totalScore,
            gradeResult.maxScore,
            input.submittedBy,
            JSON.stringify({
                revisionNumber,
                submittedVia: input.submittedVia,
                changedFieldKeys: changedKeys,
                gradingStatus: gradeResult.gradingStatus,
            }),
        ],
    );

    return {
        revision: mapRevision(revision),
        changedFieldKeys: changedKeys,
        gradingStatus: gradeResult.gradingStatus,
        totalScore: gradeResult.totalScore,
        maxScore: gradeResult.maxScore,
        processingStatus: "pending" as const,
    };
}
