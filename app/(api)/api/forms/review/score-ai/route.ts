import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { headers } from "next/headers";
import { createOpenAIClient } from "@/lib/openai";
import { invalidateReviewCache } from "@/lib/review-cache";

// ─── 管理员鉴权 ──────────────────────────────────────────
async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

// ─── POST /api/forms/review/score-ai — 触发 AI 评分 ─────
export async function POST(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const body = await request.json();
    const { submission_id } = body;

    if (!submission_id) {
        return NextResponse.json({ error: "缺少 submission_id" }, { status: 400 });
    }

    // 获取提交数据
    const subResult = await pool.query(
        `SELECT fs.*, f.fields AS form_fields
         FROM form_submissions fs
         JOIN forms f ON f.id = fs.form_id
         WHERE fs.id = $1`,
        [submission_id],
    );
    if (subResult.rows.length === 0) {
        return NextResponse.json({ error: "提交不存在" }, { status: 404 });
    }
    const submission = subResult.rows[0];

    // 获取评分规则
    const rulesResult = await pool.query(
        `SELECT * FROM review_scoring_rules WHERE form_slug = 'join-application' LIMIT 1`,
    );
    const rules = rulesResult.rows[0];
    if (!rules) {
        return NextResponse.json({ error: "评分规则未配置" }, { status: 400 });
    }

    // 构建主观题内容（text 和 textarea 类型字段）
    const formFields = submission.form_fields as Array<{
        key: string;
        label: string;
        type: string;
    }>;
    const subjectiveFields = formFields.filter(
        (f) => f.type === "text" || f.type === "textarea",
    );
    const data = submission.data as Record<string, unknown>;

    if (subjectiveFields.length === 0) {
        return NextResponse.json({ error: "没有可评分的主观题" }, { status: 400 });
    }

    // 构建 AI 评分内容
    const answersText = subjectiveFields
        .map((f) => `【${f.label}】\n${data[f.key] || "（未作答）"}`)
        .join("\n\n");

    const systemPrompt = (rules.ai_prompt || "请对以下入服申请回答进行评分。")
        .replace("{max_score}", String(rules.ai_max_score));

    const userPrompt = `以下是申请者的回答：

${answersText}

请以 JSON 格式返回评分结果，格式如下：
{
    "score": <0到${rules.ai_max_score}的整数>,
    "comment": "<简要评语>",
    "details": {
        "<字段label>": {
            "score": <该项得分>,
            "comment": "<该项评语>"
        }
    }
}

只返回 JSON，不要包含其他内容。`;

    try {
        const { client, model } = await createOpenAIClient();

        const completion = await client.chat.completions.create({
            model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
        });

        const responseText = completion.choices[0]?.message?.content || "{}";
        let aiResult: { score?: number; comment?: string; details?: unknown };

        try {
            aiResult = JSON.parse(responseText);
        } catch {
            aiResult = { score: 0, comment: "AI 返回格式异常: " + responseText };
        }

        const aiScore = Math.min(
            Math.max(0, Math.round(Number(aiResult.score) || 0)),
            rules.ai_max_score,
        );

        // 更新评分记录
        const existing = await pool.query(
            `SELECT id, duration_score, ua_score, objective_score, max_possible_score
             FROM submission_scores WHERE submission_id = $1`,
            [submission_id],
        );

        if (existing.rows.length > 0) {
            const row = existing.rows[0];
            const baseTotal =
                row.duration_score + row.ua_score + row.objective_score;
            await pool.query(
                `UPDATE submission_scores SET
                    ai_score = $1,
                    ai_detail = $2,
                    ai_scored_at = NOW(),
                    total_score = $3,
                    max_possible_score = $4,
                    updated_at = NOW()
                 WHERE submission_id = $5`,
                [
                    aiScore,
                    JSON.stringify(aiResult),
                    baseTotal + aiScore,
                    row.max_possible_score,
                    submission_id,
                ],
            );
        } else {
            // 如果还没有评分记录，创建一个（仅含 AI 分）
            await pool.query(
                `INSERT INTO submission_scores
                    (submission_id, ai_score, ai_detail, ai_scored_at, total_score, max_possible_score)
                 VALUES ($1, $2, $3, NOW(), $4, $5)`,
                [
                    submission_id,
                    aiScore,
                    JSON.stringify(aiResult),
                    aiScore,
                    rules.ai_max_score,
                ],
            );
        }

        invalidateReviewCache();

        return NextResponse.json({
            success: true,
            ai_score: aiScore,
            ai_detail: aiResult,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "AI 评分失败";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
