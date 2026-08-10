import { afterEach, describe, expect, test } from "bun:test";
import { decrypt, encrypt } from "@/lib/crypto";
import { validateAvatarDataUrl, normalizeSubmissionMetadata } from "@/lib/security/input";
import { isSameOriginMutation } from "@/lib/security/request";
import { validateAiSettings } from "@/lib/security/settings";

describe("精确同源校验", () => {
    test("拒绝缺失或不匹配的 Origin", () => {
        expect(isSameOriginMutation(new Request("https://rsmp.example/api/forms", { method: "POST" }))).toBeFalse();
        expect(isSameOriginMutation(new Request("https://rsmp.example/api/forms", {
            method: "POST",
            headers: { Origin: "https://evil.example" },
        }))).toBeFalse();
    });

    test("接受精确匹配的 Origin 和安全方法", () => {
        expect(isSameOriginMutation(new Request("https://rsmp.example/api/forms", {
            method: "POST",
            headers: { Origin: "https://rsmp.example" },
        }))).toBeTrue();
        expect(isSameOriginMutation(new Request("https://rsmp.example/api/forms"))).toBeTrue();
    });
});

describe("系统设置安全边界", () => {
    const originalKey = process.env.ENCRYPTION_KEY;
    afterEach(() => {
        if (originalKey === undefined) delete process.env.ENCRYPTION_KEY;
        else process.env.ENCRYPTION_KEY = originalKey;
    });

    test("仅接受精确 AI 键并强制 API Key 加密", () => {
        const accepted = validateAiSettings({
            "ai.api_key": { value: "sk-test-123456", encrypted: false },
            "ai.base_url": { value: "https://api.example.com/v1" },
            "ai.model": { value: "gpt-4o-mini" },
        });
        const rejected = validateAiSettings({ "ai.unexpected": { value: "x" } });

        expect(accepted.ok).toBeTrue();
        if (accepted.ok) {
            expect(accepted.value.find((item) => item.key === "ai.api_key")?.encrypted).toBeTrue();
        }
        expect(rejected.ok).toBeFalse();
    });

    test("AES-256-GCM 密文可往返且不包含明文", () => {
        process.env.ENCRYPTION_KEY = "11".repeat(32);
        const ciphertext = encrypt("sk-secret-value");

        expect(ciphertext).not.toContain("sk-secret-value");
        expect(decrypt(ciphertext)).toBe("sk-secret-value");
    });
});

describe("头像和提交元数据边界", () => {
    test("仅接受签名匹配的 JPEG、PNG 或 WebP", () => {
        const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");
        expect(validateAvatarDataUrl(`data:image/png;base64,${pngHeader}`).ok).toBeTrue();
        expect(validateAvatarDataUrl(`data:image/png;base64,${Buffer.from("not png").toString("base64")}`).ok).toBeFalse();
        expect(validateAvatarDataUrl("data:image/svg+xml;base64,PHN2Zz4=").ok).toBeFalse();
    });

    test("截断指纹并限制填写时长", () => {
        const metadata = normalizeSubmissionMetadata({
            fingerprint: "x".repeat(500),
            duration: Number.MAX_SAFE_INTEGER,
        });

        expect(metadata.fingerprint?.length).toBe(256);
        expect(metadata.duration).toBe(7 * 24 * 60 * 60);
    });
});
