import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import type { SubmissionAccessScope } from "@/lib/forms";

export type SubmissionAccessSource = "none" | "admin" | "account" | "token";

export type SubmissionAccessActor = {
    userId: string | null;
    role?: string | null;
};

export type SubmissionAccessDecision = {
    canView: boolean;
    canRevise: boolean;
    source: SubmissionAccessSource;
    submissionId: string;
    revisionRequestId: string | null;
    reason: "allowed" | "not_found" | "not_owner" | "token_invalid" | "token_expired" | "scope_missing";
};

export class SubmissionAccessTokenError extends Error {
    constructor(
        message: string,
        public readonly status: 400 | 404 | 409 | 410,
        public readonly code: string,
    ) {
        super(message);
        this.name = "SubmissionAccessTokenError";
    }
}

export const SUBMISSION_ACCESS_COOKIE_PREFIX = "rsmp_form_access_";

export function getSubmissionAccessCookieName(submissionId: string) {
    return `${SUBMISSION_ACCESS_COOKIE_PREFIX}${submissionId}`;
}

export function hashSubmissionAccessToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

function generateSubmissionAccessToken() {
    return randomBytes(32).toString("base64url");
}

function normalizeScopes(scopes: SubmissionAccessScope[]) {
    return Array.from(new Set(scopes));
}

export async function createSubmissionAccessToken(
    client: PoolClient,
    input: {
        submissionId: string;
        revisionRequestId: string | null;
        scopes: SubmissionAccessScope[];
        expiresAt: Date;
    },
) {
    const scopes = normalizeScopes(input.scopes);
    if (scopes.length === 0) {
        throw new SubmissionAccessTokenError("访问令牌至少需要一个权限范围", 400, "scopes_required");
    }
    if (scopes.includes("revise") && !input.revisionRequestId) {
        throw new SubmissionAccessTokenError("补交令牌必须绑定补交请求", 400, "revision_request_required");
    }
    if (!Number.isFinite(input.expiresAt.getTime()) || input.expiresAt.getTime() <= Date.now()) {
        throw new SubmissionAccessTokenError("访问令牌过期时间必须晚于当前时间", 400, "invalid_expiry");
    }
    if (scopes.includes("revise")) {
        const requestResult = await client.query<{ expires_at: Date | null }>(
            `SELECT expires_at
             FROM submission_revision_requests
             WHERE id = $1 AND submission_id = $2 AND status = 'open'`,
            [input.revisionRequestId, input.submissionId],
        );
        const request = requestResult.rows[0];
        if (!request) {
            throw new SubmissionAccessTokenError("补交请求不存在或已结束", 409, "revision_request_inactive");
        }
        if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) {
            throw new SubmissionAccessTokenError("补交请求已过期", 410, "revision_request_expired");
        }
    }

    const token = generateSubmissionAccessToken();
    const result = await client.query<{ id: string }>(
        `INSERT INTO submission_access_tokens
            (submission_id, revision_request_id, token_hash, scopes, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
            input.submissionId,
            input.revisionRequestId,
            hashSubmissionAccessToken(token),
            scopes,
            input.expiresAt,
        ],
    );

    return {
        id: result.rows[0].id,
        token,
        expiresAt: input.expiresAt,
        scopes,
    };
}

export async function exchangeSubmissionAccessToken(client: PoolClient, token: string) {
    if (!token || token.length < 32) {
        throw new SubmissionAccessTokenError("访问链接无效", 404, "token_invalid");
    }

    const result = await client.query<{
        id: string;
        submission_id: string;
        revision_request_id: string | null;
        scopes: SubmissionAccessScope[];
        expires_at: Date;
        consumed_at: Date | null;
        revoked_at: Date | null;
        request_status: string | null;
        request_expires_at: Date | null;
        active_revision_request_id: string | null;
    }>(
        `SELECT sat.id, sat.submission_id, sat.revision_request_id, sat.scopes,
                sat.expires_at, sat.consumed_at, sat.revoked_at,
                srr.status AS request_status, srr.expires_at AS request_expires_at,
                fs.active_revision_request_id
         FROM submission_access_tokens sat
         INNER JOIN form_submissions fs ON fs.id = sat.submission_id
         LEFT JOIN submission_revision_requests srr ON srr.id = sat.revision_request_id
         WHERE sat.token_hash = $1
         FOR UPDATE OF sat`,
        [hashSubmissionAccessToken(token)],
    );
    const row = result.rows[0];
    if (!row || row.revoked_at) {
        throw new SubmissionAccessTokenError("访问链接无效或已撤销", 404, "token_invalid");
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
        throw new SubmissionAccessTokenError("访问链接已过期", 410, "token_expired");
    }
    if (row.scopes.includes("revise")) {
        if (row.consumed_at) {
            throw new SubmissionAccessTokenError("该补交链接已使用", 410, "token_consumed");
        }
        if (
            !row.revision_request_id ||
            row.request_status !== "open" ||
            row.active_revision_request_id !== row.revision_request_id
        ) {
            throw new SubmissionAccessTokenError("补交请求已失效", 410, "revision_request_inactive");
        }
        if (row.request_expires_at && new Date(row.request_expires_at).getTime() <= Date.now()) {
            throw new SubmissionAccessTokenError("补交请求已过期", 410, "revision_request_expired");
        }
    }

    const cookieToken = generateSubmissionAccessToken();
    await client.query(
        `UPDATE submission_access_tokens
         SET token_hash = $1,
             last_used_at = NOW()
         WHERE id = $2`,
        [hashSubmissionAccessToken(cookieToken), row.id],
    );

    return {
        tokenId: row.id,
        submissionId: row.submission_id,
        revisionRequestId: row.revision_request_id,
        scopes: row.scopes,
        expiresAt: new Date(row.expires_at),
        cookieToken,
    };
}

export async function consumeRevisionAccessTokens(client: PoolClient, revisionRequestId: string) {
    await client.query(
        `UPDATE submission_access_tokens
         SET scopes = CASE
                 WHEN scopes @> ARRAY['view']::TEXT[] THEN ARRAY_REMOVE(scopes, 'revise')
                 ELSE scopes
             END,
             consumed_at = NOW(),
             revoked_at = CASE
                 WHEN scopes @> ARRAY['view']::TEXT[] THEN revoked_at
                 ELSE NOW()
             END
         WHERE revision_request_id = $1
           AND scopes @> ARRAY['revise']::TEXT[]
           AND consumed_at IS NULL`,
        [revisionRequestId],
    );
}

export async function revokeRevisionAccessTokens(client: PoolClient, revisionRequestId: string) {
    await client.query(
        `UPDATE submission_access_tokens
         SET scopes = CASE
                 WHEN scopes @> ARRAY['view']::TEXT[] THEN ARRAY_REMOVE(scopes, 'revise')
                 ELSE scopes
             END,
             revoked_at = CASE
                 WHEN scopes @> ARRAY['view']::TEXT[] THEN revoked_at
                 ELSE NOW()
             END
         WHERE revision_request_id = $1
           AND scopes @> ARRAY['revise']::TEXT[]
           AND revoked_at IS NULL`,
        [revisionRequestId],
    );
}

export async function authorizeSubmissionAccess(input: {
    submissionId: string;
    actor?: SubmissionAccessActor | null;
    accessToken?: string | null;
}): Promise<SubmissionAccessDecision> {
    const submissionResult = await pool.query<{
        user_id: string | null;
        active_revision_request_id: string | null;
        request_status: string | null;
        request_expires_at: Date | null;
    }>(
        `SELECT fs.user_id, fs.active_revision_request_id,
                srr.status AS request_status, srr.expires_at AS request_expires_at
         FROM form_submissions fs
         LEFT JOIN submission_revision_requests srr ON srr.id = fs.active_revision_request_id
         WHERE fs.id = $1`,
        [input.submissionId],
    );
    const submission = submissionResult.rows[0];
    if (!submission) {
        return {
            canView: false,
            canRevise: false,
            source: "none",
            submissionId: input.submissionId,
            revisionRequestId: null,
            reason: "not_found",
        };
    }

    const requestOpen = submission.request_status === "open" &&
        (!submission.request_expires_at || new Date(submission.request_expires_at).getTime() > Date.now());
    if (input.actor?.userId && input.actor.userId === submission.user_id) {
        return {
            canView: true,
            canRevise: requestOpen,
            source: "account",
            submissionId: input.submissionId,
            revisionRequestId: requestOpen ? submission.active_revision_request_id : null,
            reason: "allowed",
        };
    }
    if (input.actor?.role === "admin") {
        return {
            canView: true,
            canRevise: false,
            source: "admin",
            submissionId: input.submissionId,
            revisionRequestId: submission.active_revision_request_id,
            reason: "allowed",
        };
    }

    if (input.accessToken) {
        const tokenResult = await pool.query<{
            revision_request_id: string | null;
            scopes: SubmissionAccessScope[];
            expires_at: Date;
            consumed_at: Date | null;
            revoked_at: Date | null;
            request_status: string | null;
            request_expires_at: Date | null;
        }>(
            `SELECT sat.revision_request_id, sat.scopes, sat.expires_at,
                    sat.consumed_at, sat.revoked_at,
                    srr.status AS request_status, srr.expires_at AS request_expires_at
             FROM submission_access_tokens sat
             LEFT JOIN submission_revision_requests srr ON srr.id = sat.revision_request_id
             WHERE sat.submission_id = $1 AND sat.token_hash = $2`,
            [input.submissionId, hashSubmissionAccessToken(input.accessToken)],
        );
        const token = tokenResult.rows[0];
        if (!token || token.revoked_at) {
            return {
                canView: false,
                canRevise: false,
                source: "none",
                submissionId: input.submissionId,
                revisionRequestId: null,
                reason: "token_invalid",
            };
        }
        if (new Date(token.expires_at).getTime() <= Date.now()) {
            return {
                canView: false,
                canRevise: false,
                source: "none",
                submissionId: input.submissionId,
                revisionRequestId: token.revision_request_id,
                reason: "token_expired",
            };
        }

        const canView = token.scopes.includes("view");
        const canRevise = token.scopes.includes("revise") &&
            !token.consumed_at &&
            token.revision_request_id === submission.active_revision_request_id &&
            token.request_status === "open" &&
            (!token.request_expires_at || new Date(token.request_expires_at).getTime() > Date.now());
        return {
            canView,
            canRevise,
            source: canView || canRevise ? "token" : "none",
            submissionId: input.submissionId,
            revisionRequestId: token.revision_request_id,
            reason: canView || canRevise ? "allowed" : "scope_missing",
        };
    }

    return {
        canView: false,
        canRevise: false,
        source: "none",
        submissionId: input.submissionId,
        revisionRequestId: null,
        reason: "not_owner",
    };
}

export function isSameOriginMutation(request: Request) {
    const origin = request.headers.get("origin");
    return Boolean(origin && origin === new URL(request.url).origin);
}
