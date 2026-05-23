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
    cacheLife("hours");

    try {
        const result = await pool.query(
            `SELECT f.id, f.title, f.description, f.slug, f.visibility,
                    f.allowed_user_ids, f.status, f.current_version_id,
                    fv.id AS version_id, fv.version, fv.fields, fv.settings,
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
        const result = await pool.query(
            `SELECT f.*,
                    u.name AS created_by_name,
                    cv.version AS current_version,
                    cv.published_at,
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
    },
    CACHE_KEYS.ADMIN_FORM_LIST,
    { tags: [CACHE_TAGS.ADMIN_FORMS] },
);

export const getAdminFormById = unstable_cache(
    async (id: string) => {
        const result = await pool.query(
            `SELECT f.*,
                    u.name AS created_by_name,
                    cv.version AS current_version,
                    cv.published_at,
                    cv.fields AS current_fields,
                    cv.settings AS current_settings
             FROM forms f
             LEFT JOIN "user" u ON f.created_by = u.id
             LEFT JOIN form_versions cv ON cv.id = f.current_version_id
             WHERE f.id = $1`,
            [id],
        );
        return result.rows[0] || null;
    },
    CACHE_KEYS.ADMIN_FORM_DETAIL,
    { tags: [CACHE_TAGS.ADMIN_FORMS] },
);

export const getFormVersions = unstable_cache(
    async (formId: string) => {
        const result = await pool.query(
            `SELECT id, form_id, version, title, description, published_at
             FROM form_versions
             WHERE form_id = $1
             ORDER BY version DESC`,
            [formId],
        );
        return result.rows;
    },
    CACHE_KEYS.FORM_VERSION_LIST,
    { tags: [CACHE_TAGS.ADMIN_FORMS] },
);

export const getFormSubmissions = unstable_cache(
    async (formId: string, page: number, limit: number, query = "", status = "all") => {
        const offset = page * limit;
        const params: unknown[] = [formId];
        const conditions = [`fs.form_id = $1`];

        if (status !== "all") {
            params.push(status);
            conditions.push(`fs.status = $${params.length}`);
        }
        if (query.trim()) {
            params.push(`%${query.trim()}%`);
            conditions.push(`(
                fs.user_email ILIKE $${params.length}
                OR fs.data::text ILIKE $${params.length}
                OR COALESCE(u.name, '') ILIKE $${params.length}
            )`);
        }

        const where = conditions.join(" AND ");

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM form_submissions fs
             LEFT JOIN "user" u ON fs.user_id = u.id
             WHERE ${where}`,
            params,
        );
        const total = parseInt(countResult.rows[0].count);

        const statsResult = await pool.query(
            `SELECT
                COUNT(*)::int AS total,
                MAX(created_at) AS last_submitted_at,
                COUNT(*) FILTER (WHERE status = 'submitted')::int AS submitted_count,
                COUNT(*) FILTER (WHERE status = 'flagged')::int AS flagged_count,
                COUNT(*) FILTER (WHERE status = 'archived')::int AS archived_count
             FROM form_submissions
             WHERE form_id = $1`,
            [formId],
        );

        const listParams = [...params, limit, offset];
        const result = await pool.query(
            `SELECT fs.*,
                    fv.version,
                    fv.title AS version_title,
                    u.name AS user_name,
                    u.image AS user_image
             FROM form_submissions fs
             LEFT JOIN form_versions fv ON fv.id = fs.form_version_id
             LEFT JOIN "user" u ON fs.user_id = u.id
             WHERE ${where}
             ORDER BY fs.created_at DESC
             LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
            listParams,
        );

        return {
            submissions: result.rows,
            total,
            stats: statsResult.rows[0] || {
                total: 0,
                last_submitted_at: null,
                submitted_count: 0,
                flagged_count: 0,
                archived_count: 0,
            },
        };
    },
    CACHE_KEYS.FORM_SUBMISSION_LIST,
    { tags: [CACHE_TAGS.FORM_SUBMISSIONS] },
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
    revalidateTag(CACHE_TAGS.ADMIN_FORMS, { expire: 0 });
}
