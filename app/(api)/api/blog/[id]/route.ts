import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { headers } from "next/headers";
import { invalidateBlogCache } from "@/lib/cache";

// ─── 管理员鉴权 ──────────────────────────────────────────
async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

// ─── GET /api/blog/[id] — 按 ID 获取文章（管理员，含草稿）─
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { id } = await params;

    const result = await pool.query(
        `SELECT bp.*, u.name AS author_name, u.image AS author_image
         FROM blog_posts bp
         LEFT JOIN "user" u ON bp.author_id = u.id
         WHERE bp.id = $1`,
        [id],
    );

    if (result.rows.length === 0) {
        return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }

    return NextResponse.json({ post: result.rows[0] });
}

// ─── PUT /api/blog/[id] — 更新文章（管理员）──────────────
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, content, excerpt, cover_image, status } = body;

    if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
        return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    }

    // 构建动态 SET 子句
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title.trim()); }
    if (content !== undefined) { fields.push(`content = $${idx++}`); values.push(content); }
    if (excerpt !== undefined) { fields.push(`excerpt = $${idx++}`); values.push(excerpt || null); }
    if (cover_image !== undefined) { fields.push(`cover_image = $${idx++}`); values.push(cover_image || null); }
    if (status !== undefined && ["draft", "published"].includes(status)) {
        fields.push(`status = $${idx++}`);
        values.push(status);
        // 首次发布时设置 published_at
        if (status === "published") {
            fields.push(`published_at = COALESCE(published_at, NOW())`);
        }
    }

    if (fields.length === 0) {
        return NextResponse.json({ error: "无更新内容" }, { status: 400 });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
        `UPDATE blog_posts SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, slug`,
        values,
    );

    if (result.rows.length === 0) {
        return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }

    invalidateBlogCache();

    return NextResponse.json({ post: result.rows[0] });
}

// ─── DELETE /api/blog/[id] — 删除文章（管理员）────────────
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { id } = await params;

    const result = await pool.query(
        `DELETE FROM blog_posts WHERE id = $1 RETURNING id`,
        [id],
    );

    if (result.rows.length === 0) {
        return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }

    invalidateBlogCache();

    return NextResponse.json({ success: true });
}
