import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { pool } from "@/lib/db";
import { CACHE_TAGS } from "./tags";

// ─── 获取已发布文章列表（缓存） ───────────────────────────
export async function getPublishedPosts() {
    "use cache";
    cacheTag(CACHE_TAGS.BLOG_POSTS);
    cacheLife("hours");

    const result = await pool.query(
        `SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.cover_image, bp.published_at,
                u.name AS author_name
         FROM blog_posts bp
         LEFT JOIN "user" u ON bp.author_id = u.id
         WHERE bp.status = 'published'
         ORDER BY bp.published_at DESC
         LIMIT 20`,
    );
    return result.rows;
}

// ─── 按 slug 获取已发布文章（缓存） ──────────────────────
export async function getPublishedPostBySlug(slug: string) {
    "use cache";
    cacheTag(CACHE_TAGS.BLOG_POSTS);
    cacheLife("hours");

    const result = await pool.query(
        `SELECT bp.*, u.name AS author_name, u.image AS author_image
         FROM blog_posts bp
         LEFT JOIN "user" u ON bp.author_id = u.id
         WHERE bp.slug = $1 AND bp.status = 'published'`,
        [slug],
    );
    return result.rows[0] || null;
}

// ─── 按 slug 获取文章元数据（缓存，用于 SEO） ────────────
export async function getPostMetadataBySlug(slug: string) {
    "use cache";
    cacheTag(CACHE_TAGS.BLOG_POSTS);
    cacheLife("hours");

    const result = await pool.query(
        `SELECT title, excerpt FROM blog_posts WHERE slug = $1 AND status = 'published'`,
        [slug],
    );
    return result.rows[0] || null;
}

// ─── 管理后台文章列表（缓存，按 page/limit/status 分片） ──
export async function getAdminBlogPosts(page: number, limit: number, status: string | null) {
    "use cache";
    cacheTag(CACHE_TAGS.ADMIN_BLOG_POSTS);
    cacheLife("default");

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (status && ["draft", "published"].includes(status)) {
        conditions.push(`status = $${paramIdx++}`);
        params.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = page * limit;

    const countResult = await pool.query(
        `SELECT COUNT(*) FROM blog_posts ${where}`,
        params,
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
        `SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.cover_image, bp.status,
                bp.published_at, bp.created_at, bp.updated_at,
                u.name AS author_name, u.image AS author_image
         FROM blog_posts bp
         LEFT JOIN "user" u ON bp.author_id = u.id
         ${where}
         ORDER BY bp.created_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        [...params, limit, offset],
    );

    return { posts: result.rows, total };
}

// ─── 使博客缓存失效（公开 + 管理后台） ───────────────────
export function invalidateBlogCache() {
    // 博客更新可接受短暂延迟，使用 stale-while-revalidate
    revalidateTag(CACHE_TAGS.BLOG_POSTS, "max");
    revalidateTag(CACHE_TAGS.ADMIN_BLOG_POSTS, "max");
}
