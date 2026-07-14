import { revalidateTag, unstable_cache } from "next/cache";
import { pool } from "@/lib/db";
import { CACHE_TAGS, getBlogPostTag } from "./tags";
import { CACHE_KEYS } from "./keys";

// ─── 管理后台用户列表（保留 unstable_cache） ─────────────────────
export const getAdminUsers = unstable_cache(
    async (page: number, limit: number, search: string | null) => {
        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIdx = 1;

        if (search) {
            conditions.push(
                `("name" ILIKE $${paramIdx} OR "email" ILIKE $${paramIdx})`,
            );
            params.push(`%${search}%`);
            paramIdx++;
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const offset = page * limit;

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM "user" ${where}`,
            params,
        );
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(
            `SELECT "id", "name", "email", "image", "role", "banned", "banReason", "banExpires",
                    "createdAt", "emailVerified"
             FROM "user"
             ${where}
             ORDER BY "createdAt" DESC
             LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...params, limit, offset],
        );

        return { users: result.rows, total };
    },
    CACHE_KEYS.ADMIN_USER_LIST,
    { tags: [CACHE_TAGS.ADMIN_USERS] },
);

export interface UserRelatedCacheTargets {
    publishedBlogSlugs: string[];
}

export async function getUserRelatedCacheTargets(
    userId: string,
): Promise<UserRelatedCacheTargets> {
    const blogResult = await pool.query(
        `SELECT slug
         FROM blog_posts
         WHERE author_id = $1
           AND status = 'published'`,
        [userId],
    );

    return {
        publishedBlogSlugs: blogResult.rows.map((row) => row.slug as string),
    };
}

// ─── 使用户缓存失效 ──────────────────────────────────────────────
export function invalidateUserCache() {
    revalidateTag(CACHE_TAGS.ADMIN_USERS, { expire: 0 });
}

export function invalidateUserRelatedContentCache(
    targets: UserRelatedCacheTargets,
) {
    revalidateTag(CACHE_TAGS.BLOG_POSTS, { expire: 0 });
    revalidateTag(CACHE_TAGS.ADMIN_BLOG_POSTS, { expire: 0 });
    revalidateTag(CACHE_TAGS.ADMIN_FORMS, { expire: 0 });
    revalidateTag(CACHE_TAGS.FORM_SUBMISSIONS, { expire: 0 });
    revalidateTag(CACHE_TAGS.FORM_RESULTS, { expire: 0 });

    for (const slug of new Set(targets.publishedBlogSlugs.filter(Boolean))) {
        revalidateTag(getBlogPostTag(slug), { expire: 0 });
    }
}
