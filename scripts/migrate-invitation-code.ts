/**
 * 邀请码表迁移脚本
 *
 * 用法: bun run scripts/migrate-invitation-code.ts
 *
 * 创建两张表:
 *   - invitation_code: 邀请码主表
 *   - invitation_code_usage: 邀请码使用记录表
 */

import { Pool } from "pg";

async function migrate() {
    if (!process.env.DATABASE_URL) {
        console.error("❌ 缺少 DATABASE_URL 环境变量");
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    console.log("🔄 开始创建邀请码相关表...\n");

    await pool.query(`
        CREATE TABLE IF NOT EXISTS "invitation_code" (
            "id"            TEXT PRIMARY KEY,
            "code"          VARCHAR(32) UNIQUE NOT NULL,
            "maxUses"       INTEGER NOT NULL DEFAULT 1,
            "uses"          INTEGER NOT NULL DEFAULT 0,
            "allowedEmails" TEXT[],
            "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
            "expiresAt"     TIMESTAMP
        );
    `);
    console.log("  ✅ invitation_code 表已创建");

    await pool.query(`
        CREATE TABLE IF NOT EXISTS "invitation_code_usage" (
            "id"        TEXT PRIMARY KEY,
            "codeId"    TEXT NOT NULL REFERENCES "invitation_code"("id") ON DELETE CASCADE,
            "userId"    TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
            "email"     TEXT NOT NULL,
            "usedAt"    TIMESTAMP NOT NULL DEFAULT NOW()
        );
    `);
    console.log("  ✅ invitation_code_usage 表已创建");

    // 为常用查询创建索引
    await pool.query(`
        CREATE INDEX IF NOT EXISTS "idx_invitation_code_code" ON "invitation_code"("code");
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS "idx_invitation_code_usage_codeId" ON "invitation_code_usage"("codeId");
    `);
    console.log("  ✅ 索引已创建");

    await pool.end();
    console.log("\n🎉 邀请码表迁移完成！");
}

migrate().catch((err) => {
    console.error("❌ 迁移失败:", err);
    process.exit(1);
});
