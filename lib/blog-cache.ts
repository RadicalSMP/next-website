import { unstable_cache, revalidateTag } from "next/cache";
import { pool } from "@/lib/db";

// ─── 缓存标签 ────────────────────────────────────────────
const BLOG_CACHE_TAG = "blog-posts";

// ─── 获取已发布文章列表（缓存） ───────────────────────────
export const getPublishedPosts = unstable_cache(
    async () => {
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
    },
    ["blog-published-list"],
    { tags: [BLOG_CACHE_TAG] },
);

// ─── 按 slug 获取已发布文章（缓存） ──────────────────────
export const getPublishedPostBySlug = unstable_cache(
    async (slug: string) => {
        const result = await pool.query(
            `SELECT bp.*, u.name AS author_name, u.image AS author_image
             FROM blog_posts bp
             LEFT JOIN "user" u ON bp.author_id = u.id
             WHERE bp.slug = $1 AND bp.status = 'published'`,
            [slug],
        );
        return result.rows[0] || null;
    },
    ["blog-post-by-slug"],
    { tags: [BLOG_CACHE_TAG] },
);

// ─── 按 slug 获取文章元数据（缓存，用于 SEO） ────────────
export const getPostMetadataBySlug = unstable_cache(
    async (slug: string) => {
        const result = await pool.query(
            `SELECT title, excerpt FROM blog_posts WHERE slug = $1 AND status = 'published'`,
            [slug],
        );
        return result.rows[0] || null;
    },
    ["blog-post-metadata"],
    { tags: [BLOG_CACHE_TAG] },
);

// ─── 使博客缓存失效 ──────────────────────────────────────
export function invalidateBlogCache() {
    revalidateTag(BLOG_CACHE_TAG, { expire: 0 });
}
