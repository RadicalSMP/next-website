import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { invalidateFormCache } from "@/lib/cache";
import { validateFormVersionPayload } from "@/lib/forms";
import { headers } from "next/headers";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { id } = await params;
    const formResult = await pool.query(
        `SELECT id, title, description, slug, draft_payload
         FROM forms
         WHERE id = $1`,
        [id],
    );

    if (formResult.rows.length === 0) {
        return NextResponse.json({ error: "表单不存在" }, { status: 404 });
    }

    const form = formResult.rows[0];
    const payloadResult = validateFormVersionPayload(form.draft_payload);
    if (!payloadResult.ok) {
        return NextResponse.json({ error: payloadResult.error }, { status: 400 });
    }

    await pool.query("BEGIN");
    try {
        const versionResult = await pool.query(
            `INSERT INTO form_versions
                (form_id, version, title, description, fields, settings, published_by)
             VALUES (
                $1,
                COALESCE((SELECT MAX(version) + 1 FROM form_versions WHERE form_id = $1), 1),
                $2,
                $3,
                $4,
                $5,
                $6
             )
             RETURNING id, version, published_at`,
            [
                id,
                payloadResult.value.title,
                payloadResult.value.description,
                JSON.stringify(payloadResult.value.fields),
                JSON.stringify(payloadResult.value.settings),
                session.user.id,
            ],
        );

        await pool.query(
            `UPDATE forms SET
                title = $1,
                description = $2,
                current_version_id = $3,
                status = 'published',
                updated_at = NOW()
             WHERE id = $4`,
            [
                payloadResult.value.title,
                payloadResult.value.description,
                versionResult.rows[0].id,
                id,
            ],
        );

        await pool.query("COMMIT");

        invalidateFormCache([form.slug]);

        return NextResponse.json({ version: versionResult.rows[0] }, { status: 201 });
    } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
    }
}
