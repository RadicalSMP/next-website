/**
 * 表单系统破坏性迁移脚本
 *
 * 用法: bun run scripts/migrate-forms.ts
 *
 * 当前项目处于 dev 阶段，本脚本会重建表单相关表：
 *   - forms: 表单主表
 *   - form_versions: 发布版本快照
 *   - form_submissions: 提交记录
 */

import { Pool } from "pg";

async function migrate() {
    if (!process.env.DATABASE_URL) {
        console.error("缺少 DATABASE_URL 环境变量");
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    console.log("开始重建表单系统表...");

    await pool.query("BEGIN");

    try {
        await pool.query(`
            DROP TABLE IF EXISTS "submission_reviews" CASCADE;
            DROP TABLE IF EXISTS "submission_scores" CASCADE;
            DROP TABLE IF EXISTS "review_scoring_rules" CASCADE;
            DROP TABLE IF EXISTS "form_submissions" CASCADE;
            DROP TABLE IF EXISTS "form_versions" CASCADE;
            DROP TABLE IF EXISTS "forms" CASCADE;
        `);

        await pool.query(`
            CREATE TABLE "forms" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "title" TEXT NOT NULL,
                "description" TEXT,
                "slug" VARCHAR(96) UNIQUE NOT NULL,
                "visibility" TEXT NOT NULL DEFAULT 'public'
                    CHECK ("visibility" IN ('public', 'authenticated', 'members')),
                "allowed_user_ids" TEXT[] NOT NULL DEFAULT '{}',
                "status" TEXT NOT NULL DEFAULT 'draft'
                    CHECK ("status" IN ('draft', 'published', 'archived')),
                "draft_payload" JSONB NOT NULL DEFAULT '{}',
                "current_version_id" UUID,
                "created_by" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE "form_versions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "form_id" UUID NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
                "version" INTEGER NOT NULL,
                "title" TEXT NOT NULL,
                "description" TEXT,
                "fields" JSONB NOT NULL DEFAULT '[]',
                "settings" JSONB NOT NULL DEFAULT '{}',
                "published_by" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
                "published_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE ("form_id", "version")
            );
        `);

        await pool.query(`
            ALTER TABLE "forms"
            ADD CONSTRAINT "forms_current_version_id_fkey"
            FOREIGN KEY ("current_version_id") REFERENCES "form_versions"("id") ON DELETE SET NULL;
        `);

        await pool.query(`
            CREATE TABLE "form_submissions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "form_id" UUID NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
                "form_version_id" UUID NOT NULL REFERENCES "form_versions"("id") ON DELETE RESTRICT,
                "user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
                "user_email" TEXT,
                "data" JSONB NOT NULL DEFAULT '{}',
                "field_snapshot" JSONB NOT NULL DEFAULT '[]',
                "status" TEXT NOT NULL DEFAULT 'submitted'
                    CHECK ("status" IN ('submitted', 'flagged', 'archived')),
                "ip_address" TEXT,
                "user_agent" TEXT,
                "fingerprint" TEXT,
                "duration" INTEGER,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE INDEX "idx_forms_slug" ON "forms"("slug");
            CREATE INDEX "idx_forms_status" ON "forms"("status");
            CREATE INDEX "idx_forms_current_version_id" ON "forms"("current_version_id");
            CREATE INDEX "idx_form_versions_form_id" ON "form_versions"("form_id");
            CREATE INDEX "idx_form_submissions_form_id" ON "form_submissions"("form_id");
            CREATE INDEX "idx_form_submissions_version_id" ON "form_submissions"("form_version_id");
            CREATE INDEX "idx_form_submissions_status" ON "form_submissions"("status");
            CREATE INDEX "idx_form_submissions_created_at" ON "form_submissions"("created_at" DESC);
        `);

        await pool.query("COMMIT");
        console.log("表单系统表重建完成");
    } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
    } finally {
        await pool.end();
    }
}

migrate().catch((error) => {
    console.error("迁移失败:", error);
    process.exit(1);
});
