/**
 * 通用表单系统迁移脚本
 *
 * 用法: bun run scripts/migrate-forms.ts
 *
 * 创建两张表:
 *   - forms: 表单定义表（字段结构、可见性等）
 *   - form_submissions: 表单提交记录表（含客户端元数据）
 */

import { Pool } from "pg";

async function migrate() {
    if (!process.env.DATABASE_URL) {
        console.error("❌ 缺少 DATABASE_URL 环境变量");
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    console.log("🔄 开始创建表单系统相关表...\n");

    // ─── 表单定义表 ────────────────────────────────────────
    await pool.query(`
        CREATE TABLE IF NOT EXISTS "forms" (
            "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "title"             TEXT NOT NULL,
            "description"       TEXT,
            "slug"              VARCHAR(64) UNIQUE NOT NULL,
            "fields"            JSONB NOT NULL DEFAULT '[]',
            "visibility"        TEXT NOT NULL DEFAULT 'public',
            "allowed_user_ids"  TEXT[] DEFAULT '{}',
            "status"            TEXT NOT NULL DEFAULT 'active',
            "created_by"        TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
            "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);
    console.log("  ✅ forms 表已创建");

    // ─── 表单提交记录表 ────────────────────────────────────
    await pool.query(`
        CREATE TABLE IF NOT EXISTS "form_submissions" (
            "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "form_id"       UUID NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
            "user_id"       TEXT REFERENCES "user"("id") ON DELETE SET NULL,
            "user_email"    TEXT,
            "data"          JSONB NOT NULL DEFAULT '{}',
            "ip_address"    TEXT,
            "user_agent"    TEXT,
            "fingerprint"   TEXT,
            "duration"      INTEGER,
            "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);
    console.log("  ✅ form_submissions 表已创建");

    // ─── 增量迁移：为已有表添加新列（安全幂等） ────────────
    const addColumnIfNotExists = async (table: string, column: string, type: string) => {
        await pool.query(`
            DO $$ BEGIN
                ALTER TABLE "${table}" ADD COLUMN "${column}" ${type};
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END $$;
        `);
    };

    await addColumnIfNotExists("form_submissions", "ip_address", "TEXT");
    await addColumnIfNotExists("form_submissions", "user_agent", "TEXT");
    await addColumnIfNotExists("form_submissions", "fingerprint", "TEXT");
    await addColumnIfNotExists("form_submissions", "duration", "INTEGER");
    console.log("  ✅ 元数据列已确认存在");

    // ─── 索引 ──────────────────────────────────────────────
    await pool.query(`
        CREATE INDEX IF NOT EXISTS "idx_forms_slug" ON "forms"("slug");
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS "idx_forms_status" ON "forms"("status");
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS "idx_form_submissions_form_id" ON "form_submissions"("form_id");
    `);
    console.log("  ✅ 索引已创建");

    await pool.end();
    console.log("\n🎉 表单系统表迁移完成！");
}

migrate().catch((err) => {
    console.error("❌ 迁移失败:", err);
    process.exit(1);
});
