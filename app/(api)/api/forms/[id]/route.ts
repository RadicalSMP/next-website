import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { headers } from "next/headers";
import {
    getAdminFormById,
    getFormVersions,
    invalidateFormCache,
} from "@/lib/cache";
import {
    DEFAULT_FORM_SETTINGS,
    normalizeDraftFormBasePayload,
    normalizeDraftFormVersionPayload,
} from "@/lib/forms";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { id } = await params;
    const form = await getAdminFormById(id);

    if (!form) {
        return NextResponse.json({ error: "表单不存在" }, { status: 404 });
    }

    let allowedUsers: { id: string; name: string; email: string; image: string | null }[] = [];
    const ids: string[] = form.allowed_user_ids || [];
    if (ids.length > 0) {
        const userResult = await pool.query(
            `SELECT id, name, email, image FROM "user" WHERE id = ANY($1::text[])`,
            [ids],
        );
        allowedUsers = userResult.rows;
    }

    const versions = await getFormVersions(id);

    return NextResponse.json({ form, allowedUsers, versions });
}

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

    const previousResult = await pool.query(
        `SELECT id, slug FROM forms WHERE id = $1`,
        [id],
    );
    if (previousResult.rows.length === 0) {
        return NextResponse.json({ error: "表单不存在" }, { status: 404 });
    }

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

    const { title, slug, description, visibility, allowedUserIds, status } = baseResult.value;
    const previousSlug = previousResult.rows[0].slug as string;

    const slugConflict = await pool.query(
        `SELECT id FROM forms WHERE slug = $1 AND id != $2`,
        [slug, id],
    );
    if (slugConflict.rows.length > 0) {
        return NextResponse.json({ error: "该 slug 已被使用" }, { status: 409 });
    }

    const result = await pool.query(
        `UPDATE forms SET
            title = $1,
            description = $2,
            slug = $3,
            visibility = $4,
            allowed_user_ids = $5,
            status = CASE
                WHEN current_version_id IS NULL THEN 'draft'
                ELSE $6
            END,
            draft_payload = $7,
            updated_at = NOW()
         WHERE id = $8
         RETURNING id, slug, status`,
        [
            title,
            description,
            slug,
            visibility,
            visibility === "members" ? allowedUserIds : [],
            status === "archived" ? "archived" : "published",
            JSON.stringify(versionResult.value),
            id,
        ],
    );

    invalidateFormCache([previousSlug, slug]);

    return NextResponse.json({ form: result.rows[0] });
}

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

    return NextResponse.json({ success: true });
}
