/**
 * OpenAI 兼容客户端
 *
 * 优先从数据库 system_settings 读取配置，
 * 回退到环境变量 OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL。
 */

import OpenAI from "openai";
import { getSetting } from "@/lib/settings";

/**
 * 获取 AI 配置（从数据库 + 环境变量 fallback）
 */
export async function getAIConfig(): Promise<{
    apiKey: string;
    baseURL: string;
    model: string;
}> {
    const dbApiKey = await getSetting("ai.api_key");
    const dbBaseUrl = await getSetting("ai.base_url");
    const dbModel = await getSetting("ai.model");

    const apiKey = dbApiKey || process.env.OPENAI_API_KEY || "";
    const baseURL = dbBaseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = dbModel || process.env.OPENAI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
        throw new Error("未配置 AI API Key，请在系统设置中配置或设置 OPENAI_API_KEY 环境变量");
    }

    return { apiKey, baseURL, model };
}

/**
 * 创建 OpenAI 客户端实例（每次调用时从数据库读取最新配置）
 */
export async function createOpenAIClient(): Promise<{
    client: OpenAI;
    model: string;
}> {
    const config = await getAIConfig();

    const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
    });

    return { client, model: config.model };
}
