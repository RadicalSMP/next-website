/**
 * 系统设置读写模块
 *
 * 封装 system_settings 表的 CRUD 操作，自动处理加解密。
 */

import { pool } from "@/lib/db";
import { encrypt, decrypt, maskSensitive } from "@/lib/crypto";

/**
 * 获取单个设置项的值（自动解密）
 */
export async function getSetting(key: string): Promise<string | null> {
    try {
        const result = await pool.query(
            `SELECT value, encrypted FROM system_settings WHERE key = $1`,
            [key],
        );
        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        if (row.encrypted) {
            return decrypt(row.value);
        }
        return row.value;
    } catch {
        return null;
    }
}

/**
 * 获取单个设置项的值（加密项返回脱敏值，用于前端展示）
 */
export async function getSettingMasked(key: string): Promise<string | null> {
    try {
        const result = await pool.query(
            `SELECT value, encrypted FROM system_settings WHERE key = $1`,
            [key],
        );
        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        if (row.encrypted) {
            const decrypted = decrypt(row.value);
            return maskSensitive(decrypted);
        }
        return row.value;
    } catch {
        return null;
    }
}

/**
 * 按前缀获取多个设置项（加密项返回脱敏值）
 */
export async function getSettingsMasked(
    prefix: string,
): Promise<Record<string, string>> {
    try {
        const result = await pool.query(
            `SELECT key, value, encrypted FROM system_settings WHERE key LIKE $1`,
            [`${prefix}%`],
        );
        const settings: Record<string, string> = {};
        for (const row of result.rows) {
            if (row.encrypted) {
                try {
                    const decrypted = decrypt(row.value);
                    settings[row.key] = maskSensitive(decrypted);
                } catch {
                    settings[row.key] = "****";
                }
            } else {
                settings[row.key] = row.value;
            }
        }
        return settings;
    } catch {
        return {};
    }
}

/**
 * 设置单个设置项的值（自动加密）
 */
export async function setSetting(
    key: string,
    value: string,
    encrypted: boolean = false,
): Promise<void> {
    const storedValue = encrypted ? encrypt(value) : value;
    await pool.query(
        `INSERT INTO system_settings (key, value, encrypted, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key) DO UPDATE
         SET value = $2, encrypted = $3, updated_at = NOW()`,
        [key, storedValue, encrypted],
    );
}

/**
 * 删除设置项
 */
export async function deleteSetting(key: string): Promise<void> {
    await pool.query(`DELETE FROM system_settings WHERE key = $1`, [key]);
}
