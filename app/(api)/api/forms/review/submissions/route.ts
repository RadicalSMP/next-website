import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getReviewSubmissions } from "@/lib/review-cache";

// ─── 管理员鉴权 ──────────────────────────────────────────
async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

// ─── GET /api/forms/review/submissions — 审核提交列表 ────
export async function GET(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(0, parseInt(searchParams.get("page") || "0"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const status = searchParams.get("status") as
        | "pending"
        | "approved"
        | "rejected"
        | null;

    const data = await getReviewSubmissions(
        page,
        limit,
        status || undefined,
    );

    return NextResponse.json(data);
}
