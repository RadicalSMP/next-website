import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    authorizeSubmissionAccess,
    getSubmissionAccessCookieName,
} from "@/lib/form-submission-access";
import { getUserSubmissionDetail, isFormSubmissionId } from "@/lib/form-submission-user";

function accessErrorResponse(reason: string, hasIdentity: boolean) {
    if (reason === "not_found") {
        return NextResponse.json({ error: "提交结果不存在" }, { status: 404 });
    }
    if (reason === "token_expired") {
        return NextResponse.json({ error: "访问授权已过期" }, { status: 410 });
    }
    if (reason === "token_invalid" || reason === "scope_missing") {
        return NextResponse.json({ error: "访问授权无效" }, { status: 401 });
    }
    return NextResponse.json(
        { error: hasIdentity ? "你无权查看该提交" : "请登录或使用邮件中的访问链接" },
        { status: hasIdentity ? 403 : 401 },
    );
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ submissionId: string }> },
) {
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
        return accessErrorResponse(access.reason, Boolean(session?.user || accessToken));
    }

    const detail = await getUserSubmissionDetail(submissionId);
    if (!detail) {
        return NextResponse.json({ error: "提交结果不存在" }, { status: 404 });
    }
    return NextResponse.json({
        ...detail,
        access: {
            source: access.source,
            canRevise: access.canRevise,
            revisionRequestId: access.revisionRequestId,
        },
    }, {
        headers: { "Cache-Control": "private, no-store" },
    });
}
