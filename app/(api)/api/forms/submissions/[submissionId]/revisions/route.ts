import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { invalidateSubmissionCache } from "@/lib/cache";
import { pool } from "@/lib/db";
import {
    authorizeSubmissionAccess,
    getSubmissionAccessCookieName,
    isSameOriginMutation,
} from "@/lib/form-submission-access";
import { FormRevisionError, submitRevision } from "@/lib/form-revisions";
import { getUserSubmissionDetail, isFormSubmissionId } from "@/lib/form-submission-user";
import { verifyCapToken } from "@/lib/cap";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ submissionId: string }> },
) {
    if (!isSameOriginMutation(request)) {
        return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
    }
    const { submissionId } = await params;
    if (!isFormSubmissionId(submissionId)) {
        return NextResponse.json({ error: "提交编号无效" }, { status: 400 });
    }
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(getSubmissionAccessCookieName(submissionId))?.value ?? null;
    const role = session?.user
        ? String((session.user as Record<string, unknown>).role ?? "user")
        : null;
    const access = await authorizeSubmissionAccess({
        submissionId,
        actor: session?.user ? { userId: session.user.id, role } : null,
        accessToken,
    });
    if (!access.canView) {
        const status = access.reason === "token_expired" ? 410 : access.reason === "not_found" ? 404 : 403;
        return NextResponse.json({ error: "无权访问该提交" }, { status });
    }
    if (!access.canRevise || !access.revisionRequestId) {
        const detail = await getUserSubmissionDetail(submissionId);
        const expired = detail?.activeRequest?.expiresAt &&
            new Date(detail.activeRequest.expiresAt).getTime() <= Date.now();
        return NextResponse.json(
            { error: expired ? "补交请求已过期" : "当前没有可用的补交请求" },
            { status: expired ? 410 : 409 },
        );
    }

    const body = await request.json().catch(() => null) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ error: "请求数据格式无效" }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const capVerification = await verifyCapToken(payload.captchaToken);
    if (!capVerification.success) {
        return NextResponse.json(
            { error: capVerification.message },
            { status: capVerification.unavailable ? 503 : 400 },
        );
    }

    const data = payload.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return NextResponse.json({ error: "补交数据不能为空" }, { status: 400 });
    }

    const reqHeaders = await headers();
    const ipAddress = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        reqHeaders.get("x-real-ip") ||
        null;
    const userAgent = reqHeaders.get("user-agent") || null;
    const fingerprint = typeof payload.fingerprint === "string"
        ? payload.fingerprint.slice(0, 256)
        : null;
    const duration = typeof payload.duration === "number" && Number.isFinite(payload.duration)
        ? Math.max(0, Math.round(payload.duration))
        : null;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await submitRevision(client, {
            submissionId,
            requestId: access.revisionRequestId,
            data: data as Record<string, unknown>,
            submittedBy: access.source === "account" ? session?.user.id ?? null : null,
            submittedVia: access.source === "account" ? "account" : "token",
            ipAddress,
            userAgent,
            fingerprint,
            duration,
        });
        await client.query("COMMIT");
        invalidateSubmissionCache({
            submissionId,
            userId: session?.user.id,
            includeRevisions: true,
        });
        return NextResponse.json(result, { status: 201 });
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
