import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { pool } from "@/lib/db";
import { CACHE_TAGS } from "./tags";

// ─── 管理后台用户列表（缓存，按 page/limit/search 分片） ──
export async function getAdminUsers(page: number, limit: number, search: string | null) {
    "use cache";
    cacheTag(CACHE_TAGS.ADMIN_USERS);
    cacheLife("default");

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
        conditions.push(
            `("name" ILIKE $${paramIdx} OR "email" ILIKE $${paramIdx})`,
        );
        params.push(`%${search}%`);
        paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = page * limit;

    const countResult = await pool.query(
        `SELECT COUNT(*) FROM "user" ${where}`,
        params,
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
        `SELECT "id", "name", "email", "image", "role", "banned", "banReason", "banExpires",
                "createdAt", "emailVerified"
         FROM "user"
         ${where}
         ORDER BY "createdAt" DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        [...params, limit, offset],
    );

    return { users: result.rows, total };
}

// ─── 使用户缓存失效 ──────────────────────────────────────
export function invalidateUserCache() {
    // 用户管理操作（封禁/角色变更）需要立即生效
    revalidateTag(CACHE_TAGS.ADMIN_USERS, { expire: 0 });
}
