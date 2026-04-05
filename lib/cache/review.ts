/**
 * 入服审核相关缓存函数
 */

import { revalidateTag, unstable_cache } from "next/cache";
import { pool } from "@/lib/db";
import { CACHE_TAGS } from "./tags";

function isUndefinedTableError(error: unknown) {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "42P01"
    );
}

// ─── 获取评分规则（保留 unstable_cache） ─────────────────────────
export const getReviewScoringRules = unstable_cache(
    async (formSlug: string = "join-application") => {
        try {
            const result = await pool.query(
                `SELECT * FROM review_scoring_rules WHERE form_slug = $1`,
                [formSlug],
            );
            return result.rows[0] || null;
        } catch (error) {
            if (isUndefinedTableError(error)) {
                return null;
            }
            throw error;
        }
    },
    ["review-scoring-rules"],
    { tags: [CACHE_TAGS.REVIEW_RULES] },
);

// ─── 获取入服表单提交列表（保留 unstable_cache） ─────────────────
export const getReviewSubmissions = unstable_cache(
    async (
        page: number,
        limit: number,
        statusFilter?: "pending" | "approved" | "rejected",
    ) => {
        const offset = page * limit;

        let statusCondition = "";
        const params: (string | number)[] = [];
        let paramIdx = 1;

        const formResult = await pool.query(
            `SELECT id FROM forms WHERE slug = 'join-application' LIMIT 1`,
        );
        if (formResult.rows.length === 0) {
            return { submissions: [], total: 0 };
        }
        const formId = formResult.rows[0].id;
        params.push(formId);
        paramIdx++;

        if (statusFilter === "pending") {
            statusCondition = `AND sr.id IS NULL`;
        } else if (statusFilter === "approved" || statusFilter === "rejected") {
            statusCondition = `AND sr.status = $${paramIdx}`;
            params.push(statusFilter);
            paramIdx++;
        }

        const countQuery = `
            SELECT COUNT(*) FROM form_submissions fs
            LEFT JOIN submission_reviews sr ON sr.submission_id = fs.id
            WHERE fs.form_id = $1 ${statusCondition}
        `;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        const listQuery = `
            SELECT
                fs.*,
                u.name AS user_name,
                u.image AS user_image,
                ss.duration_score,
                ss.ua_score,
                ss.objective_score,
                ss.objective_detail,
                ss.ai_score,
                ss.ai_detail,
                ss.ai_scored_at,
                ss.total_score,
                ss.max_possible_score,
                sr.status AS review_status,
                sr.note AS review_note,
                sr.created_at AS review_at,
                reviewer.name AS reviewer_name
            FROM form_submissions fs
            LEFT JOIN "user" u ON fs.user_id = u.id
            LEFT JOIN submission_scores ss ON ss.submission_id = fs.id
            LEFT JOIN submission_reviews sr ON sr.submission_id = fs.id
            LEFT JOIN "user" reviewer ON sr.reviewer_id = reviewer.id
            WHERE fs.form_id = $1 ${statusCondition}
            ORDER BY fs.created_at DESC
            LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
        `;
        params.push(limit, offset);

        const result = await pool.query(listQuery, params);

        return { submissions: result.rows, total };
    },
    ["review-submissions-list"],
    { tags: [CACHE_TAGS.REVIEW_SUBMISSIONS] },
);

// ─── 使审核缓存失效 ─────────────────────────────────────────────
export function invalidateReviewCache() {
    revalidateTag(CACHE_TAGS.REVIEW_SUBMISSIONS, { expire: 0 });
}

export function invalidateReviewRulesCache() {
    revalidateTag(CACHE_TAGS.REVIEW_RULES, { expire: 0 });
}
