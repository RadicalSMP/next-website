import { revalidateTag, unstable_cache } from "next/cache";
import { pool } from "@/lib/db";
import { CACHE_TAGS } from "./tags";
import { CACHE_KEYS } from "./keys";

// ─── 管理后台用户列表（保留 unstable_cache） ─────────────────────
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
    CACHE_KEYS.ADMIN_USER_LIST,
    { tags: [CACHE_TAGS.ADMIN_USERS] },
);

// ─── 使用户缓存失效 ──────────────────────────────────────────────
export function invalidateUserCache() {
    revalidateTag(CACHE_TAGS.ADMIN_USERS, { expire: 0 });
}
