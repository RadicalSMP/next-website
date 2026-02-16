/**
 * 博客表迁移脚本
 *
 * 用法: bun run migrate:blog
 *
 * 在 PostgreSQL 中创建 blog_posts 表。
 * Bun 会自动加载 .env / .env.local，无需额外配置 dotenv。
 */

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    console.log("⏳ 正在创建 blog_posts 表...");

    await pool.query(`
        CREATE TABLE IF NOT EXISTS blog_posts (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title         TEXT NOT NULL,
            slug          TEXT UNIQUE NOT NULL,
            content       TEXT NOT NULL DEFAULT '',
            excerpt       TEXT,
            cover_image   TEXT,
            status        TEXT NOT NULL DEFAULT 'draft',
            author_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
            published_at  TIMESTAMPTZ,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_blog_posts_slug
            ON blog_posts(slug);

        CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published
            ON blog_posts(status, published_at DESC);
    `);

    console.log("✅ blog_posts 表创建成功");
}

migrate()
    .catch((err) => {
        console.error("❌ 迁移失败:", err);
        process.exit(1);
    })
    .finally(() => pool.end());
