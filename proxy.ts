import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
    const sessionCookie = getSessionCookie(request);
    const { pathname } = request.nextUrl;

    if (sessionCookie && ["/sign-in", "/sign-up"].includes(pathname)) {
        return NextResponse.redirect(new URL("/", request.url));
    }

    if (!sessionCookie && pathname.startsWith("/dashboard")) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*", "/sign-in", "/sign-up"],
};
