import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { invalidateSubmissionCache } from "@/lib/cache";

type GradeInput = {
    fieldKey?: unknown;
    score?: unknown;
    comment?: unknown;
};

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

function parseScore(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; submissionId: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { id, submissionId } = await params;
    const body = await request.json().catch(() => null) as unknown;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return NextResponse.json({ error: "请求数据格式无效" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const grades = Array.isArray(payload.grades) ? payload.grades as GradeInput[] : [];
    const overallComment = typeof payload.overallComment === "string" ? payload.overallComment.trim() : null;

    if (grades.length === 0) {
        return NextResponse.json({ error: "没有可保存的批改内容" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const submissionResult = await client.query(
            `SELECT id, form_id, grading_status, total_score, max_score
             FROM form_submissions
             WHERE id = $1 AND form_id = $2
             FOR UPDATE`,
            [submissionId, id],
        );
        const submission = submissionResult.rows[0];
        if (!submission) {
            await client.query("ROLLBACK");
            return NextResponse.json({ error: "结果不存在" }, { status: 404 });
        }

        const gradeRowsResult = await client.query(
            `SELECT field_key, max_score, grading_type
             FROM submission_grades
             WHERE submission_id = $1
             FOR UPDATE`,
            [submissionId],
        );
        const gradeRows = new Map<string, { max_score: string | number; grading_type: string }>(
            gradeRowsResult.rows.map((row) => [row.field_key, row]),
        );

        for (const grade of grades) {
            const fieldKey = typeof grade.fieldKey === "string" ? grade.fieldKey : "";
            const row = gradeRows.get(fieldKey);
            if (!row) {
                await client.query("ROLLBACK");
                return NextResponse.json({ error: `字段「${fieldKey}」没有批改记录` }, { status: 400 });
            }
            if (row.grading_type !== "manual") {
                await client.query("ROLLBACK");
                return NextResponse.json({ error: `字段「${fieldKey}」不是主观题` }, { status: 400 });
            }

            const score = parseScore(grade.score);
            const maxScore = Number(row.max_score);
            if (score === null || score < 0 || score > maxScore) {
                await client.query("ROLLBACK");
                return NextResponse.json({ error: `字段「${fieldKey}」分数必须在 0 到 ${maxScore} 之间` }, { status: 400 });
            }

            await client.query(
                `UPDATE submission_grades
                 SET score = $1,
                     comment = $2,
                     graded_by = $3,
                     graded_at = NOW(),
                     updated_at = NOW()
                 WHERE submission_id = $4 AND field_key = $5 AND grading_type = 'manual'`,
                [
                    score,
                    typeof grade.comment === "string" ? grade.comment.trim() || null : null,
                    session.user.id,
                    submissionId,
                    fieldKey,
                ],
            );
        }

        const aggregateResult = await client.query(
            `SELECT
                COUNT(*)::int AS grade_count,
                COUNT(*) FILTER (WHERE grading_type = 'manual')::int AS manual_count,
                COUNT(*) FILTER (
                    WHERE grading_type = 'manual'
                      AND COALESCE((rule_snapshot->>'requiredManual')::boolean, false) = true
                      AND score IS NULL
                )::int AS required_manual_missing_count,
                COALESCE(SUM(COALESCE(score, 0)), 0)::numeric AS total_score,
                COALESCE(SUM(max_score), 0)::numeric AS max_score
             FROM submission_grades
             WHERE submission_id = $1`,
            [submissionId],
        );
        const aggregate = aggregateResult.rows[0];
        const nextGradingStatus = aggregate.grade_count === 0
            ? "not_required"
            : aggregate.required_manual_missing_count > 0
                ? "manual_required"
                : aggregate.manual_count > 0
                    ? "graded"
                    : "auto_graded";

        await client.query(
            `UPDATE form_submissions
             SET grading_status = $1,
                 total_score = $2,
                 max_score = $3
             WHERE id = $4`,
            [nextGradingStatus, aggregate.total_score, aggregate.max_score, submissionId],
        );

        await client.query(
            `INSERT INTO submission_events
                (submission_id, form_id, event_type, action, from_status, to_status, note, score, max_score, actor_id, metadata)
             VALUES ($1, $2, 'grading', 'manual_grade_saved', $3, $4, $5, $6, $7, $8, $9)`,
            [
                submissionId,
                id,
                submission.grading_status,
                nextGradingStatus,
                overallComment,
                aggregate.total_score,
                aggregate.max_score,
                session.user.id,
                JSON.stringify({ changedFields: grades.map((grade) => grade.fieldKey).filter(Boolean) }),
            ],
        );

        await client.query("COMMIT");
        invalidateSubmissionCache();

        return NextResponse.json({
            gradingStatus: nextGradingStatus,
            totalScore: Number(aggregate.total_score),
            maxScore: Number(aggregate.max_score),
        });
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
