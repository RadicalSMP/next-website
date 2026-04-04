import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { headers } from "next/headers";
import { getFormSubmissions, invalidateSubmissionCache, invalidateReviewCache } from "@/lib/cache";

// ─── 管理员鉴权 ──────────────────────────────────────────
async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

// ─── GET /api/forms/[id]/submissions — 提交列表（管理员） ──
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(0, parseInt(searchParams.get("page") || "0"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    const data = await getFormSubmissions(id, page, limit);
    return NextResponse.json(data);
}

// ─── POST /api/forms/[id]/submissions — 提交表单 ──────────
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    // 获取表单定义
    const formResult = await pool.query(
        `SELECT * FROM forms WHERE id = $1 AND status = 'active'`,
        [id],
    );
    if (formResult.rows.length === 0) {
        return NextResponse.json({ error: "表单不存在或已关闭" }, { status: 404 });
    }

    const form = formResult.rows[0];

    // 权限校验
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null);

    if (form.visibility === "authenticated" && !session?.user) {
        return NextResponse.json({ error: "需要登录后才能填写此表单" }, { status: 401 });
    }
    if (form.visibility === "members") {
        if (!session?.user) {
            return NextResponse.json({ error: "需要登录后才能填写此表单" }, { status: 401 });
        }
        const allowedIds: string[] = form.allowed_user_ids || [];
        if (allowedIds.length > 0 && !allowedIds.includes(session.user.id)) {
            return NextResponse.json({ error: "您没有权限填写此表单" }, { status: 403 });
        }
    }

    const body = await request.json();
    const { data, fingerprint, duration } = body;

    if (!data || typeof data !== "object") {
        return NextResponse.json({ error: "提交数据不能为空" }, { status: 400 });
    }

    // 校验必填字段
    const fields = form.fields as Array<{
        key: string;
        label: string;
        type: string;
        required?: boolean;
    }>;
    for (const field of fields) {
        if (field.required) {
            const value = data[field.key];
            if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
                return NextResponse.json(
                    { error: `「${field.label}」为必填项` },
                    { status: 400 },
                );
            }
        }
    }

    // 已登录用户记录账号邮箱，未登录则为 null
    const userEmail = session?.user?.email || null;
    const userId = session?.user?.id || null;

    // 提取客户端元数据
    const ipAddress =
        reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        reqHeaders.get("x-real-ip") ||
        null;
    const userAgent = reqHeaders.get("user-agent") || null;

    const result = await pool.query(
        `INSERT INTO form_submissions (form_id, user_id, user_email, data, ip_address, user_agent, fingerprint, duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
            id,
            userId,
            userEmail,
            JSON.stringify(data),
            ipAddress,
            userAgent,
            fingerprint || null,
            typeof duration === "number" ? Math.round(duration) : null,
        ],
    );

    invalidateSubmissionCache();

    // ─── 自动评分（入服申请表单） ─────────────────────────
    if (form.slug === "join-application") {
        try {
            await autoScoreSubmission(
                result.rows[0].id,
                data,
                fields,
                typeof duration === "number" ? Math.round(duration) : null,
                userAgent,
            );
            invalidateReviewCache();
        } catch (err) {
            console.error("自动评分失败:", err);
            // 不阻断提交流程
        }
    }

    return NextResponse.json({ submission: result.rows[0] }, { status: 201 });
}

// ─── 自动评分逻辑 ─────────────────────────────────────────

/**
 * 判断 UA 是否为常见浏览器
 */
function isNormalBrowserUA(ua: string | null): boolean {
    if (!ua || ua.trim().length === 0) return false;
    // 常见浏览器标识
    const browserPatterns = [
        /Mozilla\/.*AppleWebKit/i,      // Chrome, Safari, Edge, Opera
        /Mozilla\/.*Gecko.*Firefox/i,    // Firefox
        /Mozilla\/.*Trident/i,           // IE
        /Opera\//i,
        /OPR\//i,
    ];
    // 排除明显的非浏览器 UA
    const botPatterns = [
        /bot/i, /crawler/i, /spider/i, /curl/i, /wget/i, /httpie/i,
        /postman/i, /insomnia/i, /python-requests/i, /axios/i, /node-fetch/i,
        /go-http-client/i, /java\//i, /okhttp/i,
    ];
    const isBot = botPatterns.some((p) => p.test(ua));
    if (isBot) return false;
    return browserPatterns.some((p) => p.test(ua));
}

/**
 * 对入服申请提交自动计算基础分和客观题分
 */
async function autoScoreSubmission(
    submissionId: string,
    data: Record<string, unknown>,
    formFields: Array<{ key: string; label: string; type: string; options?: string[] }>,
    duration: number | null,
    userAgent: string | null,
) {
    // 获取评分规则
    const rulesResult = await pool.query(
        `SELECT * FROM review_scoring_rules WHERE form_slug = 'join-application' LIMIT 1`,
    );
    if (rulesResult.rows.length === 0) return;

    const rules = rulesResult.rows[0];

    // 1. 作答时间分
    let durationScore = 0;
    if (
        duration !== null &&
        duration >= (rules.duration_threshold as number)
    ) {
        durationScore = rules.duration_score as number;
    }

    // 2. UA 检测分
    let uaScore = 0;
    if (isNormalBrowserUA(userAgent)) {
        uaScore = rules.ua_score as number;
    }

    // 3. 客观题分
    let objectiveScore = 0;
    const objectiveDetail: Record<string, { got: number; max: number }> = {};
    const objectiveRules = (rules.objective_rules || []) as Array<{
        field_key: string;
        correct_answer: string | boolean;
        score: number;
    }>;

    for (const rule of objectiveRules) {
        const answer = data[rule.field_key];
        let got = 0;
        if (typeof rule.correct_answer === "boolean") {
            if (!!answer === rule.correct_answer) got = rule.score;
        } else {
            if (
                String(answer ?? "").trim().toLowerCase() ===
                String(rule.correct_answer).trim().toLowerCase()
            ) {
                got = rule.score;
            }
        }
        objectiveScore += got;
        objectiveDetail[rule.field_key] = { got, max: rule.score };
    }

    // 计算最大可能分（不含 AI 分，AI 分稍后手动触发）
    const objectiveMax = objectiveRules.reduce((sum, r) => sum + r.score, 0);
    const maxPossible =
        (rules.duration_score as number) +
        (rules.ua_score as number) +
        objectiveMax +
        (rules.ai_max_score as number);
    const totalScore = durationScore + uaScore + objectiveScore;

    await pool.query(
        `INSERT INTO submission_scores
            (submission_id, duration_score, ua_score, objective_score, objective_detail,
             total_score, max_possible_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (submission_id) DO UPDATE SET
            duration_score = $2,
            ua_score = $3,
            objective_score = $4,
            objective_detail = $5,
            total_score = EXCLUDED.total_score + COALESCE(submission_scores.ai_score, 0),
            max_possible_score = $7,
            updated_at = NOW()`,
        [
            submissionId,
            durationScore,
            uaScore,
            objectiveScore,
            JSON.stringify(objectiveDetail),
            totalScore,
            maxPossible,
        ],
    );
}
