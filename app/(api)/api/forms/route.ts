import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { headers } from "next/headers";
import {
    getAdminForms,
    invalidateFormCache,
    invalidateReviewConfigCache,
} from "@/lib/cache";

// ─── 管理员鉴权 ──────────────────────────────────────────
async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

// ─── GET /api/forms — 获取表单列表（管理员） ──────────────
export async function GET() {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const forms = await getAdminForms();
    return NextResponse.json({ forms });
}

// ─── POST /api/forms — 创建表单（管理员） ─────────────────
export async function POST(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, slug, fields, visibility, allowed_user_ids } = body;

    // 校验必填字段
    if (!title || typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    }
    if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
        return NextResponse.json({ error: "slug 不能为空" }, { status: 400 });
    }
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug.trim())) {
        return NextResponse.json(
            { error: "slug 只能包含小写字母、数字和连字符，且不能以连字符开头或结尾" },
            { status: 400 },
        );
    }
    if (!Array.isArray(fields) || fields.length === 0) {
        return NextResponse.json({ error: "至少需要一个字段" }, { status: 400 });
    }
    if (!["public", "authenticated", "members"].includes(visibility)) {
        return NextResponse.json({ error: "无效的可见性设置" }, { status: 400 });
    }

    // 检查 slug 唯一性
    const existing = await pool.query(
        `SELECT id FROM forms WHERE slug = $1`,
        [slug.trim()],
    );
    if (existing.rows.length > 0) {
        return NextResponse.json({ error: "该 slug 已被使用" }, { status: 409 });
    }

    const result = await pool.query(
        `INSERT INTO forms (title, description, slug, fields, visibility, allowed_user_ids, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, slug`,
        [
            title.trim(),
            description || null,
            slug.trim(),
            JSON.stringify(fields),
            visibility,
            allowed_user_ids || [],
            session.user.id,
        ],
    );

    invalidateFormCache([result.rows[0].slug]);
    if (result.rows[0].slug === "join-application") {
        invalidateReviewConfigCache();
    }

    return NextResponse.json({ form: result.rows[0] }, { status: 201 });
}
