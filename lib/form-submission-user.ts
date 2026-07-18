import { cacheLife, cacheTag } from "next/cache";
import { pool } from "@/lib/db";
import {
    CACHE_TAGS,
    getFormResultRevisionsTag,
    getFormSubmissionTag,
    getUserFormSubmissionsTag,
} from "@/lib/cache";
import { normalizeFormFields } from "@/lib/forms";

export const USER_SUBMISSION_STATUSES = [
    "all",
    "pending",
    "needs_changes",
    "graded",
    "approved",
    "rejected",
    "resubmitted",
] as const;

export type UserSubmissionStatusFilter = typeof USER_SUBMISSION_STATUSES[number];

export function isFormSubmissionId(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isUserSubmissionStatusFilter(value: string): value is UserSubmissionStatusFilter {
    return USER_SUBMISSION_STATUSES.includes(value as UserSubmissionStatusFilter);
}

export async function getUserSubmissionList(input: {
    userId: string;
    page: number;
    limit: number;
    status: UserSubmissionStatusFilter;
}) {
    "use cache";
    cacheTag(CACHE_TAGS.FORM_SUBMISSIONS, getUserFormSubmissionsTag(input.userId));
    cacheLife("minutes");

    const conditions = ["fs.user_id = $1"];
    const params: unknown[] = [input.userId];
    if (input.status === "graded") {
        conditions.push("fs.grading_status IN ('graded', 'auto_graded')");
    } else if (input.status === "resubmitted") {
        conditions.push("fs.revision_status = 'resubmitted'");
    } else if (input.status !== "all") {
        params.push(input.status);
        conditions.push(`fs.processing_status = $${params.length}`);
    }

    const where = conditions.join(" AND ");
    const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM form_submissions fs
         WHERE ${where}`,
        params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    const offset = input.page * input.limit;
    const listParams = [...params, input.limit, offset];
    const result = await pool.query(
        `SELECT fs.id, fs.form_id, fs.status, fs.grading_status,
                fs.processing_status, fs.processing_note,
                fs.total_score, fs.max_score, fs.revision_count,
                fs.revision_status, fs.last_resubmitted_at, fs.created_at,
                srr.status AS revision_request_status,
                srr.expires_at AS revision_request_expires_at,
                f.title AS form_title, f.slug AS form_slug,
                fv.version AS form_version
         FROM form_submissions fs
         INNER JOIN forms f ON f.id = fs.form_id
         INNER JOIN form_versions fv ON fv.id = fs.form_version_id
         LEFT JOIN submission_revision_requests srr ON srr.id = fs.active_revision_request_id
         WHERE ${where}
         ORDER BY fs.created_at DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams,
    );

    return {
        submissions: result.rows,
        total,
        page: input.page,
        limit: input.limit,
        pageCount: Math.ceil(total / input.limit),
    };
}

export async function getUserSubmissionDetail(submissionId: string) {
    "use cache";
    cacheTag(
        CACHE_TAGS.FORM_RESULTS,
        getFormSubmissionTag(submissionId),
        getFormResultRevisionsTag(submissionId),
    );
    cacheLife("minutes");

    const submissionResult = await pool.query(
        `SELECT fs.id, fs.form_id, fs.form_version_id, fs.user_id,
                fs.data, fs.field_snapshot, fs.status, fs.grading_status,
                fs.total_score, fs.max_score, fs.processing_status,
                fs.processing_note, fs.processed_at, fs.created_at,
                fs.current_revision_id, fs.active_revision_request_id,
                fs.revision_count, fs.revision_status, fs.last_resubmitted_at,
                f.title AS form_title, f.slug AS form_slug,
                fv.version AS form_version, fv.title AS version_title,
                fv.description AS version_description
         FROM form_submissions fs
         INNER JOIN forms f ON f.id = fs.form_id
         INNER JOIN form_versions fv ON fv.id = fs.form_version_id
         WHERE fs.id = $1`,
        [submissionId],
    );
    const submission = submissionResult.rows[0];
    if (!submission) return null;

    const [gradesResult, requestResult, revisionsResult] = await Promise.all([
        pool.query(
            `SELECT id, revision_id, field_key, field_label, field_type,
                    answer, score, max_score, grading_type, matched,
                    comment, graded_at
             FROM submission_grades
             WHERE submission_id = $1 AND revision_id = $2
             ORDER BY created_at ASC`,
            [submissionId, submission.current_revision_id],
        ),
        pool.query(
            `SELECT id, base_revision_id, edit_scope, editable_field_keys,
                    reason, status, expires_at, created_at, fulfilled_at,
                    cancelled_at
             FROM submission_revision_requests
             WHERE id = $1`,
            [submission.active_revision_request_id],
        ),
        pool.query(
            `SELECT r.id, r.revision_number, r.source_request_id,
                    r.data, r.field_snapshot, r.submitted_via, r.created_at,
                    srr.reason AS request_reason,
                    grade_summary.grades,
                    grade_summary.total_score,
                    grade_summary.max_score,
                    CASE
                        WHEN grade_summary.grade_count = 0 THEN 'not_required'
                        WHEN grade_summary.required_manual_missing_count > 0 THEN 'manual_required'
                        WHEN grade_summary.manual_count > 0 THEN 'graded'
                        ELSE 'auto_graded'
                    END AS grading_status
             FROM form_submission_revisions r
             LEFT JOIN submission_revision_requests srr ON srr.id = r.source_request_id
             LEFT JOIN LATERAL (
                 SELECT
                     COALESCE(
                         JSONB_AGG(
                             JSONB_BUILD_OBJECT(
                                 'id', sg.id,
                                 'fieldKey', sg.field_key,
                                 'fieldLabel', sg.field_label,
                                 'fieldType', sg.field_type,
                                 'answer', sg.answer,
                                 'score', sg.score,
                                 'maxScore', sg.max_score,
                                 'gradingType', sg.grading_type,
                                 'matched', sg.matched,
                                 'comment', sg.comment,
                                 'gradedAt', sg.graded_at
                             ) ORDER BY sg.created_at ASC
                         ) FILTER (WHERE sg.id IS NOT NULL),
                         '[]'::JSONB
                     ) AS grades,
                     COUNT(sg.id)::int AS grade_count,
                     COUNT(sg.id) FILTER (WHERE sg.grading_type = 'manual')::int AS manual_count,
                     COUNT(sg.id) FILTER (
                         WHERE sg.grading_type = 'manual'
                           AND COALESCE((sg.rule_snapshot->>'requiredManual')::boolean, false) = true
                           AND sg.score IS NULL
                     )::int AS required_manual_missing_count,
                     COALESCE(SUM(COALESCE(sg.score, 0)), 0)::numeric AS total_score,
                     COALESCE(SUM(sg.max_score), 0)::numeric AS max_score
                 FROM submission_grades sg
                 WHERE sg.revision_id = r.id
             ) grade_summary ON TRUE
             WHERE r.submission_id = $1
             ORDER BY r.revision_number DESC`,
            [submissionId],
        ),
    ]);

    return {
        submission: {
            id: submission.id,
            formId: submission.form_id,
            formVersionId: submission.form_version_id,
            formTitle: submission.form_title,
            formSlug: submission.form_slug,
            formVersion: submission.form_version,
            versionTitle: submission.version_title,
            versionDescription: submission.version_description,
            data: submission.data as Record<string, unknown>,
            fields: normalizeFormFields(submission.field_snapshot),
            status: submission.status,
            gradingStatus: submission.grading_status,
            totalScore: submission.total_score,
            maxScore: submission.max_score,
            processingStatus: submission.processing_status,
            processingNote: submission.processing_note,
            processedAt: submission.processed_at,
            createdAt: submission.created_at,
            currentRevisionId: submission.current_revision_id,
            revisionCount: submission.revision_count,
            revisionStatus: submission.revision_status,
            lastResubmittedAt: submission.last_resubmitted_at,
        },
        grades: gradesResult.rows.map((grade) => ({
            id: grade.id,
            revisionId: grade.revision_id,
            fieldKey: grade.field_key,
            fieldLabel: grade.field_label,
            fieldType: grade.field_type,
            answer: grade.answer,
            score: grade.score,
            maxScore: grade.max_score,
            gradingType: grade.grading_type,
            matched: grade.matched,
            comment: grade.comment,
            gradedAt: grade.graded_at,
        })),
        activeRequest: requestResult.rows[0]
            ? {
                id: requestResult.rows[0].id,
                baseRevisionId: requestResult.rows[0].base_revision_id,
                editScope: requestResult.rows[0].edit_scope,
                editableFieldKeys: requestResult.rows[0].editable_field_keys,
                reason: requestResult.rows[0].reason,
                status: requestResult.rows[0].status,
                expiresAt: requestResult.rows[0].expires_at,
                createdAt: requestResult.rows[0].created_at,
                fulfilledAt: requestResult.rows[0].fulfilled_at,
                cancelledAt: requestResult.rows[0].cancelled_at,
            }
            : null,
        revisions: revisionsResult.rows.map((revision) => ({
            id: revision.id,
            revisionNumber: revision.revision_number,
            sourceRequestId: revision.source_request_id,
            data: revision.data,
            fields: normalizeFormFields(revision.field_snapshot),
            submittedVia: revision.submitted_via,
            createdAt: revision.created_at,
            requestReason: revision.request_reason,
            grades: revision.grades,
            totalScore: revision.total_score,
            maxScore: revision.max_score,
            gradingStatus: revision.grading_status,
        })),
    };
}
