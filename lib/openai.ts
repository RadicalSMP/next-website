/**
 * OpenAI 兼容客户端
 *
 * 优先从数据库 system_settings 读取配置，
 * 回退到环境变量 OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL。
 */

import OpenAI from "openai";
import { getAIConfigCached } from "@/lib/cache";

/**
 * 获取 AI 配置（从数据库 + 环境变量 fallback）
 */
export async function getAIConfig(): Promise<{
    apiKey: string;
    baseURL: string;
    model: string;
}> {
    return getAIConfigCached();
}

/**
 * 创建 OpenAI 客户端实例（每次调用时复用服务端缓存配置）
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
