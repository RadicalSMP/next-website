import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { headers } from "next/headers";
import {
    getReviewConfig,
    invalidateReviewConfigCache,
    invalidateReviewRulesCache,
} from "@/lib/cache";

// ─── 管理员鉴权 ──────────────────────────────────────────
async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

// ─── GET /api/forms/review/config — 获取评分规则 ─────────
export async function GET() {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { rules, formFields } = await getReviewConfig("join-application");

    return NextResponse.json({ rules, formFields });
}

// ─── PUT /api/forms/review/config — 更新评分规则 ─────────
export async function PUT(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const body = await request.json();
    const {
        duration_threshold,
        duration_score,
        ua_score,
        ai_prompt,
        ai_max_score,
        objective_rules,
    } = body;

    await pool.query(
        `INSERT INTO review_scoring_rules
            (form_slug, duration_threshold, duration_score, ua_score, ai_prompt, ai_max_score, objective_rules, updated_at)
         VALUES ('join-application', $1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (form_slug) DO UPDATE SET
            duration_threshold = $1,
            duration_score = $2,
            ua_score = $3,
            ai_prompt = $4,
            ai_max_score = $5,
            objective_rules = $6,
            updated_at = NOW()`,
        [
            duration_threshold ?? 60,
            duration_score ?? 10,
            ua_score ?? 10,
            ai_prompt ?? null,
            ai_max_score ?? 50,
            JSON.stringify(objective_rules ?? []),
        ],
    );

    invalidateReviewRulesCache();
    invalidateReviewConfigCache();

    return NextResponse.json({ success: true });
}
