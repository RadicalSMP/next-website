import { revalidateTag, unstable_cache } from "next/cache";
import { pool } from "@/lib/db";
import { CACHE_TAGS } from "./tags";
import { CACHE_KEYS } from "./keys";

// ─── 获取后台邀请码列表（含使用记录） ────────────────────────────
export const getAdminInvitationCodes = unstable_cache(
    async () => {
        const [codesResult, usagesResult] = await Promise.all([
            pool.query(
                `SELECT * FROM "invitation_code" ORDER BY "createdAt" DESC`,
            ),
            pool.query(
                `SELECT u.*, usr."name" as "userName"
                 FROM "invitation_code_usage" u
                 LEFT JOIN "user" usr ON u."userId" = usr."id"
                 ORDER BY u."usedAt" DESC`,
            ),
        ]);

        const usagesByCodeId: Record<string, typeof usagesResult.rows> = {};
        for (const usage of usagesResult.rows) {
            if (!usagesByCodeId[usage.codeId]) {
                usagesByCodeId[usage.codeId] = [];
            }
            usagesByCodeId[usage.codeId].push(usage);
        }

        return codesResult.rows.map((code) => ({
            ...code,
            usages: usagesByCodeId[code.id] || [],
        }));
    },
    CACHE_KEYS.ADMIN_INVITATION_CODE_LIST,
    { tags: [CACHE_TAGS.INVITATION_CODES] },
);

// ─── 使邀请码缓存失效 ────────────────────────────────────────────
export function invalidateInvitationCodeCache() {
    revalidateTag(CACHE_TAGS.INVITATION_CODES, { expire: 0 });
}
