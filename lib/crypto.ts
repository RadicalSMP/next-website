/**
 * AES-256-GCM 加密/解密工具
 *
 * 使用 ENCRYPTION_KEY 环境变量（64 位 hex 字符串 = 32 字节密钥）。
 * 加密结果格式: iv:authTag:ciphertext（均为 hex 编码）
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getKey(): Buffer {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error(
            "缺少或无效的 ENCRYPTION_KEY 环境变量（需要 64 位 hex 字符串，即 32 字节）",
        );
    }
    return Buffer.from(hex, "hex");
}

/**
 * 加密明文字符串
 */
export function encrypt(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(12); // GCM 推荐 12 字节 IV
    const cipher = createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * 解密已加密的字符串
 */
export function decrypt(ciphertext: string): string {
    const key = getKey();
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
        throw new Error("无效的加密数据格式");
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

/**
 * 对字符串进行脱敏处理（用于前端展示）
 * 例如: "sk-abc123xyz789" -> "sk-abc...789"
 */
export function maskSensitive(value: string): string {
    if (value.length <= 8) return "****";
    const prefix = value.slice(0, 6);
    const suffix = value.slice(-4);
    return `${prefix}...${suffix}`;
}
