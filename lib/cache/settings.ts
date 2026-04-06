import { revalidateTag, unstable_cache } from "next/cache";
import { getSetting, getSettingsMasked } from "@/lib/settings";
import { CACHE_TAGS } from "./tags";
import { CACHE_KEYS } from "./keys";

export interface AICacheConfig {
    apiKey: string;
    baseURL: string;
    model: string;
}

// ─── 获取单个设置项（服务端读取复用） ────────────────────────────
export const getSettingCached = unstable_cache(
    async (key: string) => getSetting(key),
    CACHE_KEYS.SETTING_ITEM,
    { tags: [CACHE_TAGS.SETTINGS] },
);

// ─── 按前缀获取脱敏设置（后台展示用） ────────────────────────────
export const getSettingsMaskedCached = unstable_cache(
    async (prefix: string) => getSettingsMasked(prefix),
    CACHE_KEYS.SETTINGS_MASKED,
    { tags: [CACHE_TAGS.SETTINGS] },
);

// ─── 获取 AI 配置（数据库 + 环境变量 fallback） ───────────────────
export const getAIConfigCached = unstable_cache(
    async (): Promise<AICacheConfig> => {
        const [dbApiKey, dbBaseUrl, dbModel] = await Promise.all([
            getSetting("ai.api_key"),
            getSetting("ai.base_url"),
            getSetting("ai.model"),
        ]);

        const apiKey = dbApiKey || process.env.OPENAI_API_KEY || "";
        const baseURL = dbBaseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
        const model = dbModel || process.env.OPENAI_MODEL || "gpt-4o-mini";

        if (!apiKey) {
            throw new Error("未配置 AI API Key，请在系统设置中配置或设置 OPENAI_API_KEY 环境变量");
        }

        return { apiKey, baseURL, model };
    },
    CACHE_KEYS.AI_CONFIG,
    { tags: [CACHE_TAGS.SETTINGS] },
);

// ─── 使设置缓存失效 ──────────────────────────────────────────────
export function invalidateSettingsCache() {
    revalidateTag(CACHE_TAGS.SETTINGS, { expire: 0 });
}
