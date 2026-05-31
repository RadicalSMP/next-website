export type FormVisibility = "public" | "authenticated" | "members";
export type FormStatus = "draft" | "published" | "archived";

export type FormFieldType =
    | "text"
    | "textarea"
    | "number"
    | "radio"
    | "checkbox"
    | "select"
    | "toggle"
    | "date"
    | "email"
    | "qq"
    | "mcid";

export interface FormFieldOption {
    label: string;
    value: string;
}

export interface FormFieldValidation {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
}

export interface FormField {
    key: string;
    label: string;
    type: FormFieldType;
    required: boolean;
    enabled: boolean;
    placeholder?: string | null;
    helpText?: string | null;
    defaultValue?: string | number | boolean | string[] | null;
    options?: FormFieldOption[];
    validation?: FormFieldValidation;
}

export interface FormSettings {
    submitLabel: string;
    successMessage: string;
    introText: string;
}

export interface FormVersionPayload {
    title: string;
    description: string | null;
    fields: FormField[];
    settings: FormSettings;
}

export interface FormBasePayload {
    title: string;
    slug: string;
    description: string | null;
    visibility: FormVisibility;
    allowedUserIds: string[];
    status: FormStatus;
}

export const FORM_FIELD_TYPES: FormFieldType[] = [
    "text",
    "textarea",
    "number",
    "radio",
    "checkbox",
    "select",
    "toggle",
    "date",
    "email",
    "qq",
    "mcid",
];

export const DEFAULT_FORM_SETTINGS: FormSettings = {
    submitLabel: "提交表单",
    successMessage: "提交成功，感谢你的填写。",
    introText: "",
};

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFormFieldType(value: unknown): value is FormFieldType {
    return typeof value === "string" && FORM_FIELD_TYPES.includes(value as FormFieldType);
}

export function slugifyFormKey(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
}

export function createEmptyFormField(index = 0): FormField {
    return {
        key: `field_${index + 1}`,
        label: "",
        type: "text",
        required: false,
        enabled: true,
        placeholder: "",
        helpText: "",
        defaultValue: "",
        options: [],
        validation: {},
    };
}

export function cloneFormField(field: FormField): FormField {
    return {
        ...field,
        options: field.options ? field.options.map((option) => ({ ...option })) : [],
        validation: field.validation ? { ...field.validation } : {},
    };
}

export function createEmptyFormVersion(title = "", description: string | null = null): FormVersionPayload {
    return {
        title,
        description,
        fields: [createEmptyFormField()],
        settings: { ...DEFAULT_FORM_SETTINGS },
    };
}

function coerceString(value: unknown, fallback = "") {
    return typeof value === "string" ? value : fallback;
}

function coerceBoolean(value: unknown, fallback = false) {
    return typeof value === "boolean" ? value : fallback;
}

function coerceNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

function normalizeDefaultValue(value: unknown): string | number | boolean | string[] | null {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === "string");
    }
    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
    ) {
        return value;
    }
    return "";
}

function normalizeOptions(rawOptions: unknown): FormFieldOption[] {
    if (!Array.isArray(rawOptions)) {
        return [];
    }

    return rawOptions
        .map((item) => {
            if (typeof item === "string") {
                const trimmed = item.trim();
                if (!trimmed) {
                    return null;
                }
                return { label: trimmed, value: trimmed };
            }
            if (!isRecord(item)) {
                return null;
            }
            const label = coerceString(item.label, "").trim();
            const value = coerceString(item.value, label).trim();
            if (!label || !value) {
                return null;
            }
            return { label, value };
        })
        .filter((item): item is FormFieldOption => item !== null);
}

function normalizeDefaultValueByType(
    type: FormFieldType,
    value: unknown,
): string | number | boolean | string[] | null {
    switch (type) {
        case "number":
            return typeof value === "number"
                ? value
                : typeof value === "string" && value.trim().length > 0
                    ? Number(value)
                    : "";
        case "checkbox":
            return Array.isArray(value)
                ? value.filter((item): item is string => typeof item === "string")
                : [];
        case "toggle":
            return typeof value === "boolean" ? value : Boolean(value);
        default:
            return normalizeDefaultValue(value);
    }
}

export function normalizeFormField(raw: unknown, index = 0): FormField {
    const base = isRecord(raw) ? raw : {};
    const label = coerceString(base.label, "").trim();
    const keyRaw = coerceString(base.key, "").trim();
    const key = keyRaw.length > 0 ? keyRaw : slugifyFormKey(label) || `field_${index + 1}`;
    const type = isFormFieldType(base.type) ? base.type : "text";
    const options = normalizeOptions(base.options);

    return {
        key,
        label,
        type,
        required: coerceBoolean(base.required, false),
        enabled: coerceBoolean(base.enabled, true),
        placeholder: coerceString(base.placeholder, "").trim(),
        helpText: coerceString(base.helpText, "").trim(),
        defaultValue: normalizeDefaultValueByType(type, base.defaultValue),
        options,
        validation: isRecord(base.validation)
            ? {
                  min: coerceNumber(base.validation.min),
                  max: coerceNumber(base.validation.max),
                  minLength: coerceNumber(base.validation.minLength),
                  maxLength: coerceNumber(base.validation.maxLength),
                  pattern: coerceString(base.validation.pattern, "").trim() || undefined,
              }
            : {},
    };
}

export function normalizeFormFields(rawFields: unknown): FormField[] {
    if (!Array.isArray(rawFields)) {
        return [];
    }

    return rawFields.map((field, index) => normalizeFormField(field, index));
}

export function hasDuplicateFieldKeys(fields: FormField[]) {
    const seen = new Set<string>();
    for (const field of fields) {
        if (seen.has(field.key)) {
            return true;
        }
        seen.add(field.key);
    }
    return false;
}

export function validateFormVersionPayload(raw: unknown) {
    if (!isRecord(raw)) {
        return { ok: false as const, error: "版本数据格式无效" };
    }

    const title = coerceString(raw.title, "").trim();
    if (!title) {
        return { ok: false as const, error: "表单标题不能为空" };
    }

    const description = raw.description === null ? null : coerceString(raw.description, "").trim() || null;
    const fields = normalizeFormFields(raw.fields);
    if (fields.length === 0) {
        return { ok: false as const, error: "至少需要一个字段" };
    }
    if (fields.some((field) => !field.label.trim())) {
        return { ok: false as const, error: "字段标题不能为空" };
    }
    if (fields.some((field) => !field.key.trim())) {
        return { ok: false as const, error: "字段 key 不能为空" };
    }
    if (hasDuplicateFieldKeys(fields)) {
        return { ok: false as const, error: "字段 key 不能重复" };
    }

    for (const field of fields) {
        if (["radio", "checkbox", "select"].includes(field.type) && (field.options ?? []).length === 0) {
            return { ok: false as const, error: `字段「${field.label}」需要至少一个选项` };
        }
    }

    const settings = isRecord(raw.settings) ? raw.settings : {};
    const normalized: FormVersionPayload = {
        title,
        description,
        fields,
        settings: {
            submitLabel: coerceString(settings.submitLabel, DEFAULT_FORM_SETTINGS.submitLabel).trim() || DEFAULT_FORM_SETTINGS.submitLabel,
            successMessage: coerceString(settings.successMessage, DEFAULT_FORM_SETTINGS.successMessage).trim() || DEFAULT_FORM_SETTINGS.successMessage,
            introText: coerceString(settings.introText, DEFAULT_FORM_SETTINGS.introText).trim(),
        },
    };

    return { ok: true as const, value: normalized };
}

export function validateFormBasePayload(raw: unknown) {
    if (!isRecord(raw)) {
        return { ok: false as const, error: "表单基础信息格式无效" };
    }

    const title = coerceString(raw.title, "").trim();
    const slug = coerceString(raw.slug, "").trim();
    const description = raw.description === null ? null : coerceString(raw.description, "").trim() || null;
    const visibility = coerceString(raw.visibility, "public") as FormVisibility;
    const status = coerceString(raw.status, "draft") as FormStatus;
    const allowedUserIds = Array.isArray(raw.allowedUserIds)
        ? raw.allowedUserIds
              .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
              .map((value) => value.trim())
        : [];

    if (!title) {
        return { ok: false as const, error: "表单标题不能为空" };
    }
    if (!slug) {
        return { ok: false as const, error: "slug 不能为空" };
    }
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
        return { ok: false as const, error: "slug 只能包含小写字母、数字和连字符，且不能以连字符开头或结尾" };
    }
    if (!["public", "authenticated", "members"].includes(visibility)) {
        return { ok: false as const, error: "无效的可见性设置" };
    }
    if (!["draft", "published", "archived"].includes(status)) {
        return { ok: false as const, error: "无效的状态设置" };
    }

    return {
        ok: true as const,
        value: {
            title,
            slug,
            description,
            visibility,
            status,
            allowedUserIds,
        } satisfies FormBasePayload,
    };
}

export function buildSubmissionDefaults(fields: FormField[]) {
    const values: Record<string, string | number | boolean | string[]> = {};
    for (const field of fields) {
        if (field.defaultValue !== undefined && field.defaultValue !== null) {
            values[field.key] = field.defaultValue;
            continue;
        }
        switch (field.type) {
            case "checkbox":
                values[field.key] = [];
                break;
            case "toggle":
                values[field.key] = false;
                break;
            case "number":
                values[field.key] = "";
                break;
            default:
                values[field.key] = "";
                break;
        }
    }
    return values;
}

export function validateSubmissionValues(fields: FormField[], data: Record<string, unknown>) {
    const normalized: Record<string, string | number | boolean | string[] | null> = {};

    for (const field of fields.filter((item) => item.enabled)) {
        const value = data[field.key];

        if (field.required) {
            if (field.type === "checkbox") {
                if (!Array.isArray(value) || value.length === 0) {
                    return { ok: false as const, error: `「${field.label}」为必填项` };
                }
            } else if (field.type === "toggle") {
                if (value !== true) {
                    return { ok: false as const, error: `「${field.label}」为必填项` };
                }
            } else if (value === undefined || value === null || String(value).trim() === "") {
                return { ok: false as const, error: `「${field.label}」为必填项` };
            }
        }

        if (value === undefined || value === null || String(value).trim() === "") {
            normalized[field.key] = field.type === "checkbox"
                ? []
                : field.type === "toggle"
                    ? false
                    : "";
            continue;
        }

        switch (field.type) {
            case "number": {
                const parsed = typeof value === "number" ? value : Number(value);
                if (!Number.isFinite(parsed)) {
                    return { ok: false as const, error: `「${field.label}」必须是数字` };
                }
                normalized[field.key] = parsed;
                break;
            }
            case "checkbox": {
                const rawValues = Array.isArray(value) ? value.map(String) : [String(value)];
                const allowedValues = (field.options ?? []).map((option) => option.value);
                if (
                    allowedValues.length > 0 &&
                    rawValues.some((item) => !allowedValues.includes(item))
                ) {
                    return { ok: false as const, error: `「${field.label}」的取值无效` };
                }
                normalized[field.key] = rawValues;
                break;
            }
            case "toggle":
                normalized[field.key] = Boolean(value);
                break;
            case "radio":
            case "select": {
                const rawValue = String(value);
                const allowedValues = (field.options ?? []).map((option) => option.value);
                if (allowedValues.length > 0 && !allowedValues.includes(rawValue)) {
                    return { ok: false as const, error: `「${field.label}」的取值无效` };
                }
                normalized[field.key] = rawValue;
                break;
            }
            case "date":
            case "email":
            case "qq":
            case "mcid":
            case "text":
            case "textarea":
            default:
                normalized[field.key] = String(value);
                break;
        }
    }

    return { ok: true as const, value: normalized };
}

export function csvEscape(value: unknown) {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[,"\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}
