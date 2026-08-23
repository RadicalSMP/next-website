export async function getResponseError(response: Response, fallback: string) {
    const payload = await response.json().catch(() => null) as { error?: unknown } | null;
    return typeof payload?.error === "string" && payload.error.trim()
        ? payload.error
        : fallback;
}

export function getClientErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
}
