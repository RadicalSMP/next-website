import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettingsMaskedCached, invalidateSettingsCache } from "@/lib/cache";
import { setSetting } from "@/lib/settings";

// ─── 管理员鉴权 ──────────────────────────────────────────
async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

// ─── GET /api/settings — 获取系统设置（敏感值脱敏） ──────
export async function GET(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get("prefix") || "ai.";

    const settings = await getSettingsMaskedCached(prefix);
    return NextResponse.json({ settings });
}

// ─── PUT /api/settings — 更新系统设置 ────────────────────
export async function PUT(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const body = await request.json();
    const { settings } = body as {
        settings: Record<string, { value: string; encrypted?: boolean }>;
    };

    if (!settings || typeof settings !== "object") {
        return NextResponse.json({ error: "参数错误" }, { status: 400 });
    }

    // 只允许特定前缀
    const allowedPrefixes = ["ai."];
    for (const key of Object.keys(settings)) {
        if (!allowedPrefixes.some((p) => key.startsWith(p))) {
            return NextResponse.json(
                { error: `不允许修改设置项: ${key}` },
                { status: 400 },
            );
        }
    }

    for (const [key, config] of Object.entries(settings)) {
        // 跳过脱敏值（未修改的加密字段）
        if (config.value.includes("...") && config.encrypted) {
            continue;
        }
        await setSetting(key, config.value, config.encrypted ?? false);
    }

    invalidateSettingsCache();

    return NextResponse.json({ success: true });
}
