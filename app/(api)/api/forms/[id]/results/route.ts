import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getResultList } from "@/lib/cache";

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
    const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const data = await getResultList(
        page,
        limit,
        searchParams.get("query") || "",
        id,
        searchParams.get("status") || "all",
        searchParams.get("gradingStatus") || "all",
        searchParams.get("processingStatus") || "all",
        searchParams.get("scoreFilter") || "all",
        searchParams.get("collectionLabel") || "all",
        searchParams.get("revisionStatus") || "all",
        searchParams.get("revisionCountFilter") || "all",
    );

    return NextResponse.json(data);
}
