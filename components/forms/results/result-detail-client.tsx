"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
    ArrowLeft,
    Ban,
    Bell,
    CheckCircle2,
    Clock3,
    GitCompareArrows,
    Loader2,
    MessageSquare,
    RefreshCw,
    Send,
    XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
    normalizeFormFields,
    normalizeResultConfig,
    type FormField,
    type FormResultConfig,
} from "@/lib/forms";

type Submission = {
    id: string;
    form_id: string;
    form_title: string;
    form_slug: string;
    version: number;
    version_title: string;
    fields: unknown;
    result_config: unknown;
    field_snapshot?: unknown;
    data: Record<string, unknown>;
    user_name: string | null;
    user_email: string | null;
    account_email: string | null;
    created_at: string;
    duration: number | null;
    ip_address: string | null;
    user_agent: string | null;
    fingerprint: string | null;
    grading_status: string;
    processing_status: string;
    processing_note: string | null;
    processed_at: string | null;
    processed_by_name: string | null;
    total_score: string | number | null;
    max_score: string | number | null;
    current_revision_id: string | null;
    active_revision_request_id: string | null;
    revision_count: number;
    revision_status: string;
    last_resubmitted_at: string | null;
};

type GradeRow = {
    id: string;
    field_key: string;
    field_label: string;
    field_type: string;
    answer: unknown;
    expected_answer: unknown;
    score: string | number | null;
    max_score: string | number;
    grading_type: "auto" | "manual";
    matched: boolean | null;
    comment: string | null;
    graded_at: string | null;
    graded_by_name: string | null;
};

type EventRow = {
    id: string;
    event_type: string;
    action: string;
    from_status: string | null;
    to_status: string | null;
    note: string | null;
    score: string | number | null;
    max_score: string | number | null;
    actor_name: string | null;
    created_at: string;
};

type ResultDetailPayload = {
    submission: Submission;
    grades: GradeRow[];
    events: EventRow[];
    revisions: RevisionRow[];
    activeRequest: ActiveRevisionRequest | null;
    notifications: NotificationRow[];
};

type RevisionRow = {
    id: string;
    revision_number: number;
    data: Record<string, unknown>;
    field_snapshot: unknown;
    grades: GradeRow[];
    total_score: string | number | null;
    max_score: string | number | null;
    grading_status: string;
    submitted_via: string;
    submitted_by_name: string | null;
    created_at: string;
    request_reason: string | null;
    request_status: string | null;
};

type ActiveRevisionRequest = {
    id: string;
    edit_scope: "all" | "selected";
    editable_field_keys: string[];
    reason: string;
    status: string;
    expires_at: string | null;
    requested_by_name: string | null;
    created_at: string;
};

type NotificationRow = {
    id: string;
    event_type: string;
    status: string;
    attempts: number;
    recipient: string;
    last_error: string | null;
    created_at: string;
    sent_at: string | null;
};

type ManualGradeDraft = {
    fieldKey: string;
    score: string;
    comment: string;
};

type ProcessAction = "approve" | "reject" | "comment";
type RevisionEditScope = "all" | "selected";

type ResultDetailClientProps = {
    initialDetail: ResultDetailPayload;
};

const gradingStatusLabels: Record<string, string> = {
    not_required: "无需批改",
    auto_graded: "自动批改",
    manual_required: "待人工批改",
    graded: "已批改",
};

const processingStatusLabels: Record<string, string> = {
    not_required: "无需处理",
    pending: "待处理",
    approved: "已通过",
    rejected: "已拒绝",
    needs_changes: "需补充",
};

const eventTypeLabels: Record<string, string> = {
    submission: "提交",
    grading: "批改",
    processing: "处理",
    notification: "通知",
    revision: "修订",
};

const revisionStatusLabels: Record<string, string> = {
    none: "首次提交",
    requested: "待补充",
    resubmitted: "已补交",
    open: "开放中",
    fulfilled: "已完成",
    cancelled: "已取消",
    expired: "已过期",
};

const revisionSourceLabels: Record<string, string> = {
    initial: "首次提交",
    account: "账户补交",
    token: "链接补交",
};

const notificationEventLabels: Record<string, string> = {
    revision_requested: "补交通知",
    grading_completed: "批改通知",
    processing_changed: "处理通知",
};

const notificationStatusLabels: Record<string, string> = {
    pending: "待发送",
    sending: "发送中",
    sent: "已发送",
    failed: "发送失败",
};

function toNumber(value: string | number | null | undefined) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatScore(score: string | number | null, maxScore: string | number | null) {
    const current = toNumber(score);
    const max = toNumber(maxScore);
    if (current === null || max === null) return "—";
    return `${current}/${max}`;
}

function formatDate(value: string | null) {
    if (!value) return "暂无";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "暂无" : date.toLocaleString("zh-CN");
}

function formatDuration(seconds: number | null) {
    if (seconds === null || seconds === undefined) return "—";
    if (seconds < 60) return `${seconds} 秒`;
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest > 0 ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`;
}

function formatValue(value: unknown): string {
    if (Array.isArray(value)) return value.length > 0 ? value.map((item) => formatValue(item)).join("、") : "—";
    if (typeof value === "boolean") return value ? "是" : "否";
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) && Array.isArray(right)) {
        const leftValues = [...left].sort((a, b) => formatValue(a).localeCompare(formatValue(b)));
        const rightValues = [...right].sort((a, b) => formatValue(a).localeCompare(formatValue(b)));
        return leftValues.length === rightValues.length &&
            leftValues.every((value, index) => valuesEqual(value, rightValues[index]));
    }
    if (left && right && typeof left === "object" && typeof right === "object") {
        const leftRecord = left as Record<string, unknown>;
        const rightRecord = right as Record<string, unknown>;
        const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
        return [...keys].every((key) => valuesEqual(leftRecord[key], rightRecord[key]));
    }
    return false;
}

function getBadgeVariant(value: string) {
    if (value === "rejected" || value === "failed") return "destructive" as const;
    if (value === "manual_required" || value === "pending" || value === "sending" || value === "needs_changes") return "secondary" as const;
    if (value === "approved" || value === "graded" || value === "auto_graded" || value === "sent") return "default" as const;
    return "outline" as const;
}

function readMappedValue(data: Record<string, unknown>, key: string | null | undefined) {
    if (!key) return null;
    const value = data[key];
    const formatted = formatValue(value);
    return formatted === "—" ? null : formatted;
}

function createManualDrafts(grades: GradeRow[]) {
    return grades
        .filter((grade) => grade.grading_type === "manual")
        .map((grade) => ({
            fieldKey: grade.field_key,
            score: grade.score === null || grade.score === undefined ? "" : String(grade.score),
            comment: grade.comment ?? "",
        }));
}

function normalizeDetail(payload: ResultDetailPayload): ResultDetailPayload {
    const normalized = JSON.parse(JSON.stringify(payload)) as ResultDetailPayload;
    return {
        ...normalized,
        grades: normalized.grades ?? [],
        events: normalized.events ?? [],
        revisions: normalized.revisions ?? [],
        activeRequest: normalized.activeRequest ?? null,
        notifications: normalized.notifications ?? [],
    };
}

export function ResultDetailClient({ initialDetail }: ResultDetailClientProps) {
    const [detail, setDetail] = useState<ResultDetailPayload>(() => normalizeDetail(initialDetail));
    const [manualDrafts, setManualDrafts] = useState<ManualGradeDraft[]>(() => createManualDrafts(initialDetail.grades));
    const [savingGrades, setSavingGrades] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [notifying, setNotifying] = useState(false);
    const [processDialog, setProcessDialog] = useState<ProcessAction | null>(null);
    const [processNote, setProcessNote] = useState("");
    const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
    const [notifyNote, setNotifyNote] = useState("");
    const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
    const [revisionReason, setRevisionReason] = useState("");
    const [revisionExpiresAt, setRevisionExpiresAt] = useState("");
    const [revisionEditScope, setRevisionEditScope] = useState<RevisionEditScope>("all");
    const [editableFieldKeys, setEditableFieldKeys] = useState<string[]>([]);
    const [creatingRevisionRequest, setCreatingRevisionRequest] = useState(false);
    const [requestAction, setRequestAction] = useState<"cancel" | "resend" | null>(null);
    const [selectedRevisionIds, setSelectedRevisionIds] = useState<string[]>([]);

    const submission = detail.submission;
    const fields = useMemo<FormField[]>(() => {
        const snapshotFields = normalizeFormFields(submission.field_snapshot);
        return snapshotFields.length > 0 ? snapshotFields : normalizeFormFields(submission.fields);
    }, [submission.field_snapshot, submission.fields]);
    const resultConfig = useMemo<FormResultConfig>(() => normalizeResultConfig(submission.result_config, fields), [fields, submission.result_config]);
    const editableFields = useMemo(() => fields.filter((field) => field.enabled), [fields]);
    const selectedRevisions = useMemo(() => detail.revisions
        .filter((revision) => selectedRevisionIds.includes(revision.id))
        .sort((left, right) => left.revision_number - right.revision_number), [detail.revisions, selectedRevisionIds]);
    const revisionDiff = useMemo(() => {
        if (selectedRevisions.length !== 2) return [];
        const [fromRevision, toRevision] = selectedRevisions;
        const fieldMap = new Map<string, FormField>();
        for (const field of [
            ...normalizeFormFields(fromRevision.field_snapshot),
            ...normalizeFormFields(toRevision.field_snapshot),
            ...fields,
        ]) {
            fieldMap.set(field.key, field);
        }
        const keys = new Set([
            ...fieldMap.keys(),
            ...Object.keys(fromRevision.data ?? {}),
            ...Object.keys(toRevision.data ?? {}),
        ]);
        return [...keys]
            .filter((key) => !valuesEqual(fromRevision.data?.[key], toRevision.data?.[key]))
            .map((key) => ({
                key,
                label: fieldMap.get(key)?.label || key,
                from: fromRevision.data?.[key],
                to: toRevision.data?.[key],
            }));
    }, [fields, selectedRevisions]);
    const manualGrades = detail.grades.filter((grade) => grade.grading_type === "manual");
    const autoGrades = detail.grades.filter((grade) => grade.grading_type === "auto");
    const mappedValues = {
        email: readMappedValue(submission.data, resultConfig.fieldMappings.email) || submission.account_email || submission.user_email,
        playerName: readMappedValue(submission.data, resultConfig.fieldMappings.playerName),
        qq: readMappedValue(submission.data, resultConfig.fieldMappings.qq),
        mcid: readMappedValue(submission.data, resultConfig.fieldMappings.mcid),
    };

    const refreshDetail = async () => {
        const res = await fetch(`/api/forms/${submission.form_id}/results/${submission.id}`);
        const nextDetail = await res.json();
        if (!res.ok) {
            toast.error(nextDetail.error || "刷新结果失败");
            return;
        }
        setDetail(normalizeDetail(nextDetail));
        setManualDrafts(createManualDrafts(nextDetail.grades || []));
    };

    const updateManualDraft = (fieldKey: string, updates: Partial<ManualGradeDraft>) => {
        setManualDrafts((prev) => prev.map((draft) => (
            draft.fieldKey === fieldKey ? { ...draft, ...updates } : draft
        )));
    };

    const saveGrades = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!submission.current_revision_id) {
            toast.error("当前结果缺少修订信息，请刷新后重试");
            await refreshDetail();
            return;
        }
        setSavingGrades(true);
        try {
            const res = await fetch(`/api/forms/${submission.form_id}/results/${submission.id}/grades`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    revisionId: submission.current_revision_id,
                    grades: manualDrafts,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 409) {
                    toast.error(data.error || "结果已更新，请刷新后重新批改");
                    await refreshDetail();
                    return;
                }
                toast.error(data.error || "保存批改失败");
                return;
            }
            toast.success("批改已保存");
            await refreshDetail();
        } catch {
            toast.error("保存批改失败");
        } finally {
            setSavingGrades(false);
        }
    };

    const submitProcessAction = async () => {
        if (!processDialog) return;
        setProcessing(true);
        try {
            const res = await fetch(`/api/forms/${submission.form_id}/results/${submission.id}/process`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: processDialog, note: processNote }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "处理结果失败");
                return;
            }
            toast.success("处理状态已更新");
            setProcessDialog(null);
            setProcessNote("");
            await refreshDetail();
        } catch {
            toast.error("处理结果失败");
        } finally {
            setProcessing(false);
        }
    };

    const createRevisionRequest = async () => {
        const reason = revisionReason.trim();
        if (!reason) {
            toast.error("请填写需补充原因");
            return;
        }
        if (revisionEditScope === "selected" && editableFieldKeys.length === 0) {
            toast.error("请至少选择一个可修改字段");
            return;
        }

        setCreatingRevisionRequest(true);
        try {
            const expiresAt = revisionExpiresAt ? new Date(revisionExpiresAt).toISOString() : null;
            const res = await fetch(`/api/forms/${submission.form_id}/results/${submission.id}/revision-requests`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reason,
                    editScope: revisionEditScope,
                    editableFieldKeys: revisionEditScope === "selected" ? editableFieldKeys : [],
                    expiresAt,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "发起补充请求失败");
                return;
            }
            toast.success("补充请求已发起");
            setRevisionDialogOpen(false);
            setRevisionReason("");
            setRevisionExpiresAt("");
            setRevisionEditScope("all");
            setEditableFieldKeys([]);
            await refreshDetail();
        } catch {
            toast.error("发起补充请求失败");
        } finally {
            setCreatingRevisionRequest(false);
        }
    };

    const submitRequestAction = async (action: "cancel" | "resend") => {
        const activeRequest = detail.activeRequest;
        if (!activeRequest) return;

        setRequestAction(action);
        try {
            const res = await fetch(
                `/api/forms/${submission.form_id}/results/${submission.id}/revision-requests/${activeRequest.id}/${action}`,
                {
                    method: "POST",
                    headers: action === "resend" ? { "Content-Type": "application/json" } : undefined,
                    body: action === "resend"
                        ? JSON.stringify({ clientRequestId: crypto.randomUUID() })
                        : undefined,
                },
            );
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || (action === "cancel" ? "取消补充请求失败" : "重发通知失败"));
                return;
            }
            toast.success(action === "cancel" ? "补充请求已取消" : "补交通知已重发");
            await refreshDetail();
        } catch {
            toast.error(action === "cancel" ? "取消补充请求失败" : "重发通知失败");
        } finally {
            setRequestAction(null);
        }
    };

    const toggleRevisionSelection = (revisionId: string, checked: boolean) => {
        setSelectedRevisionIds((current) => {
            if (!checked) return current.filter((id) => id !== revisionId);
            if (current.includes(revisionId)) return current;
            if (current.length >= 2) {
                toast.error("最多选择两个修订版本进行比较");
                return current;
            }
            return [...current, revisionId];
        });
    };

    const sendNotification = async () => {
        setNotifying(true);
        try {
            const res = await fetch(`/api/forms/${submission.form_id}/results/${submission.id}/notify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ note: notifyNote }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "发送通知失败");
                return;
            }
            toast.success("结果通知已发送");
            setNotifyDialogOpen(false);
            setNotifyNote("");
            await refreshDetail();
        } catch {
            toast.error("发送通知失败");
        } finally {
            setNotifying(false);
        }
    };

    const actionLabel = processDialog === "approve"
        ? "通过"
        : processDialog === "reject"
            ? "拒绝"
            : "记录备注";

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="size-8" asChild>
                            <Link href={`/dashboard/forms/${submission.form_id}/results`} aria-label="返回结果列表">
                                <ArrowLeft className="size-4" />
                            </Link>
                        </Button>
                        <h1 className="text-3xl font-bold tracking-tight">结果详情</h1>
                    </div>
                    <p className="ml-10 mt-1 text-muted-foreground">
                        {submission.form_title || "未命名表单"} · v{submission.version} · {formatDate(submission.created_at)}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {resultConfig.processing.enabled && (
                        <>
                            <Button variant="outline" onClick={() => setProcessDialog("approve")}>
                                <CheckCircle2 className="size-4" />
                                通过
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setRevisionDialogOpen(true)}
                                disabled={Boolean(detail.activeRequest)}
                            >
                                <RefreshCw className="size-4" />
                                需补充
                            </Button>
                            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setProcessDialog("reject")}>
                                <XCircle className="size-4" />
                                拒绝
                            </Button>
                            <Button variant="outline" onClick={() => setProcessDialog("comment")}>
                                <MessageSquare className="size-4" />
                                备注
                            </Button>
                        </>
                    )}
                    {resultConfig.notifications.enabled && (
                        <Button onClick={() => setNotifyDialogOpen(true)}>
                            <Bell className="size-4" />
                            发送通知
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border bg-background p-4">
                    <p className="text-sm text-muted-foreground">提交者</p>
                    <p className="mt-2 font-medium">{submission.user_name || "匿名用户"}</p>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{submission.user_email || submission.account_email || "—"}</p>
                </div>
                <div className="rounded-md border bg-background p-4">
                    <p className="text-sm text-muted-foreground">批改状态</p>
                    <div className="mt-2">
                        <Badge variant={getBadgeVariant(submission.grading_status)}>
                            {gradingStatusLabels[submission.grading_status] || submission.grading_status}
                        </Badge>
                    </div>
                    <p className="mt-2 font-mono text-sm">{formatScore(submission.total_score, submission.max_score)}</p>
                </div>
                <div className="rounded-md border bg-background p-4">
                    <p className="text-sm text-muted-foreground">处理状态</p>
                    <div className="mt-2">
                        <Badge variant={getBadgeVariant(submission.processing_status)}>
                            {processingStatusLabels[submission.processing_status] || submission.processing_status}
                        </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{submission.processed_by_name || "未处理"} · {formatDate(submission.processed_at)}</p>
                </div>
                <div className="rounded-md border bg-background p-4">
                    <p className="text-sm text-muted-foreground">填写元数据</p>
                    <p className="mt-2 text-sm">用时 {formatDuration(submission.duration)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        共 {submission.revision_count || detail.revisions.length} 个版本 · {revisionStatusLabels[submission.revision_status] || submission.revision_status || "首次提交"}
                    </p>
                </div>
            </div>

            {detail.activeRequest && (
                <section className="rounded-md border border-primary/30 bg-background">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="font-semibold">开放的补充请求</h2>
                                <Badge variant="secondary">
                                    {revisionStatusLabels[detail.activeRequest.status] || detail.activeRequest.status}
                                </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {detail.activeRequest.requested_by_name || "管理员"} · {formatDate(detail.activeRequest.created_at)}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => submitRequestAction("resend")}
                                disabled={requestAction !== null}
                            >
                                {requestAction === "resend" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                                重发通知
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => submitRequestAction("cancel")}
                                disabled={requestAction !== null}
                            >
                                {requestAction === "cancel" ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
                                取消请求
                            </Button>
                        </div>
                    </div>
                    <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.7fr)]">
                        <div>
                            <p className="text-sm text-muted-foreground">补充原因</p>
                            <p className="mt-1 break-words whitespace-pre-wrap text-sm">{detail.activeRequest.reason}</p>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-muted-foreground">可修改范围</p>
                                <p className="mt-1">
                                    {detail.activeRequest.edit_scope === "all"
                                        ? "全部字段"
                                        : detail.activeRequest.editable_field_keys
                                            .map((key) => fields.find((field) => field.key === key)?.label || key)
                                            .join("、") || "未指定字段"}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">截止时间</p>
                                <p className="mt-1 flex items-center gap-1.5">
                                    <Clock3 className="size-4" />
                                    {detail.activeRequest.expires_at ? formatDate(detail.activeRequest.expires_at) : "不设截止时间"}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
                <div className="space-y-6">
                    <section className="rounded-md border bg-background">
                        <div className="border-b px-4 py-3">
                            <h2 className="font-semibold">提交内容</h2>
                        </div>
                        <div className="divide-y">
                            {fields.map((field) => (
                                <div key={field.key} className="grid gap-1 px-4 py-3 md:grid-cols-[180px_minmax(0,1fr)]">
                                    <div>
                                        <p className="text-sm font-medium">{field.label}</p>
                                        <p className="font-mono text-xs text-muted-foreground">{field.key}</p>
                                    </div>
                                    <p className="break-words whitespace-pre-wrap text-sm">{formatValue(submission.data?.[field.key])}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-md border bg-background">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                            <div>
                                <h2 className="font-semibold">修订时间线</h2>
                                <p className="mt-1 text-xs text-muted-foreground">选择两个版本可比较字段变化</p>
                            </div>
                            <Badge variant="outline">已选 {selectedRevisionIds.length}/2</Badge>
                        </div>
                        {detail.revisions.length === 0 ? (
                            <p className="p-4 text-sm text-muted-foreground">暂无修订记录</p>
                        ) : (
                            <div className="divide-y">
                                {detail.revisions.map((revision) => {
                                    const selected = selectedRevisionIds.includes(revision.id);
                                    return (
                                        <div key={revision.id} className="flex gap-3 px-4 py-3">
                                            <Checkbox
                                                id={`revision-${revision.id}`}
                                                checked={selected}
                                                onCheckedChange={(checked) => toggleRevisionSelection(revision.id, checked === true)}
                                                aria-label={`选择第 ${revision.revision_number} 版`}
                                            />
                                            <label htmlFor={`revision-${revision.id}`} className="min-w-0 flex-1 cursor-pointer">
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <span className="font-medium">第 {revision.revision_number} 版</span>
                                                    <Badge variant="outline">
                                                        {revisionSourceLabels[revision.submitted_via] || revision.submitted_via}
                                                    </Badge>
                                                    <Badge variant={getBadgeVariant(revision.grading_status)}>
                                                        {gradingStatusLabels[revision.grading_status] || revision.grading_status} · {formatScore(revision.total_score, revision.max_score)}
                                                    </Badge>
                                                    {submission.current_revision_id === revision.id && <Badge>当前版本</Badge>}
                                                </span>
                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                    {revision.submitted_by_name || "匿名填写者"} · {formatDate(revision.created_at)}
                                                </span>
                                                {revision.request_reason && (
                                                    <span className="mt-2 block break-words whitespace-pre-wrap text-sm text-muted-foreground">
                                                        补充原因：{revision.request_reason}
                                                    </span>
                                                )}
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {selectedRevisions.length === 2 && (
                            <div className="border-t">
                                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                                    <h3 className="flex items-center gap-2 font-medium">
                                        <GitCompareArrows className="size-4" />
                                        第 {selectedRevisions[0].revision_number} 版 → 第 {selectedRevisions[1].revision_number} 版
                                    </h3>
                                    <Badge variant={revisionDiff.length > 0 ? "secondary" : "outline"}>
                                        {revisionDiff.length} 个字段变化
                                    </Badge>
                                </div>
                                <div className="grid gap-3 border-t px-4 py-3 text-sm md:grid-cols-2">
                                    {selectedRevisions.map((revision) => (
                                        <div key={revision.id} className="min-w-0 space-y-2">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="text-muted-foreground">第 {revision.revision_number} 版评分</span>
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <Badge variant={getBadgeVariant(revision.grading_status)}>
                                                        {gradingStatusLabels[revision.grading_status] || revision.grading_status}
                                                    </Badge>
                                                    <span className="font-mono">{formatScore(revision.total_score, revision.max_score)}</span>
                                                </span>
                                            </div>
                                            {revision.grades.length > 0 && (
                                                <details className="border-t pt-2">
                                                    <summary className="cursor-pointer text-xs text-muted-foreground">查看逐题评分</summary>
                                                    <div className="mt-2 divide-y text-xs">
                                                        {revision.grades.map((grade) => (
                                                            <div key={grade.id} className="flex flex-wrap justify-between gap-2 py-2">
                                                                <span className="min-w-0 break-words">
                                                                    {grade.field_label}
                                                                    {grade.comment && (
                                                                        <span className="mt-0.5 block text-muted-foreground">{grade.comment}</span>
                                                                    )}
                                                                </span>
                                                                <span className="shrink-0 font-mono">{formatScore(grade.score, grade.max_score)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {revisionDiff.length === 0 ? (
                                    <p className="border-t px-4 py-3 text-sm text-muted-foreground">两个版本的字段内容一致</p>
                                ) : (
                                    <div className="divide-y border-t">
                                        {revisionDiff.map((change) => (
                                            <div key={change.key} className="px-4 py-3">
                                                <div className="mb-2">
                                                    <p className="text-sm font-medium">{change.label}</p>
                                                    <p className="font-mono text-xs text-muted-foreground">{change.key}</p>
                                                </div>
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div className="min-w-0 border-l-2 border-destructive/50 pl-3">
                                                        <p className="text-xs text-muted-foreground">第 {selectedRevisions[0].revision_number} 版</p>
                                                        <p className="mt-1 max-h-48 overflow-auto break-words whitespace-pre-wrap text-sm">
                                                            {formatValue(change.from)}
                                                        </p>
                                                    </div>
                                                    <div className="min-w-0 border-l-2 border-primary/50 pl-3">
                                                        <p className="text-xs text-muted-foreground">第 {selectedRevisions[1].revision_number} 版</p>
                                                        <p className="mt-1 max-h-48 overflow-auto break-words whitespace-pre-wrap text-sm">
                                                            {formatValue(change.to)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {detail.grades.length > 0 && (
                        <section className="rounded-md border bg-background">
                            <div className="border-b px-4 py-3">
                                <h2 className="font-semibold">批改明细</h2>
                            </div>
                            {autoGrades.length > 0 && (
                                <div className="space-y-3 p-4">
                                    <h3 className="text-sm font-medium text-muted-foreground">客观题自动批改</h3>
                                    {autoGrades.map((grade) => (
                                        <div key={grade.id} className="rounded-md border p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="font-medium">{grade.field_label}</p>
                                                <Badge variant={grade.matched ? "default" : "secondary"}>
                                                    {grade.matched ? "命中" : "未命中"} · {formatScore(grade.score, grade.max_score)}
                                                </Badge>
                                            </div>
                                            <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                                                <p><span className="text-muted-foreground">填写：</span>{formatValue(grade.answer)}</p>
                                                <p><span className="text-muted-foreground">答案：</span>{formatValue(grade.expected_answer)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {manualGrades.length > 0 && (
                                <form className="space-y-3 border-t p-4" onSubmit={saveGrades}>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h3 className="text-sm font-medium text-muted-foreground">主观题人工批改</h3>
                                        <Button type="submit" disabled={savingGrades}>
                                            {savingGrades && <Loader2 className="size-4 animate-spin" />}
                                            保存批改
                                        </Button>
                                    </div>
                                    {manualGrades.map((grade) => {
                                        const draft = manualDrafts.find((item) => item.fieldKey === grade.field_key);
                                        return (
                                            <div key={grade.id} className="rounded-md border p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="font-medium">{grade.field_label}</p>
                                                    <Badge variant="outline">满分 {grade.max_score}</Badge>
                                                </div>
                                                <p className="mt-2 break-words whitespace-pre-wrap rounded-md bg-muted/60 px-3 py-2 text-sm">
                                                    {formatValue(grade.answer)}
                                                </p>
                                                <div className="mt-3 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                                                    <div className="space-y-1.5">
                                                        <Label htmlFor={`score-${grade.field_key}`}>得分</Label>
                                                        <Input
                                                            id={`score-${grade.field_key}`}
                                                            type="number"
                                                            min={0}
                                                            max={Number(grade.max_score)}
                                                            step="0.5"
                                                            value={draft?.score ?? ""}
                                                            onChange={(event) => updateManualDraft(grade.field_key, { score: event.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label htmlFor={`comment-${grade.field_key}`}>评语</Label>
                                                        <Textarea
                                                            id={`comment-${grade.field_key}`}
                                                            value={draft?.comment ?? ""}
                                                            onChange={(event) => updateManualDraft(grade.field_key, { comment: event.target.value })}
                                                            placeholder="可选"
                                                            className="min-h-20"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </form>
                            )}
                        </section>
                    )}
                </div>

                <aside className="space-y-6">
                    <section className="rounded-md border bg-background">
                        <div className="border-b px-4 py-3">
                            <h2 className="font-semibold">字段映射</h2>
                        </div>
                        <div className="space-y-3 p-4 text-sm">
                            <div className="flex justify-between gap-3"><span className="text-muted-foreground">邮箱</span><span className="break-all text-right">{mappedValues.email || "—"}</span></div>
                            <div className="flex justify-between gap-3"><span className="text-muted-foreground">玩家名</span><span className="break-all text-right">{mappedValues.playerName || "—"}</span></div>
                            <div className="flex justify-between gap-3"><span className="text-muted-foreground">QQ</span><span className="break-all text-right">{mappedValues.qq || "—"}</span></div>
                            <div className="flex justify-between gap-3"><span className="text-muted-foreground">MCID</span><span className="break-all text-right">{mappedValues.mcid || "—"}</span></div>
                        </div>
                    </section>

                    <section className="rounded-md border bg-background">
                        <div className="border-b px-4 py-3">
                            <h2 className="font-semibold">处理备注</h2>
                        </div>
                        <p className="break-words whitespace-pre-wrap p-4 text-sm text-muted-foreground">
                            {submission.processing_note || "暂无备注"}
                        </p>
                    </section>

                    <section className="rounded-md border bg-background">
                        <div className="border-b px-4 py-3">
                            <h2 className="font-semibold">客户端信息</h2>
                        </div>
                        <div className="space-y-3 p-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">浏览器指纹</p>
                                <p className="break-all font-mono text-xs">{submission.fingerprint || "—"}</p>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-muted-foreground">User-Agent</p>
                                <p className="break-all font-mono text-xs">{submission.user_agent || "—"}</p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-md border bg-background">
                        <div className="border-b px-4 py-3">
                            <h2 className="font-semibold">通知记录</h2>
                        </div>
                        <div className="divide-y">
                            {detail.notifications.length === 0 ? (
                                <p className="p-4 text-sm text-muted-foreground">暂无通知记录</p>
                            ) : detail.notifications.map((notification) => (
                                <div key={notification.id} className="p-4 text-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline">
                                                {notificationEventLabels[notification.event_type] || notification.event_type}
                                            </Badge>
                                            <Badge variant={getBadgeVariant(notification.status)}>
                                                {notificationStatusLabels[notification.status] || notification.status}
                                            </Badge>
                                        </span>
                                        <span className="text-xs text-muted-foreground">尝试 {notification.attempts} 次</span>
                                    </div>
                                    <p className="mt-2 break-all">{notification.recipient}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        创建于 {formatDate(notification.created_at)}
                                        {notification.sent_at ? ` · 发送于 ${formatDate(notification.sent_at)}` : ""}
                                    </p>
                                    {notification.last_error && (
                                        <p className="mt-2 break-words whitespace-pre-wrap text-destructive">{notification.last_error}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-md border bg-background">
                        <div className="border-b px-4 py-3">
                            <h2 className="font-semibold">事件历史</h2>
                        </div>
                        <div className="divide-y">
                            {detail.events.length === 0 ? (
                                <p className="p-4 text-sm text-muted-foreground">暂无事件</p>
                            ) : detail.events.map((event) => (
                                <div key={event.id} className="p-4 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <Badge variant="outline">{eventTypeLabels[event.event_type] || event.event_type}</Badge>
                                        <span className="text-xs text-muted-foreground">{formatDate(event.created_at)}</span>
                                    </div>
                                    <p className="mt-2 font-medium">{event.action}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {event.actor_name || "系统"} · {event.from_status || "—"} → {event.to_status || "—"}
                                    </p>
                                    {event.note && <p className="mt-2 break-words whitespace-pre-wrap text-muted-foreground">{event.note}</p>}
                                </div>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>

            <Dialog open={revisionDialogOpen} onOpenChange={(open) => {
                if (!creatingRevisionRequest) setRevisionDialogOpen(open);
            }}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>发起补充请求</DialogTitle>
                        <DialogDescription>指定填写者需要补充的内容和可修改范围。</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="revision-reason">补充原因</Label>
                            <Textarea
                                id="revision-reason"
                                value={revisionReason}
                                onChange={(event) => setRevisionReason(event.target.value)}
                                placeholder="说明需要补充或修正的内容"
                                aria-required="true"
                                className="min-h-24"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="revision-expires-at">截止时间</Label>
                            <Input
                                id="revision-expires-at"
                                type="datetime-local"
                                value={revisionExpiresAt}
                                onChange={(event) => setRevisionExpiresAt(event.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">可选，留空表示不设截止时间。</p>
                        </div>
                        <div className="space-y-2">
                            <Label>可修改范围</Label>
                            <div className="inline-flex" role="group" aria-label="可修改范围">
                                <Button
                                    type="button"
                                    variant={revisionEditScope === "all" ? "default" : "outline"}
                                    className="rounded-r-none"
                                    aria-pressed={revisionEditScope === "all"}
                                    onClick={() => setRevisionEditScope("all")}
                                >
                                    全部字段
                                </Button>
                                <Button
                                    type="button"
                                    variant={revisionEditScope === "selected" ? "default" : "outline"}
                                    className="-ml-px rounded-l-none"
                                    aria-pressed={revisionEditScope === "selected"}
                                    onClick={() => setRevisionEditScope("selected")}
                                >
                                    指定字段
                                </Button>
                            </div>
                        </div>
                        {revisionEditScope === "selected" && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <Label>可修改字段</Label>
                                    <span className="text-xs text-muted-foreground">已选 {editableFieldKeys.length} 项</span>
                                </div>
                                <div className="max-h-56 divide-y overflow-y-auto rounded-md border">
                                    {editableFields.map((field) => {
                                        const checked = editableFieldKeys.includes(field.key);
                                        return (
                                            <label key={field.key} className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
                                                <Checkbox
                                                    checked={checked}
                                                    onCheckedChange={(nextChecked) => setEditableFieldKeys((current) => (
                                                        nextChecked === true
                                                            ? [...new Set([...current, field.key])]
                                                            : current.filter((key) => key !== field.key)
                                                    ))}
                                                    aria-label={`允许修改${field.label}`}
                                                />
                                                <span className="min-w-0">
                                                    <span className="block text-sm font-medium">{field.label}</span>
                                                    <span className="block break-all font-mono text-xs text-muted-foreground">{field.key}</span>
                                                </span>
                                            </label>
                                        );
                                    })}
                                    {editableFields.length === 0 && (
                                        <p className="px-3 py-4 text-sm text-muted-foreground">当前版本没有可修改字段</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRevisionDialogOpen(false)} disabled={creatingRevisionRequest}>取消</Button>
                        <Button onClick={createRevisionRequest} disabled={creatingRevisionRequest}>
                            {creatingRevisionRequest && <Loader2 className="size-4 animate-spin" />}
                            发起请求
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={processDialog !== null} onOpenChange={(open) => {
                if (!open && !processing) setProcessDialog(null);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{actionLabel}</DialogTitle>
                        <DialogDescription>记录处理状态和备注，结果会写入事件历史。</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="process-note">处理备注</Label>
                        <Textarea
                            id="process-note"
                            value={processNote}
                            onChange={(event) => setProcessNote(event.target.value)}
                            placeholder="可选"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setProcessDialog(null)} disabled={processing}>取消</Button>
                        <Button onClick={submitProcessAction} disabled={processing}>
                            {processing && <Loader2 className="size-4 animate-spin" />}
                            确认
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={notifyDialogOpen} onOpenChange={(open) => {
                if (!open && !notifying) setNotifyDialogOpen(false);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>发送结果通知</DialogTitle>
                        <DialogDescription>通知将按发布版本中的通知模板和收件人规则发送。</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="notify-note">附加备注</Label>
                        <Textarea
                            id="notify-note"
                            value={notifyNote}
                            onChange={(event) => setNotifyNote(event.target.value)}
                            placeholder="可选"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNotifyDialogOpen(false)} disabled={notifying}>取消</Button>
                        <Button onClick={sendNotification} disabled={notifying}>
                            {notifying ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                            发送
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export type { ResultDetailPayload };
