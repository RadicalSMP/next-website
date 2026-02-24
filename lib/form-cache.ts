import { unstable_cache, revalidateTag } from "next/cache";
import { pool } from "@/lib/db";

// ─── 缓存标签 ────────────────────────────────────────────
const FORMS_CACHE_TAG = "forms";
const ADMIN_FORMS_CACHE_TAG = "admin-forms";
const FORM_SUBMISSIONS_CACHE_TAG = "form-submissions";

// ─── 获取活跃表单列表（公开页面用，缓存） ─────────────────
export const getActiveForms = unstable_cache(
    async () => {
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
    },
    ["forms-active-list"],
    { tags: [FORMS_CACHE_TAG] },
);

// ─── 按 slug 获取表单详情（公开页面用，缓存） ─────────────
export const getFormBySlug = unstable_cache(
    async (slug: string) => {
        const result = await pool.query(
            `SELECT f.*, u.name AS created_by_name
             FROM forms f
             LEFT JOIN "user" u ON f.created_by = u.id
             WHERE f.slug = $1 AND f.status = 'active'`,
            [slug],
        );
        return result.rows[0] || null;
    },
    ["form-by-slug"],
    { tags: [FORMS_CACHE_TAG] },
);

// ─── 管理后台表单列表（缓存，含提交统计） ─────────────────
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
    { tags: [ADMIN_FORMS_CACHE_TAG] },
);

// ─── 管理后台获取单个表单（含字段定义） ───────────────────
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
    { tags: [ADMIN_FORMS_CACHE_TAG] },
);

// ─── 获取表单提交列表（管理后台用，缓存） ─────────────────
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
    { tags: [FORM_SUBMISSIONS_CACHE_TAG] },
);

// ─── 使表单缓存失效 ──────────────────────────────────────
export function invalidateFormCache() {
    revalidateTag(FORMS_CACHE_TAG, { expire: 0 });
    revalidateTag(ADMIN_FORMS_CACHE_TAG, { expire: 0 });
}

// ─── 使提交缓存失效 ──────────────────────────────────────
export function invalidateSubmissionCache() {
    revalidateTag(FORM_SUBMISSIONS_CACHE_TAG, { expire: 0 });
    revalidateTag(ADMIN_FORMS_CACHE_TAG, { expire: 0 });
}
