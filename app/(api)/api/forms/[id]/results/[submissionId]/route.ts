import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getResultDetail } from "@/lib/cache";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string; submissionId: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { id, submissionId } = await params;
    const detail = await getResultDetail(id, submissionId);
    if (!detail) {
        return NextResponse.json({ error: "结果不存在" }, { status: 404 });
    }

    return NextResponse.json(detail);
}
