import {
    FormField,
    FormResultConfig,
    FormSettings,
    FormStatus,
    FormVisibility,
} from "@/lib/forms";

export type FormBuilderProps = {
    mode: "create" | "edit";
    formId?: string;
};

export type AllowedUser = {
    id: string;
    name: string;
    email: string;
    image: string | null;
};

export type FormVersionSummary = {
    id: string;
    version: number;
    published_at: string;
};

export type SaveState =
    | "idle"
    | "local_saved"
    | "syncing"
    | "synced"
    | "validation_blocked"
    | "error";

export type EditorPanel = "field" | "form" | "result" | "publish";

export type PublishIssue = {
    id: string;
    label: string;
    detail: string;
    severity: "error" | "warning";
    fieldIndex?: number;
};

export type FormEditorPayload = {
    title: string;
    description: string | null;
    slug: string;
    visibility: FormVisibility;
    status: FormStatus;
    allowedUserIds: string[];
    fields: FormField[];
    settings: FormSettings;
    resultConfig: FormResultConfig;
};

export type LocalDraft = {
    payload: FormEditorPayload;
    updatedAt: number;
    syncedAt: number | null;
    formId: string | null;
};
