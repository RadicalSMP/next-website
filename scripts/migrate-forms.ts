/**
 * 表单系统破坏性迁移脚本
 *
 * 用法: bun run scripts/migrate-forms.ts
 *
 * 当前项目处于 dev 阶段，本脚本会重建表单相关表：
 *   - forms: 表单主表
 *   - form_versions: 发布版本快照
 *   - form_submissions: 提交记录
 *   - form_submission_revisions: 不可变答案修订
 *   - submission_revision_requests: 补交请求
 *   - submission_access_tokens: 匿名访问授权
 *   - submission_grades: 逐题批改记录
 *   - submission_notifications: 邮件投递记录
 *   - submission_events: 结果事件历史
 */

import { Pool } from "pg";

async function migrate() {
    if (!process.env.DATABASE_URL) {
        console.error("缺少 DATABASE_URL 环境变量");
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    console.log("开始重建表单系统表...");

    try {
        await client.query("BEGIN");

        await client.query(`
            DROP TABLE IF EXISTS "submission_events" CASCADE;
            DROP TABLE IF EXISTS "submission_notifications" CASCADE;
            DROP TABLE IF EXISTS "submission_access_tokens" CASCADE;
            DROP TABLE IF EXISTS "submission_revision_requests" CASCADE;
            DROP TABLE IF EXISTS "submission_grades" CASCADE;
            DROP TABLE IF EXISTS "form_submission_revisions" CASCADE;
            DROP TABLE IF EXISTS "submission_reviews" CASCADE;
            DROP TABLE IF EXISTS "submission_scores" CASCADE;
            DROP TABLE IF EXISTS "review_scoring_rules" CASCADE;
            DROP TABLE IF EXISTS "form_submissions" CASCADE;
            DROP TABLE IF EXISTS "form_versions" CASCADE;
            DROP TABLE IF EXISTS "forms" CASCADE;
        `);

        await client.query(`
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

        await client.query(`
            CREATE TABLE "form_versions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "form_id" UUID NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
                "version" INTEGER NOT NULL,
                "title" TEXT NOT NULL,
                "description" TEXT,
                "fields" JSONB NOT NULL DEFAULT '[]',
                "settings" JSONB NOT NULL DEFAULT '{}',
                "result_config" JSONB NOT NULL DEFAULT '{"collection":{"enabled":true,"label":"","allowAnonymous":true},"grading":{"enabled":false,"mode":"none","rules":[]},"processing":{"enabled":false,"statuses":["pending","approved","rejected","needs_changes"],"defaultStatus":"pending"},"notifications":{"enabled":false,"template":null,"recipient":{"source":"mapped_field","fieldKey":null},"autoSend":false,"events":{"revisionRequested":true,"gradingCompleted":true,"processingChanged":true},"content":{"includeQuestionScores":true,"includeComments":true,"includeCorrectAnswers":false}},"fieldMappings":{"email":null,"playerName":null,"qq":null,"mcid":null}}',
                "published_by" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
                "published_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE ("form_id", "version")
            );
        `);

        await client.query(`
            ALTER TABLE "forms"
            ADD CONSTRAINT "forms_current_version_id_fkey"
            FOREIGN KEY ("current_version_id") REFERENCES "form_versions"("id") ON DELETE SET NULL;
        `);

        await client.query(`
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
                "grading_status" TEXT NOT NULL DEFAULT 'not_required'
                    CHECK ("grading_status" IN ('not_required', 'auto_graded', 'manual_required', 'graded')),
                "total_score" NUMERIC,
                "max_score" NUMERIC,
                "processing_status" TEXT NOT NULL DEFAULT 'not_required'
                    CHECK ("processing_status" IN ('not_required', 'pending', 'approved', 'rejected', 'needs_changes')),
                "processed_by" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
                "processed_at" TIMESTAMPTZ,
                "processing_note" TEXT,
                "current_revision_id" UUID,
                "active_revision_request_id" UUID,
                "revision_count" INTEGER NOT NULL DEFAULT 1 CHECK ("revision_count" >= 1),
                "revision_status" TEXT NOT NULL DEFAULT 'none'
                    CHECK ("revision_status" IN ('none', 'requested', 'resubmitted')),
                "last_resubmitted_at" TIMESTAMPTZ,
                "ip_address" TEXT,
                "user_agent" TEXT,
                "fingerprint" TEXT,
                "duration" INTEGER,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE "form_submission_revisions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "submission_id" UUID NOT NULL REFERENCES "form_submissions"("id") ON DELETE CASCADE,
                "revision_number" INTEGER NOT NULL CHECK ("revision_number" >= 1),
                "source_request_id" UUID,
                "data" JSONB NOT NULL DEFAULT '{}',
                "field_snapshot" JSONB NOT NULL DEFAULT '[]',
                "submitted_by" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
                "submitted_via" TEXT NOT NULL CHECK ("submitted_via" IN ('initial', 'account', 'token')),
                "ip_address" TEXT,
                "user_agent" TEXT,
                "fingerprint" TEXT,
                "duration" INTEGER,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE ("submission_id", "revision_number")
            );
        `);

        await client.query(`
            CREATE TABLE "submission_revision_requests" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "submission_id" UUID NOT NULL REFERENCES "form_submissions"("id") ON DELETE CASCADE,
                "base_revision_id" UUID NOT NULL REFERENCES "form_submission_revisions"("id") ON DELETE RESTRICT,
                "edit_scope" TEXT NOT NULL CHECK ("edit_scope" IN ('all', 'selected')),
                "editable_field_keys" TEXT[] NOT NULL DEFAULT '{}',
                "reason" TEXT NOT NULL CHECK (LENGTH(BTRIM("reason")) > 0),
                "status" TEXT NOT NULL DEFAULT 'open'
                    CHECK ("status" IN ('open', 'fulfilled', 'cancelled', 'expired')),
                "expires_at" TIMESTAMPTZ,
                "requested_by" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
                "fulfilled_revision_id" UUID REFERENCES "form_submission_revisions"("id") ON DELETE SET NULL,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "fulfilled_at" TIMESTAMPTZ,
                "cancelled_at" TIMESTAMPTZ,
                CHECK ("edit_scope" = 'all' OR CARDINALITY("editable_field_keys") > 0)
            );
        `);

        await client.query(`
            ALTER TABLE "form_submission_revisions"
            ADD CONSTRAINT "form_submission_revisions_source_request_id_fkey"
            FOREIGN KEY ("source_request_id") REFERENCES "submission_revision_requests"("id") ON DELETE SET NULL;

            ALTER TABLE "form_submissions"
            ADD CONSTRAINT "form_submissions_current_revision_id_fkey"
            FOREIGN KEY ("current_revision_id") REFERENCES "form_submission_revisions"("id") ON DELETE SET NULL;

            ALTER TABLE "form_submissions"
            ADD CONSTRAINT "form_submissions_active_revision_request_id_fkey"
            FOREIGN KEY ("active_revision_request_id") REFERENCES "submission_revision_requests"("id") ON DELETE SET NULL;
        `);

        await client.query(`
            CREATE TABLE "submission_access_tokens" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "submission_id" UUID NOT NULL REFERENCES "form_submissions"("id") ON DELETE CASCADE,
                "revision_request_id" UUID REFERENCES "submission_revision_requests"("id") ON DELETE CASCADE,
                "token_hash" TEXT NOT NULL UNIQUE,
                "scopes" TEXT[] NOT NULL,
                "expires_at" TIMESTAMPTZ NOT NULL,
                "last_used_at" TIMESTAMPTZ,
                "consumed_at" TIMESTAMPTZ,
                "revoked_at" TIMESTAMPTZ,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CHECK (CARDINALITY("scopes") > 0),
                CHECK ("scopes" <@ ARRAY['view', 'revise']::TEXT[])
            );
        `);

        await client.query(`
            CREATE TABLE "submission_grades" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "submission_id" UUID NOT NULL REFERENCES "form_submissions"("id") ON DELETE CASCADE,
                "revision_id" UUID NOT NULL REFERENCES "form_submission_revisions"("id") ON DELETE CASCADE,
                "field_key" TEXT NOT NULL,
                "field_label" TEXT NOT NULL,
                "field_type" TEXT NOT NULL,
                "answer" JSONB,
                "expected_answer" JSONB,
                "score" NUMERIC,
                "max_score" NUMERIC NOT NULL DEFAULT 0,
                "grading_type" TEXT NOT NULL CHECK ("grading_type" IN ('auto', 'manual')),
                "matched" BOOLEAN,
                "comment" TEXT,
                "rule_snapshot" JSONB NOT NULL DEFAULT '{}',
                "graded_by" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
                "graded_at" TIMESTAMPTZ,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE ("revision_id", "field_key")
            );
        `);

        await client.query(`
            CREATE TABLE "submission_notifications" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "submission_id" UUID NOT NULL REFERENCES "form_submissions"("id") ON DELETE CASCADE,
                "revision_id" UUID REFERENCES "form_submission_revisions"("id") ON DELETE SET NULL,
                "revision_request_id" UUID REFERENCES "submission_revision_requests"("id") ON DELETE SET NULL,
                "event_type" TEXT NOT NULL
                    CHECK ("event_type" IN ('revision_requested', 'grading_completed', 'processing_changed')),
                "template" TEXT NOT NULL,
                "recipient" TEXT NOT NULL,
                "payload" JSONB NOT NULL DEFAULT '{}',
                "status" TEXT NOT NULL DEFAULT 'pending'
                    CHECK ("status" IN ('pending', 'sending', 'sent', 'failed')),
                "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" >= 0),
                "idempotency_key" TEXT NOT NULL UNIQUE,
                "provider_message_id" TEXT,
                "last_error" TEXT,
                "sent_at" TIMESTAMPTZ,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE "submission_events" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "submission_id" UUID NOT NULL REFERENCES "form_submissions"("id") ON DELETE CASCADE,
                "form_id" UUID NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
                "event_type" TEXT NOT NULL CHECK ("event_type" IN ('submission', 'revision', 'grading', 'processing', 'notification')),
                "action" TEXT NOT NULL,
                "revision_id" UUID REFERENCES "form_submission_revisions"("id") ON DELETE SET NULL,
                "revision_request_id" UUID REFERENCES "submission_revision_requests"("id") ON DELETE SET NULL,
                "notification_id" UUID REFERENCES "submission_notifications"("id") ON DELETE SET NULL,
                "from_status" TEXT,
                "to_status" TEXT,
                "note" TEXT,
                "score" NUMERIC,
                "max_score" NUMERIC,
                "actor_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
                "metadata" JSONB NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE INDEX "idx_forms_slug" ON "forms"("slug");
            CREATE INDEX "idx_forms_status" ON "forms"("status");
            CREATE INDEX "idx_forms_current_version_id" ON "forms"("current_version_id");
            CREATE INDEX "idx_form_versions_form_id" ON "form_versions"("form_id");
            CREATE INDEX "idx_form_submissions_form_id" ON "form_submissions"("form_id");
            CREATE INDEX "idx_form_submissions_version_id" ON "form_submissions"("form_version_id");
            CREATE INDEX "idx_form_submissions_status" ON "form_submissions"("status");
            CREATE INDEX "idx_form_submissions_grading_status" ON "form_submissions"("grading_status");
            CREATE INDEX "idx_form_submissions_processing_status" ON "form_submissions"("processing_status");
            CREATE INDEX "idx_form_submissions_revision_status" ON "form_submissions"("revision_status");
            CREATE INDEX "idx_form_submissions_current_revision_id" ON "form_submissions"("current_revision_id");
            CREATE INDEX "idx_form_submissions_created_at" ON "form_submissions"("created_at" DESC);
            CREATE INDEX "idx_form_submission_revisions_submission_id" ON "form_submission_revisions"("submission_id", "revision_number" DESC);
            CREATE INDEX "idx_form_submission_revisions_created_at" ON "form_submission_revisions"("created_at" DESC);
            CREATE UNIQUE INDEX "idx_submission_revision_requests_one_open"
                ON "submission_revision_requests"("submission_id") WHERE "status" = 'open';
            CREATE INDEX "idx_submission_revision_requests_submission_id" ON "submission_revision_requests"("submission_id", "created_at" DESC);
            CREATE INDEX "idx_submission_revision_requests_expires_at" ON "submission_revision_requests"("expires_at") WHERE "status" = 'open';
            CREATE INDEX "idx_submission_access_tokens_submission_id" ON "submission_access_tokens"("submission_id");
            CREATE INDEX "idx_submission_access_tokens_expires_at" ON "submission_access_tokens"("expires_at") WHERE "revoked_at" IS NULL;
            CREATE INDEX "idx_submission_grades_submission_id" ON "submission_grades"("submission_id");
            CREATE INDEX "idx_submission_grades_revision_id" ON "submission_grades"("revision_id");
            CREATE INDEX "idx_submission_notifications_submission_id" ON "submission_notifications"("submission_id", "created_at" DESC);
            CREATE INDEX "idx_submission_notifications_status" ON "submission_notifications"("status", "updated_at");
            CREATE INDEX "idx_submission_events_submission_id" ON "submission_events"("submission_id");
            CREATE INDEX "idx_submission_events_form_id" ON "submission_events"("form_id");
            CREATE INDEX "idx_submission_events_revision_id" ON "submission_events"("revision_id");
        `);

        await client.query("COMMIT");
        console.log("表单系统表重建完成");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch((error) => {
    console.error("迁移失败:", error);
    process.exit(1);
});
