import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import {
    compareRevisions,
    getRevisionHistory,
} from "@/lib/form-revisions";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; submissionId: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { id, submissionId } = await params;
    const exists = await pool.query(
        `SELECT 1 FROM form_submissions WHERE id = $1 AND form_id = $2`,
        [submissionId, id],
    );
    if (exists.rows.length === 0) {
        return NextResponse.json({ error: "提交结果不存在" }, { status: 404 });
    }

    const client = await pool.connect();
    try {
        const revisions = await getRevisionHistory(client, submissionId);
        const { searchParams } = new URL(request.url);
        const fromId = searchParams.get("from");
        const toId = searchParams.get("to");
        const fromRevision = fromId ? revisions.find((revision) => revision.id === fromId) : null;
        const toRevision = toId ? revisions.find((revision) => revision.id === toId) : null;
        const comparison = fromRevision && toRevision
            ? compareRevisions(fromRevision, toRevision)
            : null;

        return NextResponse.json({ revisions, comparison });
    } finally {
        client.release();
    }
}
