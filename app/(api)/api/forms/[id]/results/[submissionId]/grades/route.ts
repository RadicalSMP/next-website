import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { invalidateSubmissionCache } from "@/lib/cache";
import { isSameOriginMutation } from "@/lib/form-submission-access";
import { sendGradingCompletedNotification } from "@/lib/form-notifications";

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
    if (!isSameOriginMutation(request)) {
        return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
    }

    const { id, submissionId } = await params;
    const body = await request.json().catch(() => null) as unknown;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return NextResponse.json({ error: "请求数据格式无效" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const revisionId = typeof payload.revisionId === "string" ? payload.revisionId.trim() : "";
    const grades = Array.isArray(payload.grades) ? payload.grades as GradeInput[] : [];
    const overallComment = typeof payload.overallComment === "string" ? payload.overallComment.trim() : null;

    if (!revisionId) {
        return NextResponse.json({ error: "缺少当前修订编号" }, { status: 400 });
    }
    if (grades.length === 0) {
        return NextResponse.json({ error: "没有可保存的批改内容" }, { status: 400 });
    }

    const client = await pool.connect();
    let notification: Awaited<ReturnType<typeof sendGradingCompletedNotification>> | null = null;
    try {
        await client.query("BEGIN");

        const submissionResult = await client.query(
            `SELECT id, form_id, current_revision_id, grading_status, total_score, max_score
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
        if (!submission.current_revision_id || submission.current_revision_id !== revisionId) {
            await client.query("ROLLBACK");
            return NextResponse.json({
                error: "结果已产生新修订，请刷新后重新批改",
                code: "revision_conflict",
                currentRevisionId: submission.current_revision_id ?? null,
            }, { status: 409 });
        }

        const gradeRowsResult = await client.query(
            `SELECT field_key, max_score, grading_type
             FROM submission_grades
             WHERE submission_id = $1 AND revision_id = $2
             FOR UPDATE`,
            [submissionId, revisionId],
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

            const updateResult = await client.query(
                `UPDATE submission_grades
                 SET score = $1,
                     comment = $2,
                     graded_by = $3,
                     graded_at = NOW(),
                     updated_at = NOW()
                 WHERE submission_id = $4
                   AND revision_id = $5
                   AND field_key = $6
                   AND grading_type = 'manual'`,
                [
                    score,
                    typeof grade.comment === "string" ? grade.comment.trim() || null : null,
                    session.user.id,
                    submissionId,
                    revisionId,
                    fieldKey,
                ],
            );
            if (updateResult.rowCount !== 1) {
                await client.query("ROLLBACK");
                return NextResponse.json({
                    error: "当前修订的批改记录已变化，请刷新后重试",
                    code: "revision_conflict",
                    currentRevisionId: revisionId,
                }, { status: 409 });
            }
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
             WHERE submission_id = $1 AND revision_id = $2`,
            [submissionId, revisionId],
        );
        const aggregate = aggregateResult.rows[0];
        const nextGradingStatus = aggregate.grade_count === 0
            ? "not_required"
            : aggregate.required_manual_missing_count > 0
                ? "manual_required"
                : aggregate.manual_count > 0
                    ? "graded"
                    : "auto_graded";

        const projectionUpdate = await client.query(
            `UPDATE form_submissions
             SET grading_status = $1,
                 total_score = $2,
                 max_score = $3
             WHERE id = $4 AND current_revision_id = $5`,
            [nextGradingStatus, aggregate.total_score, aggregate.max_score, submissionId, revisionId],
        );
        if (projectionUpdate.rowCount !== 1) {
            await client.query("ROLLBACK");
            return NextResponse.json({
                error: "结果已产生新修订，请刷新后重新批改",
                code: "revision_conflict",
                currentRevisionId: revisionId,
            }, { status: 409 });
        }

        await client.query(
            `INSERT INTO submission_events
                (submission_id, form_id, event_type, action, revision_id,
                 from_status, to_status, note, score, max_score, actor_id, metadata)
             VALUES ($1, $2, 'grading', 'manual_grade_saved', $3,
                     $4, $5, $6, $7, $8, $9, $10)`,
            [
                submissionId,
                id,
                revisionId,
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
        if (submission.grading_status === "manual_required" && nextGradingStatus === "graded") {
            try {
                notification = await sendGradingCompletedNotification({
                    submissionId,
                    formId: id,
                    revisionId,
                    actorId: session.user.id,
                });
            } catch (error) {
                notification = {
                    status: "failed",
                    notificationId: null,
                    error: error instanceof Error ? error.message : "创建批改通知失败",
                };
            }
        }
        invalidateSubmissionCache({ submissionId, includeRevisions: true });

        return NextResponse.json({
            revisionId,
            gradingStatus: nextGradingStatus,
            totalScore: Number(aggregate.total_score),
            maxScore: Number(aggregate.max_score),
            notification,
        });
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
