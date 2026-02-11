import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import { admin } from "better-auth/plugins"
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";

export const auth = betterAuth({
    database: new Pool({
        connectionString: process.env.DATABASE_URL,
    }),
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
})