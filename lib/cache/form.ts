import {
    cacheLife,
    cacheTag,
    revalidateTag,
    unstable_cache,
} from "next/cache";
import { pool } from "@/lib/db";
import { CACHE_TAGS } from "./tags";

// ─── 获取活跃表单列表（公开页面用，迁移到 Cache Components） ─────
export async function getActiveForms() {
    "use cache";
    cacheTag(CACHE_TAGS.FORMS);
    cacheLife("hours");

    try {
        const result = await pool.query(
            `SELECT f.id, f.title, f.description, f.slug, f.visibility, f.status,
                    f.allowed_user_ids, f.created_at,
                    u.name AS created_by_name
             FROM forms f
             LEFT JOIN "user" u ON f.created_by = u.id
             WHERE f.status = 'active'
             ORDER BY f.created_at DESC`,
        );
        return result.rows;
    } catch {
        // 表不存在时返回空数组（迁移前的构建兼容）
        return [];
    }
}

// ─── 按 slug 获取表单详情（公开页面用，迁移到 Cache Components） ──
export async function getFormBySlug(slug: string) {
    "use cache";
    cacheTag(CACHE_TAGS.FORMS);
    cacheLife("hours");

    const result = await pool.query(
        `SELECT f.*, u.name AS created_by_name
         FROM forms f
         LEFT JOIN "user" u ON f.created_by = u.id
         WHERE f.slug = $1 AND f.status = 'active'`,
        [slug],
    );
    return result.rows[0] || null;
}

// ─── 管理后台表单列表（保留 unstable_cache） ─────────────────────
export const getAdminForms = unstable_cache(
    async () => {
        const result = await pool.query(
            `SELECT f.*,
                    u.name AS created_by_name,
                    COALESCE(sub.total, 0)::int AS submission_count
             FROM forms f
             LEFT JOIN "user" u ON f.created_by = u.id
             LEFT JOIN (
                 SELECT form_id, COUNT(*) AS total
                 FROM form_submissions
                 GROUP BY form_id
             ) sub ON sub.form_id = f.id
             ORDER BY f.created_at DESC`,
        );
        return result.rows;
    },
    ["admin-forms-list"],
    { tags: [CACHE_TAGS.ADMIN_FORMS] },
);

// ─── 管理后台获取单个表单（保留 unstable_cache） ─────────────────
export const getAdminFormById = unstable_cache(
    async (id: string) => {
        const result = await pool.query(
            `SELECT f.*, u.name AS created_by_name
             FROM forms f
             LEFT JOIN "user" u ON f.created_by = u.id
             WHERE f.id = $1`,
            [id],
        );
        return result.rows[0] || null;
    },
    ["admin-form-by-id"],
    { tags: [CACHE_TAGS.ADMIN_FORMS] },
);

// ─── 获取表单提交列表（管理后台用，保留 unstable_cache） ──────────
export const getFormSubmissions = unstable_cache(
    async (formId: string, page: number, limit: number) => {
        const offset = page * limit;

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM form_submissions WHERE form_id = $1`,
            [formId],
        );
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(
            `SELECT fs.*,
                    u.name AS user_name,
                    u.image AS user_image
             FROM form_submissions fs
             LEFT JOIN "user" u ON fs.user_id = u.id
             WHERE fs.form_id = $1
             ORDER BY fs.created_at DESC
             LIMIT $2 OFFSET $3`,
            [formId, limit, offset],
        );

        return { submissions: result.rows, total };
    },
    ["form-submissions-list"],
    { tags: [CACHE_TAGS.FORM_SUBMISSIONS] },
);

// ─── 使表单缓存失效 ────────────────────────────────────────────
export function invalidateFormCache() {
    revalidateTag(CACHE_TAGS.FORMS, { expire: 0 });
    revalidateTag(CACHE_TAGS.ADMIN_FORMS, { expire: 0 });
}

// ─── 使提交缓存失效 ────────────────────────────────────────────
export function invalidateSubmissionCache() {
    revalidateTag(CACHE_TAGS.FORM_SUBMISSIONS, { expire: 0 });
    revalidateTag(CACHE_TAGS.ADMIN_FORMS, { expire: 0 });
}
