/**
 * 入服申请表种子数据脚本
 *
 * 用法: bun run scripts/seed-join-form.ts
 *
 * 创建预设的「入服申请」表单（需要先运行 migrate-forms.ts）。
 * 需要传入 admin 用户的 ID 作为创建者。
 *
 * 可通过环境变量 ADMIN_USER_ID 指定，或自动查询第一个 admin 用户。
 */

import { Pool } from "pg";

async function seed() {
    if (!process.env.DATABASE_URL) {
        console.error("❌ 缺少 DATABASE_URL 环境变量");
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // 获取 admin 用户 ID
    let adminUserId = process.env.ADMIN_USER_ID;

    if (!adminUserId) {
        console.log("🔍 未指定 ADMIN_USER_ID，正在查询 admin 用户...");
        const result = await pool.query(
            `SELECT id, name FROM "user" WHERE role = 'admin' LIMIT 1`,
        );
        if (result.rows.length === 0) {
            console.error("❌ 未找到 admin 用户，请先创建一个管理员账号");
            await pool.end();
            process.exit(1);
        }
        adminUserId = result.rows[0].id;
        console.log(`  找到 admin 用户: ${result.rows[0].name} (${adminUserId})`);
    }

    // 检查是否已存在
    const existing = await pool.query(
        `SELECT id FROM forms WHERE slug = 'join-application'`,
    );
    if (existing.rows.length > 0) {
        console.log("⚠️  入服申请表已存在，跳过创建");
        await pool.end();
        return;
    }

    // 创建入服申请表
    const fields = [
        {
            key: "mcid",
            label: "Minecraft ID",
            type: "text",
            required: true,
            placeholder: "你的游戏 ID",
        },
        {
            key: "qq",
            label: "QQ 号",
            type: "text",
            required: true,
            placeholder: "用于联系你的 QQ 号码",
        },
        {
            key: "intro",
            label: "自我介绍",
            type: "textarea",
            required: true,
            placeholder: "简单介绍一下你自己，让我们了解你",
        },
        {
            key: "experience",
            label: "游戏经验",
            type: "textarea",
            required: false,
            placeholder: "你的 Minecraft 游戏经验（可选）",
        },
        {
            key: "source",
            label: "如何知道本服务器",
            type: "text",
            required: true,
            placeholder: "你是从哪里了解到 RadicalSMP 的？",
        },
    ];

    await pool.query(
        `INSERT INTO forms (title, description, slug, fields, visibility, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
            "入服申请",
            "欢迎申请加入 RadicalSMP！请认真填写以下信息，我们会尽快审核。",
            "join-application",
            JSON.stringify(fields),
            "public",
            "active",
            adminUserId,
        ],
    );

    console.log("✅ 入服申请表已创建");
    console.log("   访问地址: /forms/join-application");

    await pool.end();
    console.log("\n🎉 种子数据创建完成！");
}

seed().catch((err) => {
    console.error("❌ 种子数据创建失败:", err);
    process.exit(1);
});
