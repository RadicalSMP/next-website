import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import { admin } from "better-auth/plugins"

export const auth = betterAuth({
    database: new Pool({
        // connection options
        connectionString: process.env.DATABASE_URL,
    }),
    emailAndPassword: {
        enabled: true,
        async sendResetPassword(data, request) {
            // TODO: 补全重置密码逻辑
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
    user: {
        // 补充的额外字段
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