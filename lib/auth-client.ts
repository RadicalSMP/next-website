import { createAuthClient } from "better-auth/react";
import type { auth } from "./auth";
import { 
    inferAdditionalFields,
    adminClient
 } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL,
    plugins: [ 
        inferAdditionalFields < typeof auth > (),
        adminClient(),
    ],
});

export const {
    signIn,
    signOut,
    signUp,
    useSession,
    requestPasswordReset,
    resetPassword,
    sendVerificationEmail,
} = authClient;