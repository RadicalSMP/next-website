import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { headers } from "next/headers";
import {
    getFormSubmissions,
    invalidateSubmissionCache,
} from "@/lib/cache";
import {
    normalizeFormFields,
    validateSubmissionValues,
} from "@/lib/forms";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

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
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "all";

    const data = await getFormSubmissions(id, page, limit, query, status);
    return NextResponse.json(data);
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    const formResult = await pool.query(
        `SELECT f.id, f.visibility, f.allowed_user_ids, f.status,
                fv.id AS version_id, fv.fields
         FROM forms f
         INNER JOIN form_versions fv ON fv.id = f.current_version_id
         WHERE f.id = $1 AND f.status = 'published'`,
        [id],
    );
    if (formResult.rows.length === 0) {
        return NextResponse.json({ error: "表单不存在或未发布" }, { status: 404 });
    }

    const form = formResult.rows[0];
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
    const data = body.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return NextResponse.json({ error: "提交数据不能为空" }, { status: 400 });
    }

    const fields = normalizeFormFields(form.fields);
    const validation = validateSubmissionValues(fields, data as Record<string, unknown>);
    if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const ipAddress =
        reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        reqHeaders.get("x-real-ip") ||
        null;
    const userAgent = reqHeaders.get("user-agent") || null;

    const result = await pool.query(
        `INSERT INTO form_submissions
            (form_id, form_version_id, user_id, user_email, data, field_snapshot,
             ip_address, user_agent, fingerprint, duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
            id,
            form.version_id,
            session?.user?.id || null,
            session?.user?.email || null,
            JSON.stringify(validation.value),
            JSON.stringify(fields),
            ipAddress,
            userAgent,
            typeof body.fingerprint === "string" ? body.fingerprint : null,
            typeof body.duration === "number" ? Math.round(body.duration) : null,
        ],
    );

    invalidateSubmissionCache();

    return NextResponse.json({ submission: result.rows[0] }, { status: 201 });
}
