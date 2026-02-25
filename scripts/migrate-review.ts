/**
 * 入服审核评分系统迁移脚本
 *
 * 用法: bun run scripts/migrate-review.ts
 *
 * 创建四张表:
 *   - system_settings:      全局系统设置（key-value，支持加密）
 *   - review_scoring_rules: 评分规则配置
 *   - submission_scores:    评分结果
 *   - submission_reviews:   审核记录
 */

import { Pool } from "pg";

async function migrate() {
    if (!process.env.DATABASE_URL) {
        console.error("\u274c \u7f3a\u5c11 DATABASE_URL \u73af\u5883\u53d8\u91cf");
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    console.log("\ud83d\udd04 \u5f00\u59cb\u521b\u5efa\u5165\u670d\u5ba1\u6838\u8bc4\u5206\u7cfb\u7edf\u76f8\u5173\u8868...\n");

    // ─── 系统设置表 ────────────────────────────────────────
    await pool.query(`
        CREATE TABLE IF NOT EXISTS "system_settings" (
            "key"         VARCHAR(128) PRIMARY KEY,
            "value"       TEXT NOT NULL,
            "encrypted"   BOOLEAN NOT NULL DEFAULT FALSE,
            "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);
    console.log("  \u2705 system_settings \u8868\u5df2\u521b\u5efa");

    // ─── 评分规则配置表 ────────────────────────────────────
    await pool.query(`
        CREATE TABLE IF NOT EXISTS "review_scoring_rules" (
            "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "form_slug"            VARCHAR(64) NOT NULL DEFAULT 'join-application',
            "duration_threshold"   INTEGER NOT NULL DEFAULT 60,
            "duration_score"       INTEGER NOT NULL DEFAULT 10,
            "ua_score"             INTEGER NOT NULL DEFAULT 10,
            "ai_prompt"            TEXT,
            "ai_max_score"         INTEGER NOT NULL DEFAULT 50,
            "objective_rules"      JSONB NOT NULL DEFAULT '[]',
            "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE("form_slug")
        );
    `);
    console.log("  \u2705 review_scoring_rules \u8868\u5df2\u521b\u5efa");

    // ─── 评分结果表 ────────────────────────────────────────
    await pool.query(`
        CREATE TABLE IF NOT EXISTS "submission_scores" (
            "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "submission_id"        UUID NOT NULL REFERENCES "form_submissions"("id") ON DELETE CASCADE,
            "duration_score"       INTEGER NOT NULL DEFAULT 0,
            "ua_score"             INTEGER NOT NULL DEFAULT 0,
            "objective_score"      INTEGER NOT NULL DEFAULT 0,
            "objective_detail"     JSONB DEFAULT '{}',
            "ai_score"             INTEGER,
            "ai_detail"            JSONB,
            "ai_scored_at"         TIMESTAMPTZ,
            "total_score"          INTEGER NOT NULL DEFAULT 0,
            "max_possible_score"   INTEGER NOT NULL DEFAULT 0,
            "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE("submission_id")
        );
    `);
    console.log("  \u2705 submission_scores \u8868\u5df2\u521b\u5efa");

    // ─── 审核记录表 ────────────────────────────────────────
    await pool.query(`
        CREATE TABLE IF NOT EXISTS "submission_reviews" (
            "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "submission_id"   UUID NOT NULL REFERENCES "form_submissions"("id") ON DELETE CASCADE,
            "reviewer_id"     TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
            "status"          TEXT NOT NULL CHECK ("status" IN ('approved', 'rejected')),
            "note"            TEXT,
            "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE("submission_id")
        );
    `);
    console.log("  \u2705 submission_reviews \u8868\u5df2\u521b\u5efa");

    // ─── 索引 ──────────────────────────────────────────────
    await pool.query(`
        CREATE INDEX IF NOT EXISTS "idx_submission_scores_submission_id"
        ON "submission_scores"("submission_id");
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS "idx_submission_reviews_submission_id"
        ON "submission_reviews"("submission_id");
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS "idx_submission_reviews_status"
        ON "submission_reviews"("status");
    `);
    console.log("  \u2705 \u7d22\u5f15\u5df2\u521b\u5efa");

    // ─── 插入默认评分规则（如果不存在） ────────────────────
    await pool.query(`
        INSERT INTO "review_scoring_rules" ("form_slug", "ai_prompt")
        VALUES ('join-application', '\u4f60\u662f\u4e00\u4e2a Minecraft \u670d\u52a1\u5668\u7684\u5165\u670d\u7533\u8bf7\u5ba1\u6838\u5458\u3002\u8bf7\u6839\u636e\u7533\u8bf7\u8005\u7684\u56de\u7b54\u8bc4\u4f30\u5176\u771f\u8bda\u5ea6\u3001\u8868\u8fbe\u80fd\u529b\u548c\u5bf9\u793e\u533a\u7684\u9002\u5408\u5ea6\u3002\u8bf7\u7ed9\u51fa 0 \u5230 {max_score} \u7684\u8bc4\u5206\uff0c\u5e76\u7b80\u8981\u8bf4\u660e\u7406\u7531\u3002')
        ON CONFLICT ("form_slug") DO NOTHING;
    `);
    console.log("  \u2705 \u9ed8\u8ba4\u8bc4\u5206\u89c4\u5219\u5df2\u63d2\u5165");

    await pool.end();
    console.log("\n\ud83c\udf89 \u5165\u670d\u5ba1\u6838\u8bc4\u5206\u7cfb\u7edf\u8868\u8fc1\u79fb\u5b8c\u6210\uff01");
}

migrate().catch((err) => {
    console.error("\u274c \u8fc1\u79fb\u5931\u8d25:", err);
    process.exit(1);
});
