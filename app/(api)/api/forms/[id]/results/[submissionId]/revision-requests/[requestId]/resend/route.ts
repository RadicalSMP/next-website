import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { invalidateSubmissionCache } from "@/lib/cache";
import { sendRevisionRequestNotification } from "@/lib/form-notifications";
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
    const body = await request.json().catch(() => null) as unknown;
    const clientRequestId = body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).clientRequestId
        : null;
    if (typeof clientRequestId !== "string" || clientRequestId.trim().length < 8) {
        return NextResponse.json({ error: "缺少有效的重发请求标识" }, { status: 400 });
    }

    const notification = await sendRevisionRequestNotification({
        submissionId,
        formId: id,
        revisionRequestId: requestId,
        actorId: session.user.id,
        manual: true,
        clientRequestId,
    });
    invalidateSubmissionCache();

    if (notification.status === "not_found") {
        return NextResponse.json({ error: notification.error }, { status: 404 });
    }
    if (notification.status === "failed") {
        return NextResponse.json({ error: "补交通知发送失败", notification }, { status: 502 });
    }
    if (notification.status === "skipped") {
        return NextResponse.json({ error: notification.error || "补交通知未发送" }, { status: 409 });
    }
    return NextResponse.json({ notification });
}
