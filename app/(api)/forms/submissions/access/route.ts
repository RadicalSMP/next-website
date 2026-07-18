import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
    exchangeSubmissionAccessToken,
    getSubmissionAccessCookieName,
    SubmissionAccessTokenError,
} from "@/lib/form-submission-access";

function errorRedirect(request: NextRequest, reason: string) {
    const target = new URL("/forms/submissions/access-error", request.url);
    target.searchParams.set("reason", reason);
    const response = NextResponse.redirect(target, 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
}

export async function GET(request: NextRequest) {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!token) {
        return errorRedirect(request, "token_missing");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const exchanged = await exchangeSubmissionAccessToken(client, token);
        await client.query("COMMIT");

        const target = new URL(`/forms/submissions/${exchanged.submissionId}`, request.url);
        const response = NextResponse.redirect(target, 303);
        response.cookies.set({
            name: getSubmissionAccessCookieName(exchanged.submissionId),
            value: exchanged.cookieToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            expires: exchanged.expiresAt,
        });
        response.headers.set("Cache-Control", "no-store");
        response.headers.set("Referrer-Policy", "no-referrer");
        return response;
    } catch (error) {
        await client.query("ROLLBACK");
        if (error instanceof SubmissionAccessTokenError) {
            return errorRedirect(request, error.code);
        }
        return errorRedirect(request, "exchange_failed");
    } finally {
        client.release();
    }
}
