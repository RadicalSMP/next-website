import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getAdminForms, invalidateFormCache } from "@/lib/cache";
import {
    DEFAULT_FORM_SETTINGS,
    normalizeDraftFormBasePayload,
    normalizeDraftFormVersionPayload,
} from "@/lib/forms";
import { headers } from "next/headers";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

export async function GET() {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const forms = await getAdminForms();
    return NextResponse.json({ forms });
}

export async function POST(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const body = await request.json();
    const baseResult = normalizeDraftFormBasePayload({
        ...body,
        status: body.status || "draft",
    });
    if (!baseResult.ok) {
        return NextResponse.json({ error: baseResult.error }, { status: 400 });
    }

    const versionResult = normalizeDraftFormVersionPayload({
        title: body.title,
        description: body.description ?? null,
        fields: body.fields ?? [],
        settings: body.settings ?? DEFAULT_FORM_SETTINGS,
        resultConfig: body.resultConfig,
    });
    if (!versionResult.ok) {
        return NextResponse.json({ error: versionResult.error }, { status: 400 });
    }

    const { title, slug, description, visibility, allowedUserIds } = baseResult.value;
    const draftPayload = versionResult.value;

    const existing = await pool.query(`SELECT id FROM forms WHERE slug = $1`, [slug]);
    if (existing.rows.length > 0) {
        return NextResponse.json({ error: "该 slug 已被使用" }, { status: 409 });
    }

    const result = await pool.query(
        `INSERT INTO forms
            (title, description, slug, visibility, allowed_user_ids, status, draft_payload, created_by)
         VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7)
         RETURNING id, slug, status`,
        [
            title,
            description,
            slug,
            visibility,
            visibility === "members" ? allowedUserIds : [],
            JSON.stringify(draftPayload),
            session.user.id,
        ],
    );

    invalidateFormCache([slug]);

    return NextResponse.json({ form: result.rows[0] }, { status: 201 });
}
