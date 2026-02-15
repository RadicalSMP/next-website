/**
 * 种子脚本 — 创建开发环境测试账号
 *
 * 用法: bun run seed
 *
 * 会创建两个账号:
 *   - 普通用户: test@radicalsmp.com / Test@123456
 *   - 管理员:   admin@radicalsmp.com / Admin@123456
 *
 * 注意: Bun 会自动加载 .env / .env.local，无需额外配置 dotenv。
 */

import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { Pool } from "pg";

// ─── 测试账号配置 ───────────────────────────────────────────
const TEST_ACCOUNTS = [
    {
        email: "test@radicalsmp.com",
        password: "Test@123456",
        name: "测试用户",
        role: "user" as const,
    },
    {
        email: "admin@radicalsmp.com",
        password: "Admin@123456",
        name: "管理员",
        role: "admin" as const,
    },
];

// ─── 主函数 ─────────────────────────────────────────────────
async function seed() {
    if (process.env.NODE_ENV === "production") {
        console.error("❌ 种子脚本不允许在生产环境运行");
        process.exit(1);
    }

    if (!process.env.DATABASE_URL) {
        console.error("❌ 缺少 DATABASE_URL 环境变量");
        console.error("   请复制 .env.example 到 .env.local 并填入数据库连接串");
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // 最小化的 auth 实例，不含 nextCookies / 邮件验证 / Resend
    // 仅用于创建用户（密码哈希由 better-auth 处理）
    const seedAuth = betterAuth({
        database: pool,
        emailAndPassword: {
            enabled: true,
            minPasswordLength: 8,
            maxPasswordLength: 128,
        },
        plugins: [admin()],
        user: {
            additionalFields: {
                mcid: { type: "string[]", required: false, input: false },
                qq: { type: "string[]", required: false, input: false },
            },
        },
    });

    console.log("🌱 开始创建测试账号...\n");

    for (const account of TEST_ACCOUNTS) {
        try {
            await seedAuth.api.signUpEmail({
                body: {
                    email: account.email,
                    password: account.password,
                    name: account.name,
                },
            });
            console.log(`  ✅ 已创建: ${account.name} <${account.email}>`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("already") || msg.includes("exist") || msg.includes("unique")) {
                console.log(`  ⏭️  已存在: ${account.name} <${account.email}>`);
            } else {
                console.error(`  ❌ 创建失败: ${account.email} — ${msg}`);
            }
        }
    }

    // 标记邮箱已验证 + 设置管理员角色
    const emails = TEST_ACCOUNTS.map((a) => a.email);
    const adminEmails = TEST_ACCOUNTS.filter((a) => a.role === "admin").map((a) => a.email);

    await pool.query(
        `UPDATE "user" SET "emailVerified" = true WHERE "email" = ANY($1)`,
        [emails],
    );

    if (adminEmails.length > 0) {
        await pool.query(
            `UPDATE "user" SET "role" = 'admin' WHERE "email" = ANY($1)`,
            [adminEmails],
        );
    }

    console.log("\n  ✅ 邮箱已标记为已验证");
    console.log("  ✅ 管理员角色已设置");

    console.log("\n📋 测试账号一览:");
    console.log("  ┌─────────────────────────────────────────────────┐");
    for (const account of TEST_ACCOUNTS) {
        const role = account.role === "admin" ? "👑 管理员" : "👤 普通用户";
        console.log(`  │ ${role}`);
        console.log(`  │   邮箱: ${account.email}`);
        console.log(`  │   密码: ${account.password}`);
        console.log("  │");
    }
    console.log("  └─────────────────────────────────────────────────┘");

    await pool.end();
    console.log("\n🎉 种子数据创建完成！");
}

seed().catch((err) => {
    console.error("❌ 种子脚本执行失败:", err);
    process.exit(1);
});
