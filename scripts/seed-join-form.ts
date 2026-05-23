/**
 * 入服申请表种子脚本
 *
 * 用法: bun run scripts/seed-join-form.ts
 */

import { Pool } from "pg";

async function seed() {
    if (!process.env.DATABASE_URL) {
        console.error("缺少 DATABASE_URL 环境变量");
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        const adminUserId = process.env.ADMIN_USER_ID || (await findAdminUserId(pool));
        if (!adminUserId) {
            console.error("未找到 admin 用户");
            process.exit(1);
        }

        const existing = await pool.query(`SELECT id FROM forms WHERE slug = 'join-application'`);
        if (existing.rows.length > 0) {
            console.log("入服申请表已存在，跳过创建");
            return;
        }

        const draftPayload = {
            title: "入服申请",
            description: "欢迎申请加入 RadicalSMP！请认真填写以下信息，我们会尽快处理。",
            fields: [
                { key: "mcid", label: "Minecraft ID", type: "text", required: true, enabled: true, placeholder: "你的游戏 ID", helpText: "", defaultValue: "", options: [], validation: {} },
                { key: "qq", label: "QQ 号", type: "text", required: true, enabled: true, placeholder: "用于联系你的 QQ 号码", helpText: "", defaultValue: "", options: [], validation: {} },
                { key: "intro", label: "自我介绍", type: "textarea", required: true, enabled: true, placeholder: "简单介绍一下你自己，让我们了解你", helpText: "", defaultValue: "", options: [], validation: {} },
                { key: "experience", label: "游戏经验", type: "textarea", required: false, enabled: true, placeholder: "你的 Minecraft 游戏经验（可选）", helpText: "", defaultValue: "", options: [], validation: {} },
                { key: "source", label: "如何知道本服务器", type: "text", required: true, enabled: true, placeholder: "你是从哪里了解到 RadicalSMP 的？", helpText: "", defaultValue: "", options: [], validation: {} },
            ],
            settings: {
                submitLabel: "提交申请",
                successMessage: "提交成功，我们会尽快处理你的申请。",
                introText: "请认真填写以下信息。",
            },
        };

        const formResult = await pool.query(
            `INSERT INTO forms
                (title, description, slug, visibility, status, draft_payload, created_by)
             VALUES ($1, $2, $3, 'public', 'draft', $4, $5)
             RETURNING id`,
            [
                "入服申请",
                "欢迎申请加入 RadicalSMP！请认真填写以下信息，我们会尽快处理。",
                "join-application",
                JSON.stringify(draftPayload),
                adminUserId,
            ],
        );

        const formId = formResult.rows[0].id as string;
        const versionResult = await pool.query(
            `INSERT INTO form_versions
                (form_id, version, title, description, fields, settings, published_by)
             VALUES ($1, 1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
                formId,
                draftPayload.title,
                draftPayload.description,
                JSON.stringify(draftPayload.fields),
                JSON.stringify(draftPayload.settings),
                adminUserId,
            ],
        );

        await pool.query(
            `UPDATE forms SET status = 'published', current_version_id = $1, updated_at = NOW() WHERE id = $2`,
            [versionResult.rows[0].id, formId],
        );

        console.log("入服申请表已创建并发布");
        console.log("访问地址: /forms/join-application");
    } finally {
        await pool.end();
    }
}

async function findAdminUserId(pool: Pool) {
    const result = await pool.query(`SELECT id FROM "user" WHERE role = 'admin' LIMIT 1`);
    return result.rows[0]?.id ?? null;
}

seed().catch((error) => {
    console.error("种子创建失败:", error);
    process.exit(1);
});
