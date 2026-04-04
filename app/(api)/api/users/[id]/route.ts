import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { invalidateUserCache } from "@/lib/cache";

// ─── 管理员鉴权 ──────────────────────────────────────────
async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

// ─── PUT /api/users/[id] — 用户操作（管理员） ─────────────
// body.action: "setRole" | "ban" | "unban"
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { id: userId } = await params;
    const body = await request.json();
    const { action } = body;

    const reqHeaders = await headers();

    try {
        switch (action) {
            case "setRole": {
                const { role } = body;
                if (!role || !["admin", "user"].includes(role)) {
                    return NextResponse.json({ error: "无效角色" }, { status: 400 });
                }
                await auth.api.setRole({ headers: reqHeaders, body: { userId, role } });
                break;
            }
            case "ban": {
                const { banReason, banExpiresIn } = body;
                await auth.api.banUser({
                    headers: reqHeaders,
                    body: {
                        userId,
                        ...(banReason ? { banReason } : {}),
                        ...(banExpiresIn ? { banExpiresIn } : {}),
                    },
                });
                break;
            }
            case "unban": {
                await auth.api.unbanUser({ headers: reqHeaders, body: { userId } });
                break;
            }
            default:
                return NextResponse.json({ error: "未知操作" }, { status: 400 });
        }

        invalidateUserCache();
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(`用户操作失败 (${action}):`, err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "操作失败" },
            { status: 500 },
        );
    }
}

// ─── DELETE /api/users/[id] — 删除用户（管理员） ──────────
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { id: userId } = await params;
    const reqHeaders = await headers();

    try {
        await auth.api.removeUser({ headers: reqHeaders, body: { userId } });
        invalidateUserCache();
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("删除用户失败:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "删除失败" },
            { status: 500 },
        );
    }
}
