import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { headers } from "next/headers";
import { getFormSubmissions, invalidateSubmissionCache } from "@/lib/form-cache";

// ─── 管理员鉴权 ──────────────────────────────────────────
async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

// ─── GET /api/forms/[id]/submissions — 提交列表（管理员） ──
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(0, parseInt(searchParams.get("page") || "0"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    const data = await getFormSubmissions(id, page, limit);
    return NextResponse.json(data);
}

// ─── POST /api/forms/[id]/submissions — 提交表单 ──────────
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    // 获取表单定义
    const formResult = await pool.query(
        `SELECT * FROM forms WHERE id = $1 AND status = 'active'`,
        [id],
    );
    if (formResult.rows.length === 0) {
        return NextResponse.json({ error: "表单不存在或已关闭" }, { status: 404 });
    }

    const form = formResult.rows[0];

    // 权限校验
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null);

    if (form.visibility === "authenticated" && !session?.user) {
        return NextResponse.json({ error: "需要登录后才能填写此表单" }, { status: 401 });
    }
    if (form.visibility === "members") {
        if (!session?.user) {
            return NextResponse.json({ error: "需要登录后才能填写此表单" }, { status: 401 });
        }
        const allowedIds: string[] = form.allowed_user_ids || [];
        if (allowedIds.length > 0 && !allowedIds.includes(session.user.id)) {
            return NextResponse.json({ error: "您没有权限填写此表单" }, { status: 403 });
        }
    }

    const body = await request.json();
    const { data, fingerprint, duration } = body;

    if (!data || typeof data !== "object") {
        return NextResponse.json({ error: "提交数据不能为空" }, { status: 400 });
    }

    // 校验必填字段
    const fields = form.fields as Array<{
        key: string;
        label: string;
        type: string;
        required?: boolean;
    }>;
    for (const field of fields) {
        if (field.required) {
            const value = data[field.key];
            if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
                return NextResponse.json(
                    { error: `「${field.label}」为必填项` },
                    { status: 400 },
                );
            }
        }
    }

    // 已登录用户记录账号邮箱，未登录则为 null
    const userEmail = session?.user?.email || null;
    const userId = session?.user?.id || null;

    // 提取客户端元数据
    const ipAddress =
        reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        reqHeaders.get("x-real-ip") ||
        null;
    const userAgent = reqHeaders.get("user-agent") || null;

    const result = await pool.query(
        `INSERT INTO form_submissions (form_id, user_id, user_email, data, ip_address, user_agent, fingerprint, duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
            id,
            userId,
            userEmail,
            JSON.stringify(data),
            ipAddress,
            userAgent,
            fingerprint || null,
            typeof duration === "number" ? Math.round(duration) : null,
        ],
    );

    invalidateSubmissionCache();

    return NextResponse.json({ submission: result.rows[0] }, { status: 201 });
}
