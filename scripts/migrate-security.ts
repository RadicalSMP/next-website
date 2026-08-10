import { Pool } from "pg";

async function migrate() {
    if (!process.env.DATABASE_URL) {
        throw new Error("缺少 DATABASE_URL 环境变量");
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS invitation_code_reservation (
                id          TEXT PRIMARY KEY,
                "codeId"    TEXT NOT NULL REFERENCES invitation_code(id) ON DELETE CASCADE,
                email       TEXT NOT NULL,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "expiresAt" TIMESTAMPTZ NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_invitation_reservation_code_expiry
                ON invitation_code_reservation ("codeId", "expiresAt");
            CREATE INDEX IF NOT EXISTS idx_invitation_reservation_expiry
                ON invitation_code_reservation ("expiresAt");

            CREATE TABLE IF NOT EXISTS "rateLimit" (
                id            TEXT PRIMARY KEY,
                key           TEXT NOT NULL UNIQUE,
                count         INTEGER NOT NULL,
                "lastRequest" BIGINT NOT NULL
            );
        `);
        console.log("安全迁移完成：邀请码预留表和数据库限流表已就绪");
    } finally {
        await pool.end();
    }
}

migrate().catch((error) => {
    console.error("安全迁移失败", error);
    process.exitCode = 1;
});
