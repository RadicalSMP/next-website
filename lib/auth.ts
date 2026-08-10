import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { Pool } from "pg";
import { admin } from "better-auth/plugins"
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";
import { invalidateInvitationCodeCache } from "@/lib/cache";
import { verifyCapToken } from "@/lib/cap";
import {
    consumeInvitationReservation,
    deleteUnfinishedAccount,
    InvitationReservationError,
    releaseInvitationReservation,
    reserveInvitationCode,
} from "@/lib/invitation-reservations";
import { validateAvatarDataUrl } from "@/lib/security/input";

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
        storage: "database",
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
            if (ctx.path === "/sign-in/email" || ctx.path === "/sign-up/email") {
                const captchaToken = (ctx.body as Record<string, unknown>)?.captchaToken;
                const verification = await verifyCapToken(captchaToken);

                if (!verification.success) {
                    throw new APIError(
                        verification.unavailable ? "SERVICE_UNAVAILABLE" : "BAD_REQUEST",
                        { message: verification.message },
                    );
                }
            }

            if (ctx.path !== "/sign-up/email") {
                return;
            }

            const body = ctx.body as Record<string, unknown>;
            const invitationCode = body?.invitationCode;
            if (!invitationCode || typeof invitationCode !== "string") {
                throw new APIError("BAD_REQUEST", {
                    message: "请输入邀请码",
                });
            }

            const email = typeof body.email === "string" ? body.email.trim() : "";
            if (!email) {
                throw new APIError("BAD_REQUEST", { message: "请输入有效邮箱" });
            }

            const avatarResult = validateAvatarDataUrl(body.image);
            if (!avatarResult.ok) {
                throw new APIError("BAD_REQUEST", { message: avatarResult.error });
            }

            try {
                const reservationId = await reserveInvitationCode(pool, {
                    code: invitationCode.trim(),
                    email,
                });
                (ctx.context as typeof ctx.context & { invitationReservationId?: string })
                    .invitationReservationId = reservationId;
            } catch (error) {
                if (error instanceof InvitationReservationError) {
                    throw new APIError("BAD_REQUEST", { message: error.message });
                }
                throw error;
            }
        }),
        after: createAuthMiddleware(async (ctx) => {
            if (ctx.path !== "/sign-up/email") {
                return;
            }

            const reservationId = (
                ctx.context as typeof ctx.context & { invitationReservationId?: string }
            ).invitationReservationId;
            if (!reservationId) return;

            const returned = ctx.context.returned as
                | { token: string | null; user?: { id?: string; email?: string } }
                | APIError
                | undefined;

            if (!returned || returned instanceof APIError || !("user" in returned) || !returned.user) {
                await releaseInvitationReservation(pool, reservationId);
                return;
            }

            const userId = returned.user.id;
            const userEmail = returned.user.email;

            if (!userId || !userEmail) {
                await releaseInvitationReservation(pool, reservationId);
                return;
            }

            try {
                await consumeInvitationReservation(pool, {
                    reservationId,
                    userId,
                    email: userEmail,
                });
                invalidateInvitationCodeCache();
            } catch (error) {
                await deleteUnfinishedAccount(pool, userId);
                await releaseInvitationReservation(pool, reservationId).catch(() => undefined);
                console.error("邀请码最终化失败，已补偿删除未完成账户", error);
                throw new APIError("INTERNAL_SERVER_ERROR", {
                    message: "注册未能安全完成，请稍后重试",
                });
            }
        }),
    },
})
