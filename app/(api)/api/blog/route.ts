import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { headers } from "next/headers";
import { invalidateBlogCache, getAdminBlogPosts } from "@/lib/blog-cache";

// ─── GET /api/blog — 获取文章列表 ──────────────────────────
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const page = Math.max(0, parseInt(searchParams.get("page") || "0"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const status = searchParams.get("status"); // draft | published | null(全部)

    // 公开接口只返回已发布文章；管理员可查看全部
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
    const isAdmin = session?.user && (session.user as Record<string, unknown>).role === "admin";

    if (isAdmin) {
        // 管理员：使用服务端缓存
        const data = await getAdminBlogPosts(page, limit, status);
        return NextResponse.json(data);
    }

    // 非管理员：只返回已发布文章（无缓存，公开页面使用独立缓存路径）
    const offset = page * limit;

    const countResult = await pool.query(
        `SELECT COUNT(*) FROM blog_posts WHERE status = 'published'`,
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
        `SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.cover_image, bp.status,
                bp.published_at, bp.created_at, bp.updated_at,
                u.name AS author_name, u.image AS author_image
         FROM blog_posts bp
         LEFT JOIN "user" u ON bp.author_id = u.id
         WHERE status = 'published'
         ORDER BY bp.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
    );

    return NextResponse.json({ posts: result.rows, total });
}

// ─── POST /api/blog — 创建文章（仅管理员）─────────────────
export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const body = await request.json();
    const { title, content, excerpt, cover_image, status } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    }

    // 生成 slug: 8 位随机 hex
    const slug = crypto.randomUUID().split("-")[0];
    const postStatus = status === "published" ? "published" : "draft";
    const publishedAt = postStatus === "published" ? new Date().toISOString() : null;

    const result = await pool.query(
        `INSERT INTO blog_posts (title, slug, content, excerpt, cover_image, status, author_id, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, slug`,
        [title.trim(), slug, content || "", excerpt || null, cover_image || null, postStatus, session.user.id, publishedAt],
    );

    invalidateBlogCache();

    return NextResponse.json({ post: result.rows[0] }, { status: 201 });
}
