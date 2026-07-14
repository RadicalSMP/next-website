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
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const formResult = await client.query(
            `SELECT id, title, description, slug, draft_payload
             FROM forms
             WHERE id = $1
             FOR UPDATE`,
            [id],
        );

        if (formResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return NextResponse.json({ error: "表单不存在" }, { status: 404 });
        }

        const form = formResult.rows[0];
        const payloadResult = validateFormVersionPayload(form.draft_payload);
        if (!payloadResult.ok) {
            await client.query("ROLLBACK");
            return NextResponse.json({ error: payloadResult.error }, { status: 400 });
        }

        const versionResult = await client.query(
            `INSERT INTO form_versions
                (form_id, version, title, description, fields, settings, result_config, published_by)
             VALUES (
                $1,
                COALESCE((SELECT MAX(version) + 1 FROM form_versions WHERE form_id = $1), 1),
                $2,
                $3,
                $4,
                $5,
                $6,
                $7
             )
             RETURNING id, version, published_at`,
            [
                id,
                payloadResult.value.title,
                payloadResult.value.description,
                JSON.stringify(payloadResult.value.fields),
                JSON.stringify(payloadResult.value.settings),
                JSON.stringify(payloadResult.value.resultConfig),
                session.user.id,
            ],
        );

        await client.query(
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

        await client.query("COMMIT");

        invalidateFormCache([form.slug]);

        return NextResponse.json({ version: versionResult.rows[0] }, { status: 201 });
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
