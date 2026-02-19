import { unstable_cache, revalidateTag } from "next/cache";
import { pool } from "@/lib/db";

// ─── 缓存标签 ────────────────────────────────────────────
const ADMIN_USERS_CACHE_TAG = "admin-users";

// ─── 管理后台用户列表（缓存，按 page/limit/search 分片） ──
export const getAdminUsers = unstable_cache(
    async (page: number, limit: number, search: string | null) => {
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
    },
    ["admin-users-list"],
    { tags: [ADMIN_USERS_CACHE_TAG] },
);

// ─── 使用户缓存失效 ──────────────────────────────────────
export function invalidateUserCache() {
    revalidateTag(ADMIN_USERS_CACHE_TAG, { expire: 0 });
}
