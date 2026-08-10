const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isSameOriginMutation(request: Request): boolean {
    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

    const origin = request.headers.get("origin");
    if (!origin) return false;

    try {
        return new URL(origin).origin === new URL(request.url).origin;
    } catch {
        return false;
    }
}

export function isOriginCheckExempt(pathname: string): boolean {
    return pathname.startsWith("/api/auth/") || pathname === "/forms/submissions/access";
}
