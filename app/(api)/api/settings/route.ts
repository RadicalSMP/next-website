import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettingsMaskedCached, invalidateSettingsCache } from "@/lib/cache";
import { setSetting } from "@/lib/settings";
import { validateAiSettings } from "@/lib/security/settings";

// ─── 管理员鉴权 ──────────────────────────────────────────
async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

// ─── GET /api/settings — 获取系统设置（敏感值脱敏） ──────
export async function GET() {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const settings = await getSettingsMaskedCached("ai.");
    return NextResponse.json({
        settings: Object.fromEntries(
            Object.entries(settings).filter(([key]) => ["ai.api_key", "ai.base_url", "ai.model"].includes(key)),
        ),
    });
}

// ─── PUT /api/settings — 更新系统设置 ────────────────────
export async function PUT(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const body = await request.json();
    const validation = validateAiSettings((body as Record<string, unknown>).settings);
    if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    for (const config of validation.value) {
        await setSetting(config.key, config.value, config.encrypted);
    }

    invalidateSettingsCache();

    return NextResponse.json({ success: true });
}
