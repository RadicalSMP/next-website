import "server-only";

const DEFAULT_CAP_URL = "https://cap.hami.im/";
const CAP_TIMEOUT_MS = 5000;

export type CapVerificationResult =
    | { success: true }
    | { success: false; message: string; unavailable: boolean };

function getCapValidationUrl() {
    const configuredUrl = process.env.CAP_API_URL || DEFAULT_CAP_URL;
    const baseUrl = new URL(configuredUrl);
    const pathname = baseUrl.pathname.replace(/\/+$/, "");

    baseUrl.pathname = pathname.endsWith("/api")
        ? `${pathname}/validate`
        : `${pathname}/api/validate`;
    baseUrl.search = "";
    baseUrl.hash = "";

    return baseUrl;
}

export async function verifyCapToken(token: unknown): Promise<CapVerificationResult> {
    if (typeof token !== "string" || !token.trim()) {
        return {
            success: false,
            message: "请先完成安全验证",
            unavailable: false,
        };
    }

    try {
        const response = await fetch(getCapValidationUrl(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: token.trim(), keepToken: false }),
            cache: "no-store",
            signal: AbortSignal.timeout(CAP_TIMEOUT_MS),
        });

        if (!response.ok) {
            console.error(`[CAP] 验证服务返回异常状态：${response.status}`);
            return {
                success: false,
                message: "安全验证服务暂时不可用，请稍后重试",
                unavailable: true,
            };
        }

        const result = await response.json() as { success?: boolean };
        if (result.success !== true) {
            return {
                success: false,
                message: "安全验证无效或已过期，请重新验证",
                unavailable: false,
            };
        }

        return { success: true };
    } catch (error) {
        console.error("[CAP] 无法连接验证服务", error);
        return {
            success: false,
            message: "安全验证服务暂时不可用，请稍后重试",
            unavailable: true,
        };
    }
}
