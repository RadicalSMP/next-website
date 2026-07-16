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

export type ResultGradingMode = "none" | "objective" | "manual" | "mixed";
export type ResultGradeType = "auto" | "manual";
export type ResultMatchStrategy = "exact" | "partial";
export type ResultRecipientSource = "mapped_field" | "account_email";
export type ResultNotificationTemplate =
    | "join_application_result"
    | "score_result"
    | "generic_result"
    | null;
export type SubmissionNotificationTemplate =
    | Exclude<ResultNotificationTemplate, null>
    | "revision_requested";
export type SubmissionGradingStatus =
    | "not_required"
    | "auto_graded"
    | "manual_required"
    | "graded";
export type SubmissionProcessingStatus =
    | "not_required"
    | "pending"
    | "approved"
    | "rejected"
    | "needs_changes";
export type SubmissionRevisionStatus = "none" | "requested" | "resubmitted";
export type RevisionRequestStatus = "open" | "fulfilled" | "cancelled" | "expired";
export type RevisionEditScope = "all" | "selected";
export type SubmissionAccessScope = "view" | "revise";
export type SubmissionNotificationStatus = "pending" | "sending" | "sent" | "failed";
export type SubmissionNotificationEvent =
    | "revision_requested"
    | "grading_completed"
    | "processing_changed";
export type SubmissionRevisionSource = "initial" | "account" | "token";

export interface ResultCollectionConfig {
    enabled: boolean;
    label: string;
    allowAnonymous: boolean;
}

export interface ResultGradingRule {
    fieldKey: string;
    enabled: boolean;
    gradingType: ResultGradeType;
    correctAnswer?: string | number | boolean | string[] | null;
    maxScore: number;
    matchStrategy: ResultMatchStrategy;
    requiredManual: boolean;
    prompt: string;
}

export interface ResultGradingConfig {
    enabled: boolean;
    mode: ResultGradingMode;
    rules: ResultGradingRule[];
}

export interface ResultProcessingConfig {
    enabled: boolean;
    statuses: SubmissionProcessingStatus[];
    defaultStatus: SubmissionProcessingStatus;
}

export interface ResultNotificationConfig {
    enabled: boolean;
    template: ResultNotificationTemplate;
    recipient: {
        source: ResultRecipientSource;
        fieldKey: string | null;
    };
    autoSend: boolean;
    events: {
        revisionRequested: boolean;
        gradingCompleted: boolean;
        processingChanged: boolean;
    };
    content: {
        includeQuestionScores: boolean;
        includeComments: boolean;
        includeCorrectAnswers: boolean;
    };
}

export interface ResultFieldMappings {
    email: string | null;
    playerName: string | null;
    qq: string | null;
    mcid: string | null;
}

export interface FormResultConfig {
    collection: ResultCollectionConfig;
    grading: ResultGradingConfig;
    processing: ResultProcessingConfig;
    notifications: ResultNotificationConfig;
    fieldMappings: ResultFieldMappings;
}

export interface FormVersionPayload {
    title: string;
    description: string | null;
    fields: FormField[];
    settings: FormSettings;
    resultConfig: FormResultConfig;
}

export interface FormBasePayload {
    title: string;
    slug: string;
    description: string | null;
    visibility: FormVisibility;
    allowedUserIds: string[];
    status: FormStatus;
}

export interface SubmissionGradeDraft {
    fieldKey: string;
    fieldLabel: string;
    fieldType: FormFieldType;
    answer: string | number | boolean | string[] | null;
    expectedAnswer: string | number | boolean | string[] | null;
    score: number | null;
    maxScore: number;
    gradingType: ResultGradeType;
    matched: boolean | null;
    comment: string | null;
    ruleSnapshot: ResultGradingRule;
    gradedBy: string | null;
    gradedAt: string | null;
}

export interface SubmissionGradeResult {
    gradingStatus: SubmissionGradingStatus;
    processingStatus: SubmissionProcessingStatus;
    totalScore: number | null;
    maxScore: number | null;
    grades: SubmissionGradeDraft[];
}

export interface FormSubmissionRevision {
    id: string;
    submissionId: string;
    revisionNumber: number;
    sourceRequestId: string | null;
    data: Record<string, unknown>;
    fieldSnapshot: FormField[];
    submittedBy: string | null;
    submittedVia: SubmissionRevisionSource;
    ipAddress: string | null;
    userAgent: string | null;
    fingerprint: string | null;
    duration: number | null;
    createdAt: string;
}

export interface SubmissionRevisionRequest {
    id: string;
    submissionId: string;
    baseRevisionId: string;
    editScope: RevisionEditScope;
    editableFieldKeys: string[];
    reason: string;
    status: RevisionRequestStatus;
    expiresAt: string | null;
    requestedBy: string;
    fulfilledRevisionId: string | null;
    createdAt: string;
    fulfilledAt: string | null;
    cancelledAt: string | null;
}

export interface SubmissionNotification {
    id: string;
    submissionId: string;
    revisionId: string | null;
    revisionRequestId: string | null;
    eventType: SubmissionNotificationEvent;
    template: SubmissionNotificationTemplate;
    recipient: string;
    payload: Record<string, unknown>;
    status: SubmissionNotificationStatus;
    attempts: number;
    idempotencyKey: string;
    providerMessageId: string | null;
    lastError: string | null;
    sentAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export const UNTITLED_FORM_TITLE = "未命名表单";
const RESERVED_FORM_SLUGS = new Set(["my-submissions", "submissions"]);

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

export const DEFAULT_RESULT_CONFIG: FormResultConfig = {
    collection: {
        enabled: true,
        label: "",
        allowAnonymous: true,
    },
    grading: {
        enabled: false,
        mode: "none",
        rules: [],
    },
    processing: {
        enabled: false,
        statuses: ["pending", "approved", "rejected", "needs_changes"],
        defaultStatus: "pending",
    },
    notifications: {
        enabled: false,
        template: null,
        recipient: {
            source: "mapped_field",
            fieldKey: null,
        },
        autoSend: false,
        events: {
            revisionRequested: true,
            gradingCompleted: true,
            processingChanged: true,
        },
        content: {
            includeQuestionScores: true,
            includeComments: true,
            includeCorrectAnswers: false,
        },
    },
    fieldMappings: {
        email: null,
        playerName: null,
        qq: null,
        mcid: null,
    },
};

const OBJECTIVE_GRADING_FIELD_TYPES: FormFieldType[] = ["radio", "checkbox", "select", "toggle"];
const MANUAL_GRADING_FIELD_TYPES: FormFieldType[] = [
    "text",
    "textarea",
    "number",
    "date",
    "email",
    "qq",
    "mcid",
];
const PROCESSING_STATUSES: SubmissionProcessingStatus[] = [
    "pending",
    "approved",
    "rejected",
    "needs_changes",
];
const NOTIFICATION_TEMPLATES: Exclude<ResultNotificationTemplate, null>[] = [
    "join_application_result",
    "score_result",
    "generic_result",
];

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

export function normalizeFormSlug(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export function createUntitledFormSlug() {
    const suffix = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
    return `untitled-${suffix}`;
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
        resultConfig: cloneResultConfig(DEFAULT_RESULT_CONFIG),
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

function coerceNonNegativeNumber(value: unknown, fallback = 0) {
    const parsed = coerceNumber(value);
    if (parsed === undefined || parsed < 0) {
        return fallback;
    }
    return parsed;
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

export function cloneResultConfig(config: FormResultConfig): FormResultConfig {
    return {
        collection: { ...config.collection },
        grading: {
            ...config.grading,
            rules: config.grading.rules.map((rule) => ({
                ...rule,
                correctAnswer: Array.isArray(rule.correctAnswer)
                    ? [...rule.correctAnswer]
                    : rule.correctAnswer,
            })),
        },
        processing: {
            ...config.processing,
            statuses: [...config.processing.statuses],
        },
        notifications: {
            ...config.notifications,
            recipient: { ...config.notifications.recipient },
            events: { ...config.notifications.events },
            content: { ...config.notifications.content },
        },
        fieldMappings: { ...config.fieldMappings },
    };
}

function findField(fields: FormField[], key: string) {
    return fields.find((field) => field.key === key);
}

export function isObjectiveGradingField(type: FormFieldType) {
    return OBJECTIVE_GRADING_FIELD_TYPES.includes(type);
}

export function isManualGradingField(type: FormFieldType) {
    return MANUAL_GRADING_FIELD_TYPES.includes(type);
}

function normalizeFieldKeyReference(value: unknown, fields: FormField[]) {
    const key = coerceString(value, "").trim();
    return key && findField(fields, key) ? key : null;
}

function normalizeCorrectAnswer(field: FormField, value: unknown) {
    if (field.type === "checkbox") {
        if (!Array.isArray(value)) {
            return [];
        }
        const allowed = new Set((field.options ?? []).map((option) => option.value));
        return value
            .filter((item): item is string => typeof item === "string")
            .filter((item) => allowed.size === 0 || allowed.has(item));
    }

    if (field.type === "toggle") {
        return typeof value === "boolean" ? value : Boolean(value);
    }

    if (field.type === "radio" || field.type === "select") {
        const answer = coerceString(value, "").trim();
        const allowed = (field.options ?? []).map((option) => option.value);
        return allowed.includes(answer) ? answer : "";
    }

    return null;
}

function normalizeGradingRule(raw: unknown, fields: FormField[]): ResultGradingRule | null {
    if (!isRecord(raw)) {
        return null;
    }

    const fieldKey = coerceString(raw.fieldKey, "").trim();
    const field = findField(fields, fieldKey);
    if (!field) {
        return null;
    }

    const isObjective = isObjectiveGradingField(field.type);
    const requestedType = coerceString(raw.gradingType, isObjective ? "auto" : "manual");
    const gradingType: ResultGradeType = isObjective && requestedType !== "manual" ? "auto" : "manual";
    const matchStrategy = coerceString(raw.matchStrategy, "exact") === "partial" ? "partial" : "exact";
    const maxScore = coerceNonNegativeNumber(raw.maxScore, 0);

    return {
        fieldKey,
        enabled: coerceBoolean(raw.enabled, true),
        gradingType,
        correctAnswer: gradingType === "auto" ? normalizeCorrectAnswer(field, raw.correctAnswer) : null,
        maxScore,
        matchStrategy,
        requiredManual: gradingType === "manual" ? coerceBoolean(raw.requiredManual, true) : false,
        prompt: coerceString(raw.prompt, "").trim(),
    };
}

function inferGradingMode(rules: ResultGradingRule[]): ResultGradingMode {
    const enabledRules = rules.filter((rule) => rule.enabled);
    const hasAuto = enabledRules.some((rule) => rule.gradingType === "auto");
    const hasManual = enabledRules.some((rule) => rule.gradingType === "manual");

    if (hasAuto && hasManual) return "mixed";
    if (hasAuto) return "objective";
    if (hasManual) return "manual";
    return "none";
}

export function normalizeResultConfig(raw: unknown, fields: FormField[]): FormResultConfig {
    const source = isRecord(raw) ? raw : {};
    const collection = isRecord(source.collection) ? source.collection : {};
    const grading = isRecord(source.grading) ? source.grading : {};
    const processing = isRecord(source.processing) ? source.processing : {};
    const notifications = isRecord(source.notifications) ? source.notifications : {};
    const recipient = isRecord(notifications.recipient) ? notifications.recipient : {};
    const notificationEvents = isRecord(notifications.events) ? notifications.events : {};
    const notificationContent = isRecord(notifications.content) ? notifications.content : {};
    const mappings = isRecord(source.fieldMappings) ? source.fieldMappings : {};

    const rules = Array.isArray(grading.rules)
        ? grading.rules
            .map((rule) => normalizeGradingRule(rule, fields))
            .filter((rule): rule is ResultGradingRule => rule !== null)
        : [];
    const enabledRules = rules.filter((rule) => rule.enabled);
    const gradingEnabled = coerceBoolean(grading.enabled, false) && enabledRules.length > 0;
    const gradingMode = gradingEnabled ? inferGradingMode(enabledRules) : "none";

    const statuses = Array.isArray(processing.statuses)
        ? processing.statuses
            .filter((status): status is SubmissionProcessingStatus =>
                typeof status === "string" &&
                PROCESSING_STATUSES.includes(status as SubmissionProcessingStatus),
            )
        : [];
    const normalizedStatuses = statuses.length > 0 ? Array.from(new Set(statuses)) : DEFAULT_RESULT_CONFIG.processing.statuses;
    const defaultStatus = coerceString(processing.defaultStatus, DEFAULT_RESULT_CONFIG.processing.defaultStatus) as SubmissionProcessingStatus;
    const safeDefaultStatus = normalizedStatuses.includes(defaultStatus) ? defaultStatus : normalizedStatuses[0] ?? "pending";

    const templateValue = coerceString(notifications.template, "");
    const template = NOTIFICATION_TEMPLATES.includes(templateValue as Exclude<ResultNotificationTemplate, null>)
        ? templateValue as Exclude<ResultNotificationTemplate, null>
        : null;
    const recipientSource = coerceString(recipient.source, "mapped_field") === "account_email"
        ? "account_email"
        : "mapped_field";
    const recipientFieldKey = normalizeFieldKeyReference(recipient.fieldKey, fields);

    return {
        collection: {
            enabled: coerceBoolean(collection.enabled, true),
            label: coerceString(collection.label, "").trim(),
            allowAnonymous: coerceBoolean(collection.allowAnonymous, true),
        },
        grading: {
            enabled: gradingEnabled,
            mode: gradingMode,
            rules: gradingEnabled ? enabledRules : [],
        },
        processing: {
            enabled: coerceBoolean(processing.enabled, false),
            statuses: normalizedStatuses,
            defaultStatus: safeDefaultStatus,
        },
        notifications: {
            enabled: coerceBoolean(notifications.enabled, false) && template !== null,
            template,
            recipient: {
                source: recipientSource,
                fieldKey: recipientSource === "mapped_field" ? recipientFieldKey : null,
            },
            autoSend: coerceBoolean(notifications.autoSend, false),
            events: {
                revisionRequested: coerceBoolean(
                    notificationEvents.revisionRequested,
                    false,
                ),
                gradingCompleted: coerceBoolean(
                    notificationEvents.gradingCompleted,
                    false,
                ),
                processingChanged: coerceBoolean(
                    notificationEvents.processingChanged,
                    false,
                ),
            },
            content: {
                includeQuestionScores: coerceBoolean(
                    notificationContent.includeQuestionScores,
                    DEFAULT_RESULT_CONFIG.notifications.content.includeQuestionScores,
                ),
                includeComments: coerceBoolean(
                    notificationContent.includeComments,
                    DEFAULT_RESULT_CONFIG.notifications.content.includeComments,
                ),
                includeCorrectAnswers: coerceBoolean(
                    notificationContent.includeCorrectAnswers,
                    DEFAULT_RESULT_CONFIG.notifications.content.includeCorrectAnswers,
                ),
            },
        },
        fieldMappings: {
            email: normalizeFieldKeyReference(mappings.email, fields),
            playerName: normalizeFieldKeyReference(mappings.playerName, fields),
            qq: normalizeFieldKeyReference(mappings.qq, fields),
            mcid: normalizeFieldKeyReference(mappings.mcid, fields),
        },
    };
}

export function validateResultConfigForPublish(config: FormResultConfig, fields: FormField[]) {
    const fieldMap = new Map(fields.map((field) => [field.key, field]));

    if (config.grading.enabled) {
        for (const rule of config.grading.rules) {
            const field = fieldMap.get(rule.fieldKey);
            if (!field) {
                return { ok: false as const, error: `批改规则引用了不存在的字段「${rule.fieldKey}」` };
            }
            if (rule.maxScore < 0) {
                return { ok: false as const, error: `字段「${field.label}」的分值不能为负数` };
            }
            if (rule.gradingType === "auto") {
                if (!isObjectiveGradingField(field.type)) {
                    return { ok: false as const, error: `字段「${field.label}」不支持客观题自动批改` };
                }
                if (field.type === "checkbox" && (!Array.isArray(rule.correctAnswer) || rule.correctAnswer.length === 0)) {
                    return { ok: false as const, error: `字段「${field.label}」需要设置正确答案` };
                }
                if (field.type !== "checkbox" && (rule.correctAnswer === "" || rule.correctAnswer === null || rule.correctAnswer === undefined)) {
                    return { ok: false as const, error: `字段「${field.label}」需要设置正确答案` };
                }
            }
            if (rule.gradingType === "manual" && !isManualGradingField(field.type)) {
                return { ok: false as const, error: `字段「${field.label}」不适合作为主观题人工批改` };
            }
        }
    }

    if (config.notifications.enabled && config.notifications.recipient.source === "mapped_field" && !config.notifications.recipient.fieldKey) {
        return { ok: false as const, error: "启用通知时需要选择收件人邮箱字段，或改用账号邮箱" };
    }

    if (
        config.notifications.enabled &&
        config.notifications.autoSend &&
        !Object.values(config.notifications.events).some(Boolean)
    ) {
        return { ok: false as const, error: "启用自动通知时至少需要选择一个触发事件" };
    }

    return { ok: true as const };
}

function normalizeAnswerForCompare(value: unknown) {
    if (Array.isArray(value)) {
        return value.map(String).sort();
    }
    if (typeof value === "boolean") {
        return value;
    }
    if (value === null || value === undefined) {
        return "";
    }
    return String(value);
}

function scoreObjectiveAnswer(rule: ResultGradingRule, answer: unknown) {
    const expected = normalizeAnswerForCompare(rule.correctAnswer);
    const actual = normalizeAnswerForCompare(answer);

    if (Array.isArray(expected)) {
        const actualValues = Array.isArray(actual) ? actual : [];
        if (rule.matchStrategy === "partial") {
            if (expected.length === 0) {
                return { matched: actualValues.length === 0, score: actualValues.length === 0 ? rule.maxScore : 0 };
            }
            const expectedSet = new Set(expected);
            const actualSet = new Set(actualValues);
            const correctCount = [...actualSet].filter((item) => expectedSet.has(item)).length;
            const wrongCount = [...actualSet].filter((item) => !expectedSet.has(item)).length;
            const ratio = Math.max(0, (correctCount - wrongCount) / expectedSet.size);
            const score = Number((rule.maxScore * ratio).toFixed(2));
            return { matched: score === rule.maxScore, score };
        }
        const matched = expected.length === actualValues.length && expected.every((item, index) => item === actualValues[index]);
        return { matched, score: matched ? rule.maxScore : 0 };
    }

    const matched = expected === actual;
    return { matched, score: matched ? rule.maxScore : 0 };
}

export function buildSubmissionGradeResult(
    fields: FormField[],
    values: Record<string, string | number | boolean | string[] | null>,
    resultConfig: FormResultConfig,
): SubmissionGradeResult {
    const processingStatus = resultConfig.processing.enabled
        ? resultConfig.processing.defaultStatus
        : "not_required";

    if (!resultConfig.grading.enabled || resultConfig.grading.rules.length === 0) {
        return {
            gradingStatus: "not_required",
            processingStatus,
            totalScore: null,
            maxScore: null,
            grades: [],
        };
    }

    const grades: SubmissionGradeDraft[] = [];
    let totalScore = 0;
    let maxScore = 0;
    let hasAuto = false;
    let hasManual = false;
    let hasRequiredManual = false;

    for (const rule of resultConfig.grading.rules.filter((item) => item.enabled)) {
        const field = findField(fields, rule.fieldKey);
        if (!field) {
            continue;
        }
        const answer = values[field.key] ?? null;
        maxScore += rule.maxScore;

        if (rule.gradingType === "auto") {
            hasAuto = true;
            const scored = scoreObjectiveAnswer(rule, answer);
            totalScore += scored.score;
            grades.push({
                fieldKey: field.key,
                fieldLabel: field.label,
                fieldType: field.type,
                answer,
                expectedAnswer: rule.correctAnswer ?? null,
                score: scored.score,
                maxScore: rule.maxScore,
                gradingType: "auto",
                matched: scored.matched,
                comment: null,
                ruleSnapshot: rule,
                gradedBy: null,
                gradedAt: new Date().toISOString(),
            });
            continue;
        }

        hasManual = true;
        hasRequiredManual = hasRequiredManual || rule.requiredManual;
        grades.push({
            fieldKey: field.key,
            fieldLabel: field.label,
            fieldType: field.type,
            answer,
            expectedAnswer: null,
            score: null,
            maxScore: rule.maxScore,
            gradingType: "manual",
            matched: null,
            comment: null,
            ruleSnapshot: rule,
            gradedBy: null,
            gradedAt: null,
        });
    }

    const gradingStatus: SubmissionGradingStatus = hasManual && hasRequiredManual
        ? "manual_required"
        : hasAuto
            ? "auto_graded"
            : "not_required";

    return {
        gradingStatus,
        processingStatus,
        totalScore: grades.length > 0 ? totalScore : null,
        maxScore: grades.length > 0 ? maxScore : null,
        grades,
    };
}

export function createJoinApplicationResultPreset(fields: FormField[]): FormResultConfig {
    const findKeyByType = (type: FormFieldType) => fields.find((field) => field.type === type)?.key ?? null;
    const findKeyByText = (patterns: string[]) => {
        const matched = fields.find((field) => {
            const source = `${field.key} ${field.label}`.toLowerCase();
            return patterns.some((pattern) => source.includes(pattern.toLowerCase()));
        });
        return matched?.key ?? null;
    };

    const email = findKeyByType("email") ?? findKeyByText(["email", "邮箱"]);
    const playerName = findKeyByType("mcid") ?? findKeyByText(["mcid", "minecraft", "玩家"]);
    const qq = findKeyByType("qq") ?? findKeyByText(["qq"]);

    return normalizeResultConfig({
        collection: {
            enabled: true,
            label: "入服申请",
            allowAnonymous: true,
        },
        grading: {
            enabled: false,
            mode: "none",
            rules: [],
        },
        processing: {
            enabled: true,
            statuses: ["pending", "approved", "rejected", "needs_changes"],
            defaultStatus: "pending",
        },
        notifications: {
            enabled: true,
            template: "join_application_result",
            recipient: {
                source: email ? "mapped_field" : "account_email",
                fieldKey: email,
            },
            autoSend: true,
            events: {
                revisionRequested: true,
                gradingCompleted: false,
                processingChanged: true,
            },
            content: {
                includeQuestionScores: false,
                includeComments: true,
                includeCorrectAnswers: false,
            },
        },
        fieldMappings: {
            email,
            playerName,
            qq,
            mcid: playerName,
        },
    }, fields);
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
    const resultConfig = normalizeResultConfig(raw.resultConfig ?? raw.result_config, fields);
    const resultConfigValidation = validateResultConfigForPublish(resultConfig, fields);
    if (!resultConfigValidation.ok) {
        return resultConfigValidation;
    }

    const normalized: FormVersionPayload = {
        title,
        description,
        fields,
        settings: {
            submitLabel: coerceString(settings.submitLabel, DEFAULT_FORM_SETTINGS.submitLabel).trim() || DEFAULT_FORM_SETTINGS.submitLabel,
            successMessage: coerceString(settings.successMessage, DEFAULT_FORM_SETTINGS.successMessage).trim() || DEFAULT_FORM_SETTINGS.successMessage,
            introText: coerceString(settings.introText, DEFAULT_FORM_SETTINGS.introText).trim(),
        },
        resultConfig,
    };

    return { ok: true as const, value: normalized };
}

export function normalizeDraftFormVersionPayload(raw: unknown) {
    if (!isRecord(raw)) {
        return { ok: false as const, error: "版本数据格式无效" };
    }

    const title = coerceString(raw.title, "").trim();
    const description = raw.description === null ? null : coerceString(raw.description, "").trim() || null;
    const fields = normalizeFormFields(raw.fields);
    const settings = isRecord(raw.settings) ? raw.settings : {};
    const normalizedFields = fields.length > 0 ? fields : [createEmptyFormField()];

    const normalized: FormVersionPayload = {
        title,
        description,
        fields: normalizedFields,
        settings: {
            submitLabel: coerceString(settings.submitLabel, DEFAULT_FORM_SETTINGS.submitLabel).trim() || DEFAULT_FORM_SETTINGS.submitLabel,
            successMessage: coerceString(settings.successMessage, DEFAULT_FORM_SETTINGS.successMessage).trim() || DEFAULT_FORM_SETTINGS.successMessage,
            introText: coerceString(settings.introText, DEFAULT_FORM_SETTINGS.introText).trim(),
        },
        resultConfig: normalizeResultConfig(raw.resultConfig ?? raw.result_config, normalizedFields),
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
    if (RESERVED_FORM_SLUGS.has(slug)) {
        return { ok: false as const, error: "该 slug 为系统保留路径，请使用其他标识" };
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

export function normalizeDraftFormBasePayload(raw: unknown) {
    if (!isRecord(raw)) {
        return { ok: false as const, error: "表单基础信息格式无效" };
    }

    const title = coerceString(raw.title, "").trim() || UNTITLED_FORM_TITLE;
    const rawSlug = coerceString(raw.slug, "").trim();
    const slug = normalizeFormSlug(rawSlug) || createUntitledFormSlug();
    const description = raw.description === null ? null : coerceString(raw.description, "").trim() || null;
    const visibility = coerceString(raw.visibility, "public") as FormVisibility;
    const status = coerceString(raw.status, "draft") as FormStatus;
    const allowedUserIds = Array.isArray(raw.allowedUserIds)
        ? raw.allowedUserIds
              .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
              .map((value) => value.trim())
        : [];

    if (!["public", "authenticated", "members"].includes(visibility)) {
        return { ok: false as const, error: "无效的可见性设置" };
    }
    if (RESERVED_FORM_SLUGS.has(slug)) {
        return { ok: false as const, error: "该 slug 为系统保留路径，请使用其他标识" };
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
