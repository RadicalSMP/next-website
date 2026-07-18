import {
    normalizeFormFields,
    normalizeResultConfig,
} from "@/lib/forms";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readEmailValue(data: Record<string, unknown>, fieldKey: string | null) {
    if (!fieldKey) return null;
    const value = data[fieldKey];
    if (typeof value !== "string") return null;
    const email = value.trim().toLowerCase();
    return EMAIL_PATTERN.test(email) ? email : null;
}

export function resolveSubmissionRecipient(input: {
    userId: string | null;
    userEmail: string | null;
    accountEmail: string | null;
    data: Record<string, unknown>;
    fieldSnapshot: unknown;
    resultConfig: unknown;
}) {
    const fields = normalizeFormFields(input.fieldSnapshot);
    const config = normalizeResultConfig(input.resultConfig, fields);
    const accountEmail = (input.accountEmail ?? input.userEmail ?? "").trim().toLowerCase();

    if (config.notifications.recipient.source === "account_email") {
        return {
            email: EMAIL_PATTERN.test(accountEmail) ? accountEmail : null,
            source: "account_email" as const,
            configured: config.notifications.enabled,
        };
    }

    const fieldKey = config.notifications.recipient.fieldKey ?? config.fieldMappings.email;
    return {
        email: readEmailValue(input.data, fieldKey),
        source: "mapped_field" as const,
        configured: config.notifications.enabled,
    };
}
