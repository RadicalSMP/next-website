/**
 * 表单补交闭环回归夹具
 *
 * 用法: bun run seed:test-form-resubmission
 */

import { Pool, type PoolClient } from "pg";

const slug = "test-form-resubmission";

const fields = [
    {
        key: "email",
        label: "联系邮箱",
        type: "email",
        required: true,
        enabled: true,
        placeholder: "name@example.com",
        helpText: "",
        defaultValue: "",
        options: [],
        validation: {},
    },
    {
        key: "objective",
        label: "客观题",
        type: "radio",
        required: true,
        enabled: true,
        placeholder: "",
        helpText: "请选择正确选项",
        defaultValue: "",
        options: [
            { label: "选项 A", value: "a" },
            { label: "选项 B", value: "b" },
        ],
        validation: {},
    },
    {
        key: "subjective",
        label: "主观题",
        type: "textarea",
        required: true,
        enabled: true,
        placeholder: "请输入说明",
        helpText: "",
        defaultValue: "",
        options: [],
        validation: {},
    },
];

const settings = {
    submitLabel: "提交测试结果",
    successMessage: "测试提交成功。",
    introText: "用于补交与通知闭环回归。",
};

const resultConfig = {
    collection: {
        enabled: true,
        label: "补交回归",
        allowAnonymous: true,
    },
    grading: {
        enabled: true,
        mode: "mixed",
        rules: [
            {
                fieldKey: "objective",
                enabled: true,
                gradingType: "auto",
                correctAnswer: "b",
                maxScore: 5,
                matchStrategy: "exact",
                requiredManual: false,
                prompt: "",
            },
            {
                fieldKey: "subjective",
                enabled: true,
                gradingType: "manual",
                correctAnswer: null,
                maxScore: 10,
                matchStrategy: "exact",
                requiredManual: true,
                prompt: "请根据完整性评分",
            },
        ],
    },
    processing: {
        enabled: true,
        statuses: ["pending", "approved", "rejected", "needs_changes"],
        defaultStatus: "pending",
    },
    notifications: {
        enabled: true,
        template: "score_result",
        recipient: {
            source: "mapped_field",
            fieldKey: "email",
        },
        autoSend: false,
        events: {
            revisionRequested: true,
            gradingCompleted: true,
            processingChanged: true,
        },
        content: {
            includeQuestionScores: true,
            includeComments: true,
            includeCorrectAnswers: false,
        },
    },
    fieldMappings: {
        email: "email",
        playerName: null,
        qq: null,
        mcid: null,
    },
};

async function createSubmission(
    client: PoolClient,
    formId: string,
    versionId: string,
    user: { id: string; email: string } | null,
    marker: string,
) {
    const data = {
        email: user?.email ?? "anonymous-test@example.invalid",
        objective: "b",
        subjective: user ? "登录用户主观题测试答案" : "匿名用户主观题测试答案",
    };
    const submissionResult = await client.query<{ id: string }>(
        `INSERT INTO form_submissions
            (form_id, form_version_id, user_id, user_email, data, field_snapshot,
             grading_status, total_score, max_score, processing_status, fingerprint, duration)
         VALUES ($1, $2, $3, $4, $5, $6, 'manual_required', 5, 15, 'pending', $7, 30)
         RETURNING id`,
        [
            formId,
            versionId,
            user?.id ?? null,
            user?.email ?? null,
            JSON.stringify(data),
            JSON.stringify(fields),
            marker,
        ],
    );
    const submissionId = submissionResult.rows[0].id;
    const revisionResult = await client.query<{ id: string }>(
        `INSERT INTO form_submission_revisions
            (submission_id, revision_number, data, field_snapshot, submitted_by, submitted_via,
             fingerprint, duration)
         VALUES ($1, 1, $2, $3, $4, 'initial', $5, 30)
         RETURNING id`,
        [submissionId, JSON.stringify(data), JSON.stringify(fields), user?.id ?? null, marker],
    );
    const revisionId = revisionResult.rows[0].id;

    await client.query(
        `UPDATE form_submissions SET current_revision_id = $1 WHERE id = $2`,
        [revisionId, submissionId],
    );

    await client.query(
        `INSERT INTO submission_grades
            (submission_id, revision_id, field_key, field_label, field_type, answer,
             expected_answer, score, max_score, grading_type, matched, rule_snapshot, graded_at)
         VALUES
            ($1, $2, 'objective', '客观题', 'radio', $3, $4, 5, 5, 'auto', TRUE, $5, NOW()),
            ($1, $2, 'subjective', '主观题', 'textarea', $6, NULL, NULL, 10, 'manual', NULL, $7, NULL)`,
        [
            submissionId,
            revisionId,
            JSON.stringify(data.objective),
            JSON.stringify("b"),
            JSON.stringify(resultConfig.grading.rules[0]),
            JSON.stringify(data.subjective),
            JSON.stringify(resultConfig.grading.rules[1]),
        ],
    );

    await client.query(
        `INSERT INTO submission_events
            (submission_id, form_id, event_type, action, revision_id, to_status,
             score, max_score, actor_id, metadata)
         VALUES ($1, $2, 'submission', 'created', $3, 'pending', 5, 15, $4, $5)`,
        [
            submissionId,
            formId,
            revisionId,
            user?.id ?? null,
            JSON.stringify({ fixture: true, gradingStatus: "manual_required" }),
        ],
    );
}

async function seed() {
    if (!process.env.DATABASE_URL) {
        throw new Error("缺少 DATABASE_URL 环境变量");
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const adminResult = await client.query<{ id: string; email: string }>(
            `SELECT id, email
             FROM "user"
             WHERE role = 'admin'
               AND ($1::TEXT IS NULL OR id = $1)
             LIMIT 1`,
            [process.env.ADMIN_USER_ID || null],
        );
        if (adminResult.rows.length === 0) {
            throw new Error("未找到管理员账号，无法创建登录用户回归夹具");
        }
        const admin = adminResult.rows[0];

        await client.query(`DELETE FROM forms WHERE slug = $1`, [slug]);
        const draftPayload = {
            title: "补交闭环回归表单",
            description: "仅用于开发环境自动化回归。",
            fields,
            settings,
            resultConfig,
        };
        const formResult = await client.query<{ id: string }>(
            `INSERT INTO forms
                (title, description, slug, visibility, status, draft_payload, created_by)
             VALUES ($1, $2, $3, 'public', 'draft', $4, $5)
             RETURNING id`,
            [
                draftPayload.title,
                draftPayload.description,
                slug,
                JSON.stringify(draftPayload),
                admin.id,
            ],
        );
        const formId = formResult.rows[0].id;
        const versionResult = await client.query<{ id: string }>(
            `INSERT INTO form_versions
                (form_id, version, title, description, fields, settings, result_config, published_by)
             VALUES ($1, 1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
                formId,
                draftPayload.title,
                draftPayload.description,
                JSON.stringify(fields),
                JSON.stringify(settings),
                JSON.stringify(resultConfig),
                admin.id,
            ],
        );
        const versionId = versionResult.rows[0].id;
        await client.query(
            `UPDATE forms SET current_version_id = $1, status = 'published' WHERE id = $2`,
            [versionId, formId],
        );

        await createSubmission(client, formId, versionId, admin, "test-resubmission-account");
        await createSubmission(client, formId, versionId, null, "test-resubmission-anonymous");

        await client.query("COMMIT");
        console.log(`补交回归夹具已创建: /forms/${slug}`);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch((error) => {
    console.error("补交回归夹具创建失败:", error);
    process.exit(1);
});
