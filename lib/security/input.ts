const AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_FINGERPRINT_LENGTH = 256;
export const MAX_SUBMISSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

export function validateAvatarDataUrl(value: unknown) {
    if (value === undefined || value === null || value === "") {
        return { ok: true as const, value: "" };
    }
    if (typeof value !== "string") {
        return { ok: false as const, error: "头像格式无效" };
    }
    if (value.length > Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 64) {
        return { ok: false as const, error: "头像大小不能超过 2 MB" };
    }

    const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/]+={0,2})$/i.exec(value);
    if (!match || !AVATAR_MIME_TYPES.has(match[1].toLowerCase())) {
        return { ok: false as const, error: "头像仅支持 JPEG、PNG 或 WebP 格式" };
    }

    const payload = match[2];
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    const byteLength = Math.floor((payload.length * 3) / 4) - padding;
    if (byteLength <= 0 || byteLength > MAX_AVATAR_BYTES) {
        return { ok: false as const, error: "头像大小不能超过 2 MB" };
    }

    const bytes = Buffer.from(payload, "base64");
    const mimeType = match[1].toLowerCase();
    const signatureValid = mimeType === "image/jpeg"
        ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : mimeType === "image/png"
            ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!signatureValid) {
        return { ok: false as const, error: "头像文件内容与格式不匹配" };
    }

    return { ok: true as const, value };
}

export function normalizeSubmissionMetadata(payload: Record<string, unknown>) {
    const fingerprint = typeof payload.fingerprint === "string"
        ? payload.fingerprint.trim().slice(0, MAX_FINGERPRINT_LENGTH) || null
        : null;
    const duration = typeof payload.duration === "number" && Number.isFinite(payload.duration)
        ? Math.min(MAX_SUBMISSION_DURATION_SECONDS, Math.max(0, Math.round(payload.duration)))
        : null;

    return { fingerprint, duration };
}
