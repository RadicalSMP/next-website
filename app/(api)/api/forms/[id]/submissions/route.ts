import { NextRequest, NextResponse } from "next/server";
import type { QueryResult } from "pg";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { headers } from "next/headers";
import {
    getFormSubmissions,
    invalidateSubmissionCache,
} from "@/lib/cache";
import {
    buildSubmissionGradeResult,
    normalizeFormFields,
    normalizeResultConfig,
    validateSubmissionValues,
} from "@/lib/forms";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

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
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "all";
    const gradingStatus = searchParams.get("gradingStatus") || "all";
    const processingStatus = searchParams.get("processingStatus") || "all";

    const data = await getFormSubmissions(id, page, limit, query, status, gradingStatus, processingStatus);
    return NextResponse.json(data);
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    const formResult = await pool.query(
        `SELECT f.id, f.visibility, f.allowed_user_ids, f.status,
                fv.id AS version_id, fv.fields, fv.result_config
         FROM forms f
         INNER JOIN form_versions fv ON fv.id = f.current_version_id
         WHERE f.id = $1 AND f.status = 'published'`,
        [id],
    );
    if (formResult.rows.length === 0) {
        return NextResponse.json({ error: "表单不存在或未发布" }, { status: 404 });
    }

    const form = formResult.rows[0];
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
    const data = body.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return NextResponse.json({ error: "提交数据不能为空" }, { status: 400 });
    }

    const fields = normalizeFormFields(form.fields);
    const resultConfig = normalizeResultConfig(form.result_config, fields);
    const validation = validateSubmissionValues(fields, data as Record<string, unknown>);
    if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const gradeResult = buildSubmissionGradeResult(fields, validation.value, resultConfig);

    const ipAddress =
        reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        reqHeaders.get("x-real-ip") ||
        null;
    const userAgent = reqHeaders.get("user-agent") || null;
    const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint : null;
    const duration = typeof body.duration === "number" ? Math.round(body.duration) : null;

    const client = await pool.connect();
    let result: QueryResult<{ id: string }>;
    try {
        await client.query("BEGIN");

        result = await client.query(
            `INSERT INTO form_submissions
                (form_id, form_version_id, user_id, user_email, data, field_snapshot,
                 grading_status, total_score, max_score, processing_status,
                 ip_address, user_agent, fingerprint, duration)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING id`,
            [
                id,
                form.version_id,
                session?.user?.id || null,
                session?.user?.email || null,
                JSON.stringify(validation.value),
                JSON.stringify(fields),
                gradeResult.gradingStatus,
                gradeResult.totalScore,
                gradeResult.maxScore,
                gradeResult.processingStatus,
                ipAddress,
                userAgent,
                fingerprint,
                duration,
            ],
        );

        const submissionId = result.rows[0].id as string;
        const revisionResult = await client.query<{ id: string }>(
            `INSERT INTO form_submission_revisions
                (submission_id, revision_number, data, field_snapshot, submitted_by, submitted_via,
                 ip_address, user_agent, fingerprint, duration)
             VALUES ($1, 1, $2, $3, $4, 'initial', $5, $6, $7, $8)
             RETURNING id`,
            [
                submissionId,
                JSON.stringify(validation.value),
                JSON.stringify(fields),
                session?.user?.id || null,
                ipAddress,
                userAgent,
                fingerprint,
                duration,
            ],
        );
        const revisionId = revisionResult.rows[0].id;

        await client.query(
            `UPDATE form_submissions
             SET current_revision_id = $1,
                 revision_count = 1
             WHERE id = $2`,
            [revisionId, submissionId],
        );

        for (const grade of gradeResult.grades) {
            await client.query(
                `INSERT INTO submission_grades
                    (submission_id, revision_id, field_key, field_label, field_type, answer, expected_answer,
                     score, max_score, grading_type, matched, comment, rule_snapshot, graded_by, graded_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                [
                    submissionId,
                    revisionId,
                    grade.fieldKey,
                    grade.fieldLabel,
                    grade.fieldType,
                    JSON.stringify(grade.answer),
                    JSON.stringify(grade.expectedAnswer),
                    grade.score,
                    grade.maxScore,
                    grade.gradingType,
                    grade.matched,
                    grade.comment,
                    JSON.stringify(grade.ruleSnapshot),
                    grade.gradedBy,
                    grade.gradedAt,
                ],
            );
        }

        await client.query(
            `INSERT INTO submission_events
                (submission_id, form_id, event_type, action, revision_id, to_status,
                 score, max_score, actor_id, metadata)
             VALUES ($1, $2, 'submission', 'created', $3, $4, $5, $6, $7, $8)`,
            [
                submissionId,
                id,
                revisionId,
                gradeResult.processingStatus,
                gradeResult.totalScore,
                gradeResult.maxScore,
                session?.user?.id || null,
                JSON.stringify({
                    gradingStatus: gradeResult.gradingStatus,
                    processingStatus: gradeResult.processingStatus,
                    resultLabel: resultConfig.collection.label,
                    gradingEnabled: resultConfig.grading.enabled,
                    processingEnabled: resultConfig.processing.enabled,
                }),
            ],
        );

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

    invalidateSubmissionCache({
        submissionId: result.rows[0].id,
        userId: session?.user?.id,
        includeRevisions: true,
    });

    return NextResponse.json({ submission: result.rows[0] }, { status: 201 });
}
