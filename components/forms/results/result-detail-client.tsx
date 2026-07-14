"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
    ArrowLeft,
    Bell,
    CheckCircle2,
    Loader2,
    MessageSquare,
    Send,
    XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
};

type ManualGradeDraft = {
    fieldKey: string;
    score: string;
    comment: string;
};

type ProcessAction = "approve" | "reject" | "request_changes" | "comment";

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
    return new Date(value).toLocaleString("zh-CN");
}

function formatDuration(seconds: number | null) {
    if (seconds === null || seconds === undefined) return "—";
    if (seconds < 60) return `${seconds} 秒`;
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest > 0 ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`;
}

function formatValue(value: unknown) {
    if (Array.isArray(value)) return value.length > 0 ? value.join("、") : "—";
    if (typeof value === "boolean") return value ? "是" : "否";
    if (value === null || value === undefined || value === "") return "—";
    return String(value);
}

function getBadgeVariant(value: string) {
    if (value === "rejected") return "destructive" as const;
    if (value === "manual_required" || value === "pending" || value === "needs_changes") return "secondary" as const;
    if (value === "approved" || value === "graded" || value === "auto_graded") return "default" as const;
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
    return JSON.parse(JSON.stringify(payload)) as ResultDetailPayload;
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

    const submission = detail.submission;
    const fields = useMemo<FormField[]>(() => {
        const snapshotFields = normalizeFormFields(submission.field_snapshot);
        return snapshotFields.length > 0 ? snapshotFields : normalizeFormFields(submission.fields);
    }, [submission.field_snapshot, submission.fields]);
    const resultConfig = useMemo<FormResultConfig>(() => normalizeResultConfig(submission.result_config, fields), [fields, submission.result_config]);
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
        setSavingGrades(true);
        try {
            const res = await fetch(`/api/forms/${submission.form_id}/results/${submission.id}/grades`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ grades: manualDrafts }),
            });
            const data = await res.json();
            if (!res.ok) {
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
            : processDialog === "request_changes"
                ? "标记需补充"
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
                            <Button variant="outline" onClick={() => setProcessDialog("request_changes")}>
                                <MessageSquare className="size-4" />
                                需补充
                            </Button>
                            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setProcessDialog("reject")}>
                                <XCircle className="size-4" />
                                拒绝
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
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">IP {submission.ip_address || "—"}</p>
                </div>
            </div>

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
