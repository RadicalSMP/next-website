import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { invalidateSubmissionCache } from "@/lib/cache";
import { isSameOriginMutation } from "@/lib/form-submission-access";
import { retrySubmissionNotification } from "@/lib/form-notifications";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") return null;
    return session;
}

export async function POST(
    request: NextRequest,
    { params }: {
        params: Promise<{
            id: string;
            submissionId: string;
            notificationId: string;
        }>;
    },
) {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: "未授权" }, { status: 403 });
    if (!isSameOriginMutation(request)) {
        return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
    }

    const { id, submissionId, notificationId } = await params;
    const notification = await retrySubmissionNotification({
        submissionId,
        formId: id,
        notificationId,
        actorId: session.user.id,
    });
    invalidateSubmissionCache();

    if (notification.status === "not_found") {
        return NextResponse.json({ error: notification.error }, { status: 404 });
    }
    if (notification.status === "failed") {
        return NextResponse.json({ error: "通知重试失败", notification }, { status: 502 });
    }
    if (notification.status === "skipped" || notification.status === "sending") {
        return NextResponse.json({ error: notification.error || "通知当前不可重试", notification }, { status: 409 });
    }
    return NextResponse.json({ notification });
}
