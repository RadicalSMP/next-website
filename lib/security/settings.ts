export const AI_SETTING_KEYS = ["ai.api_key", "ai.base_url", "ai.model"] as const;
export type AiSettingKey = (typeof AI_SETTING_KEYS)[number];

const AI_SETTING_KEY_SET = new Set<string>(AI_SETTING_KEYS);

export type ValidatedAiSetting = {
    key: AiSettingKey;
    value: string;
    encrypted: boolean;
};

export function validateAiSettings(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { ok: false as const, error: "参数错误" };
    }

    const validated: ValidatedAiSetting[] = [];
    for (const [key, config] of Object.entries(value)) {
        if (!AI_SETTING_KEY_SET.has(key)) {
            return { ok: false as const, error: `不允许修改设置项: ${key}` };
        }
        if (!config || typeof config !== "object" || Array.isArray(config)) {
            return { ok: false as const, error: `设置项 ${key} 格式无效` };
        }

        const rawValue = (config as Record<string, unknown>).value;
        if (typeof rawValue !== "string") {
            return { ok: false as const, error: `设置项 ${key} 必须是字符串` };
        }
        const settingValue = rawValue.trim();

        if (key === "ai.api_key") {
            if (settingValue.length < 8 || settingValue.length > 512) {
                return { ok: false as const, error: "AI API Key 长度应在 8-512 个字符之间" };
            }
        } else if (key === "ai.base_url") {
            if (settingValue.length > 2048) {
                return { ok: false as const, error: "AI Base URL 过长" };
            }
            try {
                const url = new URL(settingValue);
                if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) {
                    return { ok: false as const, error: "AI Base URL 必须使用 HTTPS" };
                }
                if (url.username || url.password) {
                    return { ok: false as const, error: "AI Base URL 不能包含认证信息" };
                }
            } catch {
                return { ok: false as const, error: "AI Base URL 格式无效" };
            }
        } else if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(settingValue)) {
            return { ok: false as const, error: "AI 模型名称格式无效" };
        }

        validated.push({
            key: key as AiSettingKey,
            value: settingValue,
            encrypted: key === "ai.api_key",
        });
    }

    return { ok: true as const, value: validated };
}
