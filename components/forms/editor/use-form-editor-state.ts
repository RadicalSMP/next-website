"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    cloneFormField,
    cloneResultConfig,
    createEmptyFormField,
    createUntitledFormSlug,
    DEFAULT_FORM_SETTINGS,
    DEFAULT_RESULT_CONFIG,
    FormField,
    FormFieldOption,
    FormResultConfig,
    FormFieldType,
    FormSettings,
    FormStatus,
    FormVisibility,
    createJoinApplicationResultPreset,
    normalizeResultConfig,
    normalizeFormSlug,
    validateResultConfigForPublish,
} from "@/lib/forms";
import {
    fieldHasOptions,
    getDefaultOptionsForFieldType,
    getDefaultValueForFieldType,
} from "./constants";
import {
    AllowedUser,
    EditorPanel,
    FormBuilderProps,
    FormEditorPayload,
    FormVersionSummary,
    LocalDraft,
    PublishIssue,
    SaveState,
} from "./types";

function formatSlug(value: string) {
    return normalizeFormSlug(value);
}

function makeField(index: number, type: FormFieldType = "text"): FormField {
    const field = createEmptyFormField(index);
    return {
        ...field,
        type,
        label: type === "text" ? "" : "",
        defaultValue: getDefaultValueForFieldType(type),
        options: getDefaultOptionsForFieldType(type),
    };
}

function sanitizeKey(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function sanitizeOptions(options: FormFieldOption[]) {
    return options
        .map((option) => {
            const label = option.label.trim();
            return {
                label,
                value: (option.value || label).trim() || label,
            };
        })
        .filter((option) => option.label && option.value);
}

function hasDuplicateKeys(fields: FormField[]) {
    const seen = new Set<string>();
    for (const field of fields) {
        const key = field.key.trim();
        if (seen.has(key)) return true;
        seen.add(key);
    }
    return false;
}

function normalizePayload(payload: FormEditorPayload): FormEditorPayload {
    const fields = payload.fields.map((field) => ({
        ...field,
        key: sanitizeKey(field.key),
        label: field.label.trim(),
        helpText: field.helpText?.trim() || "",
        placeholder: field.placeholder?.trim() || "",
        options: sanitizeOptions(field.options ?? []),
    }));

    return {
        ...payload,
        title: payload.title.trim(),
        slug: formatSlug(payload.slug),
        description: payload.description?.trim() || null,
        fields,
        settings: {
            submitLabel: payload.settings.submitLabel.trim() || DEFAULT_FORM_SETTINGS.submitLabel,
            successMessage: payload.settings.successMessage.trim() || DEFAULT_FORM_SETTINGS.successMessage,
            introText: payload.settings.introText.trim(),
        },
        resultConfig: normalizeResultConfig(payload.resultConfig, fields),
    };
}

function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }

    if (value && typeof value === "object") {
        return `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
            .join(",")}}`;
    }

    return JSON.stringify(value);
}

function getPayloadSnapshot(payload: FormEditorPayload): string {
    return stableStringify(normalizePayload(payload));
}

function normalizeDraftPayload(payload: FormEditorPayload, fallbackSlug?: string): FormEditorPayload {
    const normalized = normalizePayload(payload);
    const fields = normalized.fields.length > 0 ? normalized.fields : [makeField(0)];
    return {
        ...normalized,
        slug: normalized.slug || fallbackSlug || createUntitledFormSlug(),
        fields,
        resultConfig: normalizeResultConfig(normalized.resultConfig, fields),
    };
}

function resolveDraftSlug(payload: FormEditorPayload, fallbackSlugRef: { current: string | null }) {
    const normalizedSlug = formatSlug(payload.slug);
    if (normalizedSlug) {
        fallbackSlugRef.current = normalizedSlug;
        return normalizedSlug;
    }

    if (!fallbackSlugRef.current) {
        fallbackSlugRef.current = createUntitledFormSlug();
    }
    return fallbackSlugRef.current;
}

function replaceEditorUrl(id: string) {
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", `/dashboard/forms/${id}/edit`);
}

function getServerBlockReason(payload: FormEditorPayload, fallbackSlug?: string) {
    const normalized = normalizeDraftPayload(payload, fallbackSlug);
    if (hasDuplicateKeys(normalized.fields)) return "字段 key 不能重复";
    return null;
}

export function getPublishIssues(payload: FormEditorPayload): PublishIssue[] {
    const normalized = normalizePayload(payload);
    const issues: PublishIssue[] = [];

    if (!normalized.title) {
        issues.push({
            id: "title",
            label: "表单标题",
            detail: "标题不能为空。",
            severity: "error",
        });
    }
    if (!normalized.slug) {
        issues.push({
            id: "slug-empty",
            label: "访问标识",
            detail: "slug 不能为空。",
            severity: "error",
        });
    } else if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized.slug)) {
        issues.push({
            id: "slug-format",
            label: "访问标识",
            detail: "只能包含小写字母、数字和连字符，且不能以连字符开头或结尾。",
            severity: "error",
        });
    }
    if (normalized.fields.length === 0) {
        issues.push({
            id: "fields-empty",
            label: "题目",
            detail: "至少需要一个字段。",
            severity: "error",
        });
    }

    const seen = new Map<string, number>();
    normalized.fields.forEach((field, index) => {
        if (!field.label) {
            issues.push({
                id: `field-label-${index}`,
                label: `题目 ${index + 1}`,
                detail: "字段标题不能为空。",
                severity: "error",
                fieldIndex: index,
            });
        }
        if (!field.key) {
            issues.push({
                id: `field-key-${index}`,
                label: field.label || `题目 ${index + 1}`,
                detail: "字段 key 不能为空。",
                severity: "error",
                fieldIndex: index,
            });
        } else if (seen.has(field.key)) {
            issues.push({
                id: `field-key-duplicate-${index}`,
                label: field.label || `题目 ${index + 1}`,
                detail: `字段 key 与题目 ${seen.get(field.key)! + 1} 重复。`,
                severity: "error",
                fieldIndex: index,
            });
        } else {
            seen.set(field.key, index);
        }

        if (fieldHasOptions(field.type) && (field.options ?? []).length === 0) {
            issues.push({
                id: `field-options-${index}`,
                label: field.label || `题目 ${index + 1}`,
                detail: "选项型字段至少需要一个选项。",
                severity: "error",
                fieldIndex: index,
            });
        }
    });

    if (normalized.visibility === "members" && normalized.allowedUserIds.length === 0) {
        issues.push({
            id: "members-empty",
            label: "指定成员",
            detail: "当前可见性为指定成员，但尚未选择成员。",
            severity: "error",
        });
    }

    if (!normalized.settings.submitLabel) {
        issues.push({
            id: "submit-label",
            label: "提交按钮",
            detail: "提交按钮文本为空时会使用默认文案。",
            severity: "warning",
        });
    }

    const resultConfigValidation = validateResultConfigForPublish(normalized.resultConfig, normalized.fields);
    if (!resultConfigValidation.ok) {
        issues.push({
            id: "result-config",
            label: "结果设置",
            detail: resultConfigValidation.error,
            severity: "error",
        });
    }

    return issues;
}

function getDraftKey(id: string | null) {
    return `form-editor:draft:${id ?? "new"}`;
}

function readLocalDraft(key: string): LocalDraft | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as LocalDraft;
        if (!parsed?.payload || typeof parsed.updatedAt !== "number") return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeLocalDraft(key: string, draft: LocalDraft) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(draft));
}

function removeLocalDraft(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
}

export function useFormEditorState({ mode, formId }: FormBuilderProps) {
    const router = useRouter();
    const [activeMode, setActiveMode] = useState(mode);
    const [activeFormId, setActiveFormId] = useState<string | null>(formId ?? null);
    const [loading, setLoading] = useState(mode === "edit");
    const [manualSaving, setManualSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [saveMessage, setSaveMessage] = useState("尚未修改");
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
    const [pendingLocalDraft, setPendingLocalDraft] = useState<LocalDraft | null>(null);
    const [panel, setPanel] = useState<EditorPanel>("field");

    const [title, setTitleState] = useState("");
    const [description, setDescription] = useState("");
    const [slug, setSlugState] = useState("");
    const [visibility, setVisibility] = useState<FormVisibility>("public");
    const [status, setStatus] = useState<FormStatus>("draft");
    const [fields, setFields] = useState<FormField[]>([makeField(0)]);
    const [settings, setSettings] = useState<FormSettings>({ ...DEFAULT_FORM_SETTINGS });
    const [resultConfig, setResultConfig] = useState<FormResultConfig>(() => cloneResultConfig(DEFAULT_RESULT_CONFIG));
    const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
    const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [memberSearchResults, setMemberSearchResults] = useState<AllowedUser[]>([]);
    const [memberSearching, setMemberSearching] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [versions, setVersions] = useState<FormVersionSummary[]>([]);
    const [currentVersion, setCurrentVersion] = useState<number | null>(null);
    const [publishedAt, setPublishedAt] = useState<string | null>(null);

    const hydratedRef = useRef(false);
    const skipNextDraftWriteRef = useRef(false);
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestPayloadRef = useRef<FormEditorPayload | null>(null);
    const lastSyncedSnapshotRef = useRef<string | null>(null);
    const slugManuallyEditedRef = useRef(false);
    const generatedDraftSlugRef = useRef<string | null>(null);

    const selectedField = fields[selectedIndex] ?? fields[0] ?? null;

    const payload = useMemo<FormEditorPayload>(() => ({
        title,
        description: description.trim() || null,
        slug,
        visibility,
        status,
        allowedUserIds,
        fields,
        settings,
        resultConfig,
    }), [allowedUserIds, description, fields, resultConfig, settings, slug, status, title, visibility]);

    latestPayloadRef.current = payload;

    const storageKey = useMemo(() => getDraftKey(activeFormId), [activeFormId]);

    const applyPayload = useCallback((nextPayload: FormEditorPayload) => {
        const normalizedFields = nextPayload.fields.length > 0 ? nextPayload.fields : [makeField(0)];
        const normalized = {
            ...nextPayload,
            fields: normalizedFields,
            settings: { ...DEFAULT_FORM_SETTINGS, ...nextPayload.settings },
            resultConfig: normalizeResultConfig(nextPayload.resultConfig, normalizedFields),
        };
        setTitleState(normalized.title || "");
        setDescription(normalized.description || "");
        setSlugState(normalized.slug || "");
        slugManuallyEditedRef.current = Boolean(normalized.slug);
        generatedDraftSlugRef.current = normalized.slug || generatedDraftSlugRef.current;
        setVisibility(normalized.visibility || "public");
        setStatus(normalized.status || "draft");
        setAllowedUserIds(normalized.allowedUserIds || []);
        setFields(normalized.fields);
        setSettings(normalized.settings);
        setResultConfig(normalized.resultConfig);
        setSelectedIndex(0);
    }, []);

    const loadForm = useCallback(async (targetId: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/forms/${targetId}`);
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "表单不存在");
                router.push("/dashboard/forms");
                return;
            }

            const form = data.form;
            const draft = form.draft_payload || {};
            const draftFields = Array.isArray(draft.fields) && draft.fields.length > 0
                ? draft.fields
                : [makeField(0)];
            const loadedPayload: FormEditorPayload = {
                title: typeof draft.title === "string" ? draft.title : "",
                description: typeof draft.description === "string" || draft.description === null
                    ? draft.description
                    : form.description || null,
                slug: form.slug || "",
                visibility: form.visibility || "public",
                status: form.status || "draft",
                allowedUserIds: form.allowed_user_ids || [],
                fields: draftFields,
                settings: { ...DEFAULT_FORM_SETTINGS, ...(draft.settings || {}) },
                resultConfig: normalizeResultConfig(
                    draft.resultConfig ?? draft.result_config ?? form.current_result_config ?? DEFAULT_RESULT_CONFIG,
                    draftFields,
                ),
            };

            skipNextDraftWriteRef.current = true;
            applyPayload(loadedPayload);
            const serverSnapshot = getPayloadSnapshot(loadedPayload);
            lastSyncedSnapshotRef.current = serverSnapshot;
            setAllowedUsers(data.allowedUsers || []);
            setVersions(data.versions || []);
            setCurrentVersion(form.current_version ?? null);
            setPublishedAt(form.published_at ?? null);
            setSaveState("synced");
            setSaveMessage("已加载服务器草稿");
            setLastSyncedAt(Date.now());

            const draftKey = getDraftKey(targetId);
            const localDraft = readLocalDraft(draftKey);
            if (localDraft) {
                const localSnapshot = getPayloadSnapshot(localDraft.payload);
                const isLocalDraftNewer = !localDraft.syncedAt || localDraft.updatedAt > localDraft.syncedAt;

                if (localSnapshot !== serverSnapshot && isLocalDraftNewer) {
                    setPendingLocalDraft(localDraft);
                } else if (localSnapshot === serverSnapshot) {
                    removeLocalDraft(draftKey);
                }
            }
        } catch {
            toast.error("加载表单失败");
        } finally {
            hydratedRef.current = true;
            setLoading(false);
        }
    }, [applyPayload, router]);

    useEffect(() => {
        if (mode === "edit" && formId) {
            setActiveMode("edit");
            setActiveFormId(formId);
            loadForm(formId);
            return;
        }

        hydratedRef.current = true;
        setLoading(false);
        const localDraft = readLocalDraft(getDraftKey(null));
        if (localDraft) {
            setPendingLocalDraft(localDraft);
        } else if (latestPayloadRef.current) {
            lastSyncedSnapshotRef.current = getPayloadSnapshot(latestPayloadRef.current);
        }
    }, [formId, loadForm, mode]);

    const persistToServer = useCallback(async (showToast = false) => {
        const currentPayload = latestPayloadRef.current;
        if (!currentPayload) return null;

        const draftSlug = resolveDraftSlug(currentPayload, generatedDraftSlugRef);
        const normalizedPayload = normalizeDraftPayload(currentPayload, draftSlug);
        const snapshot = getPayloadSnapshot(normalizedPayload);
        if (lastSyncedSnapshotRef.current === snapshot) {
            setSaveState("synced");
            setSaveMessage("已同步服务器");
            return activeFormId;
        }

        const blockReason = getServerBlockReason(currentPayload, draftSlug);
        if (blockReason) {
            setSaveState("validation_blocked");
            setSaveMessage(blockReason);
            if (showToast) toast.error(blockReason);
            return null;
        }

        const isCreate = activeMode === "create" && !activeFormId;
        const targetUrl = isCreate ? "/api/forms" : `/api/forms/${activeFormId}`;

        if (!isCreate && !activeFormId) {
            return null;
        }

        setSaveState("syncing");
        setSaveMessage("正在同步服务器");
        try {
            const res = await fetch(targetUrl, {
                method: isCreate ? "POST" : "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(normalizedPayload),
            });
            const data = await res.json();
            if (!res.ok) {
                setSaveState("error");
                setSaveMessage(data.error || "同步失败");
                if (showToast) toast.error(data.error || "保存失败");
                return null;
            }

            const nextId = data.form.id as string;
            const savedSlug = typeof data.form.slug === "string" ? data.form.slug : normalizedPayload.slug;
            const syncedPayload = {
                ...normalizedPayload,
                slug: savedSlug,
            };
            const syncedSnapshot = getPayloadSnapshot(syncedPayload);
            const syncedAt = Date.now();
            setLastSyncedAt(syncedAt);
            setSaveState("synced");
            setSaveMessage("已同步服务器");
            lastSyncedSnapshotRef.current = syncedSnapshot;
            if (!currentPayload.slug && savedSlug) {
                skipNextDraftWriteRef.current = true;
                setSlugState(savedSlug);
                slugManuallyEditedRef.current = false;
                generatedDraftSlugRef.current = savedSlug;
            }
            writeLocalDraft(getDraftKey(nextId), {
                payload: syncedPayload,
                updatedAt: syncedAt,
                syncedAt,
                formId: nextId,
            });

            if (isCreate) {
                removeLocalDraft(getDraftKey(null));
                setActiveMode("edit");
                setActiveFormId(nextId);
                replaceEditorUrl(nextId);
            }

            if (showToast) {
                toast.success(isCreate ? "表单草稿已创建" : "表单草稿已保存");
            }
            return nextId;
        } catch {
            setSaveState("error");
            setSaveMessage("同步失败，请稍后重试");
            if (showToast) toast.error("保存失败");
            return null;
        }
    }, [activeFormId, activeMode]);

    useEffect(() => {
        if (!hydratedRef.current || loading || pendingLocalDraft) return;

        if (skipNextDraftWriteRef.current) {
            skipNextDraftWriteRef.current = false;
            return;
        }

        const normalizedPayload = normalizePayload(payload);
        const snapshot = getPayloadSnapshot(normalizedPayload);
        const updatedAt = Date.now();
        const isSyncedSnapshot = lastSyncedSnapshotRef.current === snapshot;
        writeLocalDraft(storageKey, {
            payload: normalizedPayload,
            updatedAt,
            syncedAt: isSyncedSnapshot ? (lastSyncedAt ?? updatedAt) : lastSyncedAt,
            formId: activeFormId,
        });
        if (!isSyncedSnapshot) {
            setSaveState("local_saved");
            setSaveMessage("已保存到本地");
        }

        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }
        if (!isSyncedSnapshot) {
            autoSaveTimerRef.current = setTimeout(() => {
                void persistToServer(false);
            }, 1200);
        }

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [
        activeFormId,
        lastSyncedAt,
        loading,
        payload,
        pendingLocalDraft,
        persistToServer,
        storageKey,
    ]);

    const searchUsers = useCallback(async (query: string) => {
        if (!query.trim()) {
            setMemberSearchResults([]);
            return;
        }
        setMemberSearching(true);
        try {
            const res = await fetch(`/api/users?search=${encodeURIComponent(query)}&limit=10`);
            const data = await res.json();
            if (res.ok) {
                setMemberSearchResults(data.users || []);
            }
        } catch {
            setMemberSearchResults([]);
        } finally {
            setMemberSearching(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => searchUsers(memberSearchQuery), 250);
        return () => clearTimeout(timer);
    }, [memberSearchQuery, searchUsers]);

    const setTitle = useCallback((value: string) => {
        setTitleState(value);
        if (!slugManuallyEditedRef.current) {
            setSlugState(formatSlug(value));
        }
    }, []);

    const setSlug = useCallback((value: string) => {
        slugManuallyEditedRef.current = true;
        setSlugState(formatSlug(value));
    }, []);

    const updateField = useCallback((index: number, updates: Partial<FormField>) => {
        setFields((prev) => prev.map((field, fieldIndex) => {
            if (fieldIndex !== index) return field;
            const nextType = updates.type ?? field.type;
            const nextField = { ...field, ...updates };
            if (updates.type && updates.type !== field.type) {
                nextField.options = fieldHasOptions(nextType)
                    ? getDefaultOptionsForFieldType(nextType)
                    : [];
                nextField.defaultValue = getDefaultValueForFieldType(nextType);
            }
            if (updates.key !== undefined) {
                nextField.key = sanitizeKey(updates.key);
            }
            return nextField;
        }));
    }, []);

    const addField = useCallback((type: FormFieldType = "text") => {
        setFields((prev) => {
            const next = [...prev, makeField(prev.length, type)];
            setSelectedIndex(next.length - 1);
            setPanel("field");
            return next;
        });
    }, []);

    const duplicateField = useCallback((index: number) => {
        setFields((prev) => {
            const source = prev[index];
            if (!source) return prev;
            const copy = {
                ...cloneFormField(source),
                key: `${source.key || "field"}_copy_${Date.now().toString(36)}`,
                label: `${source.label || "未命名字段"} 副本`,
            };
            const next = [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
            setSelectedIndex(index + 1);
            setPanel("field");
            return next;
        });
    }, []);

    const removeField = useCallback((index: number) => {
        setFields((prev) => {
            if (prev.length === 1) {
                toast.error("至少保留一个字段");
                return prev;
            }
            const next = prev.filter((_, fieldIndex) => fieldIndex !== index);
            setSelectedIndex(Math.max(0, Math.min(index, next.length - 1)));
            return next;
        });
    }, []);

    const moveField = useCallback((index: number, direction: -1 | 1) => {
        setFields((prev) => {
            const target = index + direction;
            if (target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];
            setSelectedIndex(target);
            return next;
        });
    }, []);

    const updateOption = useCallback((fieldIndex: number, optionIndex: number, label: string) => {
        setFields((prev) => prev.map((field, index) => {
            if (index !== fieldIndex) return field;
            const options = [...(field.options ?? [])];
            options[optionIndex] = { label, value: label };
            return { ...field, options };
        }));
    }, []);

    const addOption = useCallback((fieldIndex: number) => {
        setFields((prev) => prev.map((field, index) => {
            if (index !== fieldIndex) return field;
            const options = [...(field.options ?? [])];
            const label = `选项 ${options.length + 1}`;
            options.push({ label, value: label });
            return { ...field, options };
        }));
    }, []);

    const removeOption = useCallback((fieldIndex: number, optionIndex: number) => {
        setFields((prev) => prev.map((field, index) => {
            if (index !== fieldIndex) return field;
            return {
                ...field,
                options: (field.options ?? []).filter((_, currentIndex) => currentIndex !== optionIndex),
            };
        }));
    }, []);

    const addMember = useCallback((user: AllowedUser) => {
        if (!allowedUserIds.includes(user.id)) {
            setAllowedUserIds((prev) => [...prev, user.id]);
            setAllowedUsers((prev) => [...prev, user]);
        }
    }, [allowedUserIds]);

    const removeMember = useCallback((userId: string) => {
        setAllowedUserIds((prev) => prev.filter((id) => id !== userId));
        setAllowedUsers((prev) => prev.filter((user) => user.id !== userId));
    }, []);

    const updateResultConfig = useCallback((updater: (prev: FormResultConfig) => FormResultConfig) => {
        setResultConfig((prev) => normalizeResultConfig(updater(prev), fields));
    }, [fields]);

    const applyJoinApplicationPreset = useCallback(() => {
        setResultConfig(createJoinApplicationResultPreset(fields));
        setPanel("result");
        toast.success("已应用入服申请结果预设");
    }, [fields]);

    const restoreLocalDraft = useCallback(() => {
        if (!pendingLocalDraft) return;
        skipNextDraftWriteRef.current = true;
        applyPayload(pendingLocalDraft.payload);
        setPendingLocalDraft(null);
        setSaveState("local_saved");
        setSaveMessage("已恢复本地草稿");
        toast.success("已恢复本地草稿");
    }, [applyPayload, pendingLocalDraft]);

    const discardLocalDraft = useCallback(() => {
        removeLocalDraft(storageKey);
        setPendingLocalDraft(null);
        toast.success("已放弃本地草稿");
    }, [storageKey]);

    const saveForm = useCallback(async () => {
        setManualSaving(true);
        try {
            return await persistToServer(true);
        } finally {
            setManualSaving(false);
        }
    }, [persistToServer]);

    const publishForm = useCallback(async () => {
        const issues = getPublishIssues(payload);
        const firstError = issues.find((issue) => issue.severity === "error");
        if (firstError) {
            setPanel("publish");
            if (firstError.fieldIndex !== undefined) {
                setSelectedIndex(firstError.fieldIndex);
            }
            toast.error(firstError.detail);
            return;
        }

        setPublishing(true);
        try {
            const targetId = await persistToServer(false);
            const id = targetId ?? activeFormId;
            if (!id) {
                toast.error("请先保存表单草稿");
                return;
            }
            const res = await fetch(`/api/forms/${id}/publish`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "发布失败");
                return;
            }
            toast.success(`已发布版本 v${data.version.version}`);
            setStatus("published");
            setCurrentVersion(data.version.version);
            setPublishedAt(data.version.published_at);
            setVersions((prev) => [
                {
                    id: data.version.id,
                    version: data.version.version,
                    published_at: data.version.published_at,
                },
                ...prev.filter((version) => version.id !== data.version.id),
            ]);
            setSaveState("synced");
            setSaveMessage("已发布并同步");
            if (activeMode === "create") {
                setActiveMode("edit");
                setActiveFormId(id);
                replaceEditorUrl(id);
            }
        } catch {
            toast.error("发布失败");
        } finally {
            setPublishing(false);
        }
    }, [activeFormId, activeMode, payload, persistToServer]);

    const publishIssues = useMemo(() => getPublishIssues(payload), [payload]);

    return {
        state: {
            activeMode,
            activeFormId,
            loading,
            manualSaving,
            publishing,
            saveState,
            saveMessage,
            lastSyncedAt,
            pendingLocalDraft,
            title,
            description,
            slug,
            visibility,
            status,
            fields,
            settings,
            resultConfig,
            allowedUserIds,
            allowedUsers,
            memberSearchQuery,
            memberSearchResults,
            memberSearching,
            selectedIndex,
            selectedField,
            versions,
            currentVersion,
            publishedAt,
            panel,
            publishIssues,
            payload,
        },
        actions: {
            setTitle,
            setDescription,
            setSlug,
            setVisibility,
            setStatus,
            setSettings,
            setResultConfig: updateResultConfig,
            setMemberSearchQuery,
            setSelectedIndex,
            setPanel,
            updateField,
            addField,
            duplicateField,
            removeField,
            moveField,
            updateOption,
            addOption,
            removeOption,
            addMember,
            removeMember,
            applyJoinApplicationPreset,
            restoreLocalDraft,
            discardLocalDraft,
            saveForm,
            publishForm,
        },
    };
}
