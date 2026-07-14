import {
    cacheLife,
    cacheTag,
    revalidateTag,
    unstable_cache,
} from "next/cache";
import { pool } from "@/lib/db";
import { CACHE_TAGS, getFormTag } from "./tags";
import { CACHE_KEYS } from "./keys";

function isUndefinedTableError(error: unknown) {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "42P01"
    );
}

const emptySubmissionStats = {
    total: 0,
    last_submitted_at: null,
    submitted_count: 0,
    flagged_count: 0,
    archived_count: 0,
    not_required_grading_count: 0,
    auto_graded_count: 0,
    manual_required_count: 0,
    graded_count: 0,
    not_required_processing_count: 0,
    pending_processing_count: 0,
    approved_count: 0,
    rejected_count: 0,
    needs_changes_count: 0,
    avg_score: null,
    highest_score: null,
};

const emptyResultStats = {
    ...emptySubmissionStats,
    form_count: 0,
};

type QueryBuildResult = {
    where: string;
    params: unknown[];
};

function pushFilter(params: unknown[], conditions: string[], sql: string, value: unknown) {
    params.push(value);
    conditions.push(sql.replace("?", `$${params.length}`));
}

function buildResultWhere(filters: {
    formId?: string;
    query?: string;
    status?: string;
    gradingStatus?: string;
    processingStatus?: string;
    scoreFilter?: string;
    collectionLabel?: string;
}): QueryBuildResult {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (filters.formId) {
        pushFilter(params, conditions, "fs.form_id = ?", filters.formId);
    }
    if (filters.status && filters.status !== "all") {
        pushFilter(params, conditions, "fs.status = ?", filters.status);
    }
    if (filters.gradingStatus && filters.gradingStatus !== "all") {
        pushFilter(params, conditions, "fs.grading_status = ?", filters.gradingStatus);
    }
    if (filters.processingStatus && filters.processingStatus !== "all") {
        pushFilter(params, conditions, "fs.processing_status = ?", filters.processingStatus);
    }
    if (filters.scoreFilter === "scored") {
        conditions.push("fs.total_score IS NOT NULL");
    }
    if (filters.scoreFilter === "unscored") {
        conditions.push("fs.total_score IS NULL");
    }
    if (filters.collectionLabel && filters.collectionLabel !== "all") {
        pushFilter(
            params,
            conditions,
            "COALESCE(fv.result_config #>> '{collection,label}', '') = ?",
            filters.collectionLabel,
        );
    }
    if (filters.query?.trim()) {
        const pattern = `%${filters.query.trim()}%`;
        params.push(pattern);
        conditions.push(`(
            fs.user_email ILIKE $${params.length}
            OR fs.data::text ILIKE $${params.length}
            OR COALESCE(u.name, '') ILIKE $${params.length}
            OR COALESCE(f.title, '') ILIKE $${params.length}
        )`);
    }

    return {
        where: conditions.length > 0 ? conditions.join(" AND ") : "TRUE",
        params,
    };
}

export async function getActiveForms() {
    "use cache";
    cacheTag(CACHE_TAGS.FORMS);
    cacheLife("hours");

    try {
        const result = await pool.query(
            `SELECT f.id, f.title, f.description, f.slug, f.visibility, f.status,
                    f.created_at, fv.published_at,
                    u.name AS created_by_name
             FROM forms f
             INNER JOIN form_versions fv ON fv.id = f.current_version_id
             LEFT JOIN "user" u ON f.created_by = u.id
             WHERE f.status = 'published'
               AND f.visibility IN ('public', 'authenticated')
             ORDER BY fv.published_at DESC`,
        );
        return result.rows;
    } catch (error) {
        if (isUndefinedTableError(error)) {
            return [];
        }
        throw error;
    }
}

export async function getFormBySlug(slug: string) {
    "use cache";
    cacheTag(getFormTag(slug));
    cacheTag(CACHE_TAGS.FORMS);
    cacheLife("hours");

    try {
        const result = await pool.query(
            `SELECT f.id, f.title, f.description, f.slug, f.visibility,
                    f.allowed_user_ids, f.status, f.current_version_id,
                    fv.id AS version_id, fv.version, fv.fields, fv.settings, fv.result_config,
                    fv.title AS published_title,
                    fv.description AS published_description,
                    fv.published_at,
                    u.name AS created_by_name
             FROM forms f
             INNER JOIN form_versions fv ON fv.id = f.current_version_id
             LEFT JOIN "user" u ON f.created_by = u.id
             WHERE f.slug = $1 AND f.status = 'published'`,
            [slug],
        );
        return result.rows[0] || null;
    } catch (error) {
        if (isUndefinedTableError(error)) {
            return null;
        }
        throw error;
    }
}

export const getAdminForms = unstable_cache(
    async () => {
        try {
            const result = await pool.query(
                `SELECT f.*,
                        u.name AS created_by_name,
                        cv.version AS current_version,
                        cv.published_at,
                        cv.result_config AS current_result_config,
                        COALESCE(sub.total, 0)::int AS submission_count,
                        sub.last_submitted_at
                 FROM forms f
                 LEFT JOIN "user" u ON f.created_by = u.id
                 LEFT JOIN form_versions cv ON cv.id = f.current_version_id
                 LEFT JOIN (
                     SELECT form_id, COUNT(*) AS total, MAX(created_at) AS last_submitted_at
                     FROM form_submissions
                     GROUP BY form_id
                 ) sub ON sub.form_id = f.id
                 ORDER BY f.updated_at DESC`,
            );
            return result.rows;
        } catch (error) {
            if (isUndefinedTableError(error)) {
                return [];
            }
            throw error;
        }
    },
    CACHE_KEYS.ADMIN_FORM_LIST,
    { tags: [CACHE_TAGS.ADMIN_FORMS] },
);

export const getAdminFormById = unstable_cache(
    async (id: string) => {
        try {
            const result = await pool.query(
                `SELECT f.*,
                        u.name AS created_by_name,
                        cv.version AS current_version,
                        cv.published_at,
                        cv.fields AS current_fields,
                        cv.settings AS current_settings,
                        cv.result_config AS current_result_config
                 FROM forms f
                 LEFT JOIN "user" u ON f.created_by = u.id
                 LEFT JOIN form_versions cv ON cv.id = f.current_version_id
                 WHERE f.id = $1`,
                [id],
            );
            return result.rows[0] || null;
        } catch (error) {
            if (isUndefinedTableError(error)) {
                return null;
            }
            throw error;
        }
    },
    CACHE_KEYS.ADMIN_FORM_DETAIL,
    { tags: [CACHE_TAGS.ADMIN_FORMS] },
);

export const getFormVersions = unstable_cache(
    async (formId: string) => {
        try {
            const result = await pool.query(
                `SELECT id, form_id, version, title, description, result_config, published_at
                 FROM form_versions
                 WHERE form_id = $1
                 ORDER BY version DESC`,
                [formId],
            );
            return result.rows;
        } catch (error) {
            if (isUndefinedTableError(error)) {
                return [];
            }
            throw error;
        }
    },
    CACHE_KEYS.FORM_VERSION_LIST,
    { tags: [CACHE_TAGS.ADMIN_FORMS] },
);

export const getFormSubmissions = unstable_cache(
    async (
        formId: string,
        page: number,
        limit: number,
        query = "",
        status = "all",
        gradingStatus = "all",
        processingStatus = "all",
    ) => {
        try {
            const offset = page * limit;
            const { where, params } = buildResultWhere({
                formId,
                query,
                status,
                gradingStatus,
                processingStatus,
            });

            const countResult = await pool.query(
                `SELECT COUNT(*) FROM form_submissions fs
                 LEFT JOIN "user" u ON fs.user_id = u.id
                 LEFT JOIN forms f ON f.id = fs.form_id
                 LEFT JOIN form_versions fv ON fv.id = fs.form_version_id
                 WHERE ${where}`,
                params,
            );
            const total = parseInt(countResult.rows[0].count, 10);

            const statsResult = await pool.query(
                `SELECT
                    COUNT(*)::int AS total,
                    MAX(created_at) AS last_submitted_at,
                    COUNT(*) FILTER (WHERE status = 'submitted')::int AS submitted_count,
                    COUNT(*) FILTER (WHERE status = 'flagged')::int AS flagged_count,
                    COUNT(*) FILTER (WHERE status = 'archived')::int AS archived_count,
                    COUNT(*) FILTER (WHERE grading_status = 'not_required')::int AS not_required_grading_count,
                    COUNT(*) FILTER (WHERE grading_status = 'auto_graded')::int AS auto_graded_count,
                    COUNT(*) FILTER (WHERE grading_status = 'manual_required')::int AS manual_required_count,
                    COUNT(*) FILTER (WHERE grading_status = 'graded')::int AS graded_count,
                    COUNT(*) FILTER (WHERE processing_status = 'not_required')::int AS not_required_processing_count,
                    COUNT(*) FILTER (WHERE processing_status = 'pending')::int AS pending_processing_count,
                    COUNT(*) FILTER (WHERE processing_status = 'approved')::int AS approved_count,
                    COUNT(*) FILTER (WHERE processing_status = 'rejected')::int AS rejected_count,
                    COUNT(*) FILTER (WHERE processing_status = 'needs_changes')::int AS needs_changes_count,
                    AVG(total_score) FILTER (WHERE total_score IS NOT NULL)::numeric(10,2) AS avg_score,
                    MAX(total_score) AS highest_score
                 FROM form_submissions
                 WHERE form_id = $1`,
                [formId],
            );

            const listParams = [...params, limit, offset];
            const result = await pool.query(
                `SELECT fs.*,
                        fv.version,
                        fv.title AS version_title,
                        fv.result_config,
                        u.name AS user_name,
                        u.image AS user_image,
                        pu.name AS processed_by_name
                 FROM form_submissions fs
                 LEFT JOIN form_versions fv ON fv.id = fs.form_version_id
                 LEFT JOIN "user" u ON fs.user_id = u.id
                 LEFT JOIN "user" pu ON fs.processed_by = pu.id
                 LEFT JOIN forms f ON f.id = fs.form_id
                 WHERE ${where}
                 ORDER BY fs.created_at DESC
                 LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
                listParams,
            );

            return {
                submissions: result.rows,
                total,
                stats: statsResult.rows[0] || emptySubmissionStats,
            };
        } catch (error) {
            if (isUndefinedTableError(error)) {
                return {
                    submissions: [],
                    total: 0,
                    stats: emptySubmissionStats,
                };
            }
            throw error;
        }
    },
    CACHE_KEYS.FORM_SUBMISSION_LIST,
    { tags: [CACHE_TAGS.FORM_SUBMISSIONS, CACHE_TAGS.FORM_RESULTS] },
);

export const getResultList = unstable_cache(
    async (
        page: number,
        limit: number,
        query = "",
        formId = "all",
        status = "all",
        gradingStatus = "all",
        processingStatus = "all",
        scoreFilter = "all",
        collectionLabel = "all",
    ) => {
        try {
            const offset = page * limit;
            const { where, params } = buildResultWhere({
                formId: formId === "all" ? undefined : formId,
                query,
                status,
                gradingStatus,
                processingStatus,
                scoreFilter,
                collectionLabel,
            });

            const countResult = await pool.query(
                `SELECT COUNT(*) FROM form_submissions fs
                 LEFT JOIN "user" u ON fs.user_id = u.id
                 LEFT JOIN forms f ON f.id = fs.form_id
                 LEFT JOIN form_versions fv ON fv.id = fs.form_version_id
                 WHERE ${where}`,
                params,
            );
            const total = parseInt(countResult.rows[0].count, 10);

            const statsResult = await pool.query(
                `SELECT
                    COUNT(*)::int AS total,
                    COUNT(DISTINCT fs.form_id)::int AS form_count,
                    MAX(fs.created_at) AS last_submitted_at,
                    COUNT(*) FILTER (WHERE fs.status = 'submitted')::int AS submitted_count,
                    COUNT(*) FILTER (WHERE fs.status = 'flagged')::int AS flagged_count,
                    COUNT(*) FILTER (WHERE fs.status = 'archived')::int AS archived_count,
                    COUNT(*) FILTER (WHERE fs.grading_status = 'not_required')::int AS not_required_grading_count,
                    COUNT(*) FILTER (WHERE fs.grading_status = 'auto_graded')::int AS auto_graded_count,
                    COUNT(*) FILTER (WHERE fs.grading_status = 'manual_required')::int AS manual_required_count,
                    COUNT(*) FILTER (WHERE fs.grading_status = 'graded')::int AS graded_count,
                    COUNT(*) FILTER (WHERE fs.processing_status = 'not_required')::int AS not_required_processing_count,
                    COUNT(*) FILTER (WHERE fs.processing_status = 'pending')::int AS pending_processing_count,
                    COUNT(*) FILTER (WHERE fs.processing_status = 'approved')::int AS approved_count,
                    COUNT(*) FILTER (WHERE fs.processing_status = 'rejected')::int AS rejected_count,
                    COUNT(*) FILTER (WHERE fs.processing_status = 'needs_changes')::int AS needs_changes_count,
                    AVG(fs.total_score) FILTER (WHERE fs.total_score IS NOT NULL)::numeric(10,2) AS avg_score,
                    MAX(fs.total_score) AS highest_score
                 FROM form_submissions fs
                 LEFT JOIN "user" u ON fs.user_id = u.id
                 LEFT JOIN forms f ON f.id = fs.form_id
                 LEFT JOIN form_versions fv ON fv.id = fs.form_version_id
                 WHERE ${where}`,
                params,
            );

            const listParams = [...params, limit, offset];
            const result = await pool.query(
                `SELECT fs.id, fs.form_id, fs.form_version_id, fs.user_id, fs.user_email,
                        fs.status, fs.grading_status, fs.total_score, fs.max_score,
                        fs.processing_status, fs.processed_at, fs.processing_note,
                        fs.created_at, fs.duration,
                        f.title AS form_title,
                        f.slug AS form_slug,
                        fv.version,
                        fv.title AS version_title,
                        fv.result_config,
                        COALESCE(fv.result_config #>> '{collection,label}', '') AS collection_label,
                        u.name AS user_name,
                        u.image AS user_image,
                        pu.name AS processed_by_name
                 FROM form_submissions fs
                 LEFT JOIN forms f ON f.id = fs.form_id
                 LEFT JOIN form_versions fv ON fv.id = fs.form_version_id
                 LEFT JOIN "user" u ON fs.user_id = u.id
                 LEFT JOIN "user" pu ON fs.processed_by = pu.id
                 WHERE ${where}
                 ORDER BY fs.created_at DESC
                 LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
                listParams,
            );

            const formsResult = await pool.query(
                `SELECT id, title, slug
                 FROM forms
                 ORDER BY updated_at DESC`,
            );

            const labelsResult = await pool.query(
                `SELECT DISTINCT COALESCE(result_config #>> '{collection,label}', '') AS label
                 FROM form_versions
                 WHERE COALESCE(result_config #>> '{collection,label}', '') <> ''
                 ORDER BY label ASC`,
            );

            return {
                results: result.rows,
                total,
                stats: statsResult.rows[0] || emptyResultStats,
                forms: formsResult.rows,
                labels: labelsResult.rows.map((row) => row.label).filter(Boolean),
            };
        } catch (error) {
            if (isUndefinedTableError(error)) {
                return {
                    results: [],
                    total: 0,
                    stats: emptyResultStats,
                    forms: [],
                    labels: [],
                };
            }
            throw error;
        }
    },
    CACHE_KEYS.RESULT_LIST,
    { tags: [CACHE_TAGS.FORM_RESULTS] },
);

export const getResultDetail = unstable_cache(
    async (formId: string, submissionId: string) => {
        try {
            const submissionResult = await pool.query(
                `SELECT fs.*,
                        f.title AS form_title,
                        f.slug AS form_slug,
                        f.description AS form_description,
                        fv.version,
                        fv.title AS version_title,
                        fv.description AS version_description,
                        fv.fields,
                        fv.settings,
                        fv.result_config,
                        u.name AS user_name,
                        u.email AS account_email,
                        u.image AS user_image,
                        pu.name AS processed_by_name
                 FROM form_submissions fs
                 INNER JOIN forms f ON f.id = fs.form_id
                 INNER JOIN form_versions fv ON fv.id = fs.form_version_id
                 LEFT JOIN "user" u ON fs.user_id = u.id
                 LEFT JOIN "user" pu ON fs.processed_by = pu.id
                 WHERE fs.form_id = $1 AND fs.id = $2`,
                [formId, submissionId],
            );

            const submission = submissionResult.rows[0];
            if (!submission) {
                return null;
            }

            const [gradesResult, eventsResult] = await Promise.all([
                pool.query(
                    `SELECT sg.*, grader.name AS graded_by_name
                     FROM submission_grades sg
                     LEFT JOIN "user" grader ON sg.graded_by = grader.id
                     WHERE sg.submission_id = $1
                     ORDER BY sg.created_at ASC`,
                    [submissionId],
                ),
                pool.query(
                    `SELECT se.*, actor.name AS actor_name
                     FROM submission_events se
                     LEFT JOIN "user" actor ON se.actor_id = actor.id
                     WHERE se.submission_id = $1
                     ORDER BY se.created_at DESC`,
                    [submissionId],
                ),
            ]);

            return {
                submission,
                grades: gradesResult.rows,
                events: eventsResult.rows,
            };
        } catch (error) {
            if (isUndefinedTableError(error)) {
                return null;
            }
            throw error;
        }
    },
    CACHE_KEYS.RESULT_DETAIL,
    { tags: [CACHE_TAGS.FORM_RESULTS] },
);

export function invalidateFormCache(slugs: string[] = []) {
    revalidateTag(CACHE_TAGS.FORMS, { expire: 0 });
    revalidateTag(CACHE_TAGS.ADMIN_FORMS, { expire: 0 });
    for (const slug of new Set(slugs.filter(Boolean))) {
        revalidateTag(getFormTag(slug), { expire: 0 });
    }
}

export function invalidateSubmissionCache() {
    revalidateTag(CACHE_TAGS.FORM_SUBMISSIONS, { expire: 0 });
    revalidateTag(CACHE_TAGS.FORM_RESULTS, { expire: 0 });
    revalidateTag(CACHE_TAGS.ADMIN_FORMS, { expire: 0 });
}
