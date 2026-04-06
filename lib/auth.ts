import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { Pool } from "pg";
import { admin } from "better-auth/plugins"
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";
import { invalidateInvitationCodeCache } from "@/lib/cache";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export const auth = betterAuth({
    database: pool,
    emailVerification: {
        sendVerificationEmail: async ({ user, url }) => {
            await sendVerificationEmail({
                to: user.email,
                verifyUrl: url,
                userName: user.name,
            });
        },
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        expiresIn: 3600,
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        minPasswordLength: 8,
        maxPasswordLength: 128,
        async sendResetPassword({ user, url }) {
            await sendPasswordResetEmail({
                to: user.email,
                resetUrl: url,
                userName: user.name,
            });
        },
    },
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!
        }
    },
    plugins: [
        nextCookies(),
        admin(),
    ],
    rateLimit: {
        enabled: true,
        window: 60,
        max: 10,
        customRules: {
            "/api/auth/sign-in/email": {
                window: 60,
                max: 5,
            },
            "/api/auth/sign-up/email": {
                window: 60,
                max: 3,
            },
            "/api/auth/forget-password": {
                window: 300,
                max: 3,
            },
        },
        storage: "memory",
    },
    user: {
        additionalFields: {
            mcid: {
                type: "string[]",
                required: false,
                input: false,
            },
            qq: {
                type: "string[]",
                required: false,
                input: false,
            }
        },
    },
    hooks: {
        before: createAuthMiddleware(async (ctx) => {
            if (ctx.path !== "/sign-up/email") {
                return;
            }

            const invitationCode = (ctx.body as Record<string, unknown>)?.invitationCode;
            if (!invitationCode || typeof invitationCode !== "string") {
                throw new APIError("BAD_REQUEST", {
                    message: "请输入邀请码",
                });
            }

            const result = await pool.query(
                `SELECT * FROM "invitation_code" WHERE "code" = $1`,
                [invitationCode],
            );

            if (result.rows.length === 0) {
                throw new APIError("BAD_REQUEST", {
                    message: "邀请码无效",
                });
            }

            const code = result.rows[0];

            // 检查过期
            if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
                throw new APIError("BAD_REQUEST", {
                    message: "邀请码已过期",
                });
            }

            // 检查使用次数
            if (code.uses >= code.maxUses) {
                throw new APIError("BAD_REQUEST", {
                    message: "邀请码已达到最大使用次数",
                });
            }

            // 检查邮箱白名单
            const email = (ctx.body as Record<string, unknown>)?.email as string;
            if (code.allowedEmails && code.allowedEmails.length > 0) {
                const allowed = (code.allowedEmails as string[]).some(
                    (e: string) => e.toLowerCase() === email.toLowerCase(),
                );
                if (!allowed) {
                    throw new APIError("BAD_REQUEST", {
                        message: "该邀请码不允许此邮箱注册",
                    });
                }
            }
        }),
        after: createAuthMiddleware(async (ctx) => {
            if (ctx.path !== "/sign-up/email") {
                return;
            }

            // 注册成功后，记录使用并更新计数
            // ctx.context.returned 是端点返回的普通对象 { token, user }，不是 Response
            const returned = ctx.context.returned as
                | { token: string | null; user?: { id?: string; email?: string } }
                | undefined;

            if (!returned || !returned.user) {
                return;
            }

            const userId = returned.user.id;
            const userEmail = returned.user.email;

            if (!userId || !userEmail) {
                return;
            }

            const invitationCode = (ctx.body as Record<string, unknown>)?.invitationCode as string;
            if (!invitationCode) {
                return;
            }

            // 获取邀请码 ID
            const codeResult = await pool.query(
                `SELECT "id" FROM "invitation_code" WHERE "code" = $1`,
                [invitationCode],
            );

            if (codeResult.rows.length === 0) {
                return;
            }

            const codeId = codeResult.rows[0].id;

            // 插入使用记录 + 更新计数
            const usageId = crypto.randomUUID();
            await pool.query(
                `INSERT INTO "invitation_code_usage" ("id", "codeId", "userId", "email") VALUES ($1, $2, $3, $4)`,
                [usageId, codeId, userId, userEmail],
            );
            await pool.query(
                `UPDATE "invitation_code" SET "uses" = "uses" + 1 WHERE "id" = $1`,
                [codeId],
            );

            invalidateInvitationCodeCache();
        }),
    },
})
