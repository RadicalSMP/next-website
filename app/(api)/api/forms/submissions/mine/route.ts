import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    getUserSubmissionList,
    isUserSubmissionStatusFilter,
} from "@/lib/form-submission-user";

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
    if (!session?.user) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(0, Number.parseInt(searchParams.get("page") || "0", 10) || 0);
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10) || 20));
    const statusValue = searchParams.get("status") || "all";
    if (!isUserSubmissionStatusFilter(statusValue)) {
        return NextResponse.json({ error: "无效的状态筛选" }, { status: 400 });
    }

    const data = await getUserSubmissionList({
        userId: session.user.id,
        page,
        limit,
        status: statusValue,
    });
    return NextResponse.json(data, {
        headers: { "Cache-Control": "private, no-store" },
    });
}
