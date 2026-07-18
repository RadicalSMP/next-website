import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { invalidateSubmissionCache } from "@/lib/cache";
import { pool } from "@/lib/db";
import {
    cancelRevisionRequest,
    FormRevisionError,
} from "@/lib/form-revisions";
import { isSameOriginMutation } from "@/lib/form-submission-access";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; submissionId: string; requestId: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }
    if (!isSameOriginMutation(request)) {
        return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
    }

    const { id, submissionId, requestId } = await params;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const revisionRequest = await cancelRevisionRequest(client, {
            submissionId,
            requestId,
            formId: id,
            cancelledBy: session.user.id,
        });
        await client.query("COMMIT");
        invalidateSubmissionCache({ submissionId });
        return NextResponse.json({ request: revisionRequest });
    } catch (error) {
        await client.query("ROLLBACK");
        if (error instanceof FormRevisionError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }
        throw error;
    } finally {
        client.release();
    }
}
