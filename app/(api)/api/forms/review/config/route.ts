import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { headers } from "next/headers";
import { getReviewScoringRules, invalidateReviewRulesCache } from "@/lib/cache";

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

    const rules = await getReviewScoringRules("join-application");

    // 同时返回表单字段定义（供前端配置客观题规则时使用）
    let formFields: unknown[] = [];
    try {
        const formResult = await pool.query(
            `SELECT fields FROM forms WHERE slug = 'join-application' LIMIT 1`,
        );
        if (formResult.rows.length > 0) {
            formFields = formResult.rows[0].fields || [];
        }
    } catch {
        // 忽略
    }

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

    return NextResponse.json({ success: true });
}
