import { Pool } from "pg";

// 全局 pg Pool 单例，避免多次创建连接池
const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool =
    globalForDb.pool ??
    new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
    globalForDb.pool = pool;
}
