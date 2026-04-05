import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { headers } from "next/headers";
import { invalidateFormCache, invalidateReviewConfigCache } from "@/lib/cache";

// ─── 管理员鉴权 ──────────────────────────────────────────
async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

// ─── GET /api/forms/[id] — 获取单个表单（管理员） ─────────
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
        `SELECT f.*, u.name AS created_by_name
         FROM forms f
         LEFT JOIN "user" u ON f.created_by = u.id
         WHERE f.id = $1`,
        [id],
    );

    if (result.rows.length === 0) {
        return NextResponse.json({ error: "表单不存在" }, { status: 404 });
    }

    const form = result.rows[0];

    // 解析 allowed_user_ids 对应的用户信息
    let allowedUsers: { id: string; name: string; email: string; image: string | null }[] = [];
    const ids: string[] = form.allowed_user_ids || [];
    if (ids.length > 0) {
        const userResult = await pool.query(
            `SELECT id, name, email, image FROM "user" WHERE id = ANY($1::text[])`,
            [ids],
        );
        allowedUsers = userResult.rows;
    }

    return NextResponse.json({ form, allowedUsers });
}

// ─── PUT /api/forms/[id] — 更新表单（管理员） ─────────────
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
    const { title, description, slug, fields, visibility, allowed_user_ids, status } = body;

    const existingFormResult = await pool.query(
        `SELECT slug FROM forms WHERE id = $1`,
        [id],
    );
    if (existingFormResult.rows.length === 0) {
        return NextResponse.json({ error: "表单不存在" }, { status: 404 });
    }
    const previousSlug = existingFormResult.rows[0].slug as string;

    // 构建动态 SET 子句
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (title !== undefined) {
        if (typeof title !== "string" || title.trim().length === 0) {
            return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
        }
        setClauses.push(`title = $${idx++}`);
        values.push(title.trim());
    }
    if (description !== undefined) {
        setClauses.push(`description = $${idx++}`);
        values.push(description || null);
    }
    if (slug !== undefined) {
        if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug.trim())) {
            return NextResponse.json(
                { error: "slug 只能包含小写字母、数字和连字符" },
                { status: 400 },
            );
        }
        // 检查 slug 唯一性（排除自身）
        const existing = await pool.query(
            `SELECT id FROM forms WHERE slug = $1 AND id != $2`,
            [slug.trim(), id],
        );
        if (existing.rows.length > 0) {
            return NextResponse.json({ error: "该 slug 已被使用" }, { status: 409 });
        }
        setClauses.push(`slug = $${idx++}`);
        values.push(slug.trim());
    }
    if (fields !== undefined) {
        if (!Array.isArray(fields) || fields.length === 0) {
            return NextResponse.json({ error: "至少需要一个字段" }, { status: 400 });
        }
        setClauses.push(`fields = $${idx++}`);
        values.push(JSON.stringify(fields));
    }
    if (visibility !== undefined) {
        if (!["public", "authenticated", "members"].includes(visibility)) {
            return NextResponse.json({ error: "无效的可见性设置" }, { status: 400 });
        }
        setClauses.push(`visibility = $${idx++}`);
        values.push(visibility);
    }
    if (allowed_user_ids !== undefined) {
        setClauses.push(`allowed_user_ids = $${idx++}`);
        values.push(allowed_user_ids || []);
    }
    if (status !== undefined) {
        if (!["active", "closed"].includes(status)) {
            return NextResponse.json({ error: "无效的状态" }, { status: 400 });
        }
        setClauses.push(`status = $${idx++}`);
        values.push(status);
    }

    if (setClauses.length === 0) {
        return NextResponse.json({ error: "无更新内容" }, { status: 400 });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
        `UPDATE forms SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING id, slug`,
        values,
    );

    if (result.rows.length === 0) {
        return NextResponse.json({ error: "表单不存在" }, { status: 404 });
    }

    const currentSlug = result.rows[0].slug as string;
    invalidateFormCache([previousSlug, currentSlug]);
    if (previousSlug === "join-application" || currentSlug === "join-application") {
        invalidateReviewConfigCache();
    }

    return NextResponse.json({ form: result.rows[0] });
}

// ─── DELETE /api/forms/[id] — 删除表单（管理员） ──────────
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
        `DELETE FROM forms WHERE id = $1 RETURNING id, slug`,
        [id],
    );

    if (result.rows.length === 0) {
        return NextResponse.json({ error: "表单不存在" }, { status: 404 });
    }

    invalidateFormCache([result.rows[0].slug]);
    if (result.rows[0].slug === "join-application") {
        invalidateReviewConfigCache();
    }

    return NextResponse.json({ success: true });
}
