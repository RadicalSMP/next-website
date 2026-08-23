"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Clock3,
    FilePenLine,
    FileText,
    History,
    Loader2,
    MessageSquareText,
    ShieldAlert,
} from "lucide-react";
import { FormResponseFields } from "@/components/forms/form-response-fields";
import { CapWidget, type CapWidgetHandle } from "@/components/cap-widget";
import { CAPTCHA_DEVELOPMENT_TOKEN, CAPTCHA_DISABLED } from "@/lib/cap-config";
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
import { Separator } from "@/components/ui/separator";
import { validateSubmissionValues, type FormField } from "@/lib/forms";

type SubmissionGrade = {
    id: string;
    revisionId: string | null;
    fieldKey: string;
    fieldLabel: string;
    fieldType: string;
    answer: unknown;
    score: string | number | null;
    maxScore: string | number | null;
    gradingType: "auto" | "manual";
    matched: boolean | null;
    comment: string | null;
    gradedAt: string | null;
};

type RevisionRequest = {
    id: string;
    editScope: "all" | "selected";
    editableFieldKeys: string[];
    reason: string;
    status: "open" | "fulfilled" | "cancelled" | "expired" | string;
    expiresAt: string | null;
    createdAt: string;
};

type SubmissionRevision = {
    id: string;
    revisionNumber: number;
    data: Record<string, unknown>;
    fields: FormField[];
    submittedVia: "initial" | "account" | "token" | string;
    createdAt: string;
    requestReason: string | null;
    grades: SubmissionGrade[];
    totalScore: string | number | null;
    maxScore: string | number | null;
    gradingStatus: string;
};

type UserSubmissionDetail = {
    submission: {
        id: string;
        formTitle: string;
        formSlug: string;
        formVersion: number;
        versionDescription: string | null;
        data: Record<string, unknown>;
        fields: FormField[];
        gradingStatus: string;
        totalScore: string | number | null;
        maxScore: string | number | null;
        processingStatus: string;
        processingNote: string | null;
        createdAt: string;
        currentRevisionId: string | null;
        revisionCount: number;
        revisionStatus: string;
        lastResubmittedAt: string | null;
    };
    grades: SubmissionGrade[];
    activeRequest: RevisionRequest | null;
    revisions: SubmissionRevision[];
    access: {
        source: "account" | "token" | "admin" | string;
        canRevise: boolean;
        revisionRequestId: string | null;
    };
};

type PageError = {
    title: string;
    description: string;
    showSignIn?: boolean;
};

type ChangeSummary = {
    key: string;
    label: string;
    before: string;
    after: string;
};

type UserSubmissionDetailClientProps = {
    submissionId: string;
    mode?: "detail" | "revise";
};

const gradingStatusLabels: Record<string, string> = {
    not_required: "无需批改",
    auto_graded: "自动批改完成",
    manual_required: "等待人工批改",
    graded: "批改完成",
};

const processingStatusLabels: Record<string, string> = {
    not_required: "无需处理",
    pending: "等待处理",
    approved: "已通过",
    rejected: "未通过",
    needs_changes: "需要补充",
};

const revisionSourceLabels: Record<string, string> = {
    initial: "首次提交",
    account: "账户补交",
    token: "链接补交",
};

function formatDate(value: string | null | undefined) {
    if (!value) return "未设置";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN");
}

function toNumber(value: string | number | null | undefined) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function formatScore(score: string | number | null, maxScore: string | number | null) {
    const current = toNumber(score);
    const maximum = toNumber(maxScore);
    if (current === null || maximum === null) return "暂未评分";
    return `${current} / ${maximum}`;
}

function formatValue(value: unknown, field?: FormField): string {
    if (Array.isArray(value)) {
        if (value.length === 0) return "未填写";
        return value.map((item) => formatValue(item, field)).join("、");
    }
    if (typeof value === "boolean") return value ? "是" : "否";
    if (value === null || value === undefined || value === "") return "未填写";

    const option = field?.options?.find((item) => item.value === String(value));
    if (option) return option.label;
    if (typeof value === "object") return "已填写结构化内容";
    return String(value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) && Array.isArray(right)) {
        const leftValues = left.map(String).sort();
        const rightValues = right.map(String).sort();
        return leftValues.length === rightValues.length &&
            leftValues.every((value, index) => value === rightValues[index]);
    }
    return false;
}

function generateFingerprint() {
    const source = [
        navigator.userAgent,
        navigator.language,
        `${screen.width}x${screen.height}`,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || "",
        navigator.maxTouchPoints || 0,
    ].join("|");
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
        hash = ((hash << 5) - hash) + source.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

function getFetchError(status: number): PageError {
    if (status === 401) {
        return {
            title: "需要验证身份",
            description: "请登录后重试，或重新打开邮件中的结果访问链接。",
            showSignIn: true,
        };
    }
    if (status === 403) {
        return { title: "无法访问此结果", description: "当前账户或访问链接没有查看此提交的权限。" };
    }
    if (status === 404) {
        return { title: "提交结果不存在", description: "该提交可能已被删除，或访问地址有误。" };
    }
    if (status === 409) {
        return { title: "提交状态已变化", description: "当前结果已被更新，请返回后重新打开。" };
    }
    if (status === 410) {
        return { title: "访问授权已过期", description: "请登录查看结果，或联系管理员获取新的访问链接。" };
    }
    return { title: "暂时无法加载结果", description: "服务暂时不可用，请稍后重试。" };
}

function getBadgeVariant(status: string) {
    if (status === "rejected") return "destructive" as const;
    if (status === "approved" || status === "graded" || status === "auto_graded") return "default" as const;
    if (status === "pending" || status === "needs_changes" || status === "manual_required") return "secondary" as const;
    return "outline" as const;
}

function isExpired(request: RevisionRequest) {
    if (request.status === "expired") return true;
    if (!request.expiresAt) return false;
    const expiresAt = new Date(request.expiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function ErrorState({ error }: { error: PageError }) {
    return (
        <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
            <ShieldAlert className="mx-auto mb-4 size-14 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-2xl font-semibold">{error.title}</h1>
            <p className="mx-auto mt-2 max-w-lg text-muted-foreground">{error.description}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                {error.showSignIn && (
                    <Button asChild>
                        <Link href="/sign-in">前往登录</Link>
                    </Button>
                )}
                <Button variant="outline" asChild>
                    <Link href="/forms">返回表单列表</Link>
                </Button>
            </div>
        </div>
    );
}

function AnswerList({
    fields,
    data,
    grades,
}: {
    fields: FormField[];
    data: Record<string, unknown>;
    grades: SubmissionGrade[];
}) {
    const visibleFields = fields.filter((field) => field.enabled);
    const gradeMap = new Map(grades.map((grade) => [grade.fieldKey, grade]));

    if (visibleFields.length === 0) {
        return <p className="py-6 text-center text-sm text-muted-foreground">此版本没有可显示的回答。</p>;
    }

    return (
        <div className="divide-y">
            {visibleFields.map((field, index) => {
                const grade = gradeMap.get(field.key);
                return (
                    <div key={field.key} className="min-w-0 py-5 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="min-w-0 break-words text-sm font-medium">
                                {index + 1}. {field.label || "未命名题目"}
                            </h3>
                            {grade && (
                                <Badge variant="outline">
                                    {formatScore(grade.score, grade.maxScore)}
                                </Badge>
                            )}
                        </div>
                        <p className="mt-2 break-words whitespace-pre-wrap text-sm text-muted-foreground">
                            {formatValue(data[field.key], field)}
                        </p>
                        {grade?.comment && (
                            <div className="mt-3 flex min-w-0 items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
                                <MessageSquareText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <p className="min-w-0 break-words whitespace-pre-wrap">{grade.comment}</p>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function ResultView({ detail }: { detail: UserSubmissionDetail }) {
    const { submission, activeRequest } = detail;
    const openRequest = activeRequest?.status === "open" && !isExpired(activeRequest)
        ? activeRequest
        : null;

    return (
        <div className="container mx-auto max-w-5xl px-4 py-10 sm:py-14">
            <Button variant="ghost" size="sm" asChild className="mb-5">
                <Link href="/forms">
                    <ArrowLeft aria-hidden="true" />
                    返回表单列表
                </Link>
            </Button>

            <header className="border-b pb-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">提交结果 · 第 {submission.formVersion} 版表单</p>
                        <h1 className="mt-1 break-words text-2xl font-semibold sm:text-3xl">{submission.formTitle}</h1>
                        {submission.versionDescription && (
                            <p className="mt-2 max-w-2xl break-words text-sm text-muted-foreground">
                                {submission.versionDescription}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant={getBadgeVariant(submission.gradingStatus)}>
                            {gradingStatusLabels[submission.gradingStatus] || "批改状态未知"}
                        </Badge>
                        <Badge variant={getBadgeVariant(submission.processingStatus)}>
                            {processingStatusLabels[submission.processingStatus] || "处理状态未知"}
                        </Badge>
                    </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <Clock3 className="size-4" aria-hidden="true" />
                        提交于 {formatDate(submission.createdAt)}
                    </span>
                    {submission.lastResubmittedAt && (
                        <span className="flex items-center gap-1.5">
                            <History className="size-4" aria-hidden="true" />
                            最近补交 {formatDate(submission.lastResubmittedAt)}
                        </span>
                    )}
                </div>
            </header>

            {openRequest && (
                <section className="my-7 border-l-4 border-primary bg-muted/40 px-4 py-4 sm:px-5" aria-labelledby="revision-request-title">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <FilePenLine className="size-5 shrink-0" aria-hidden="true" />
                                <h2 id="revision-request-title" className="font-semibold">补交请求已开放</h2>
                            </div>
                            <p className="mt-2 break-words whitespace-pre-wrap text-sm">{openRequest.reason}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                                可修改范围：{openRequest.editScope === "all" ? "全部启用字段" : `指定的 ${openRequest.editableFieldKeys.length} 个字段`}
                                <span className="mx-2">·</span>
                                截止时间：{formatDate(openRequest.expiresAt)}
                            </p>
                        </div>
                        {detail.access.canRevise ? (
                            <Button asChild className="w-full sm:w-auto">
                                <Link href={`/forms/submissions/${submission.id}/revise`}>
                                    <FilePenLine aria-hidden="true" />
                                    填写补交
                                </Link>
                            </Button>
                        ) : (
                            <p className="text-sm text-muted-foreground">当前访问方式仅可查看</p>
                        )}
                    </div>
                </section>
            )}

            <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <section className="min-w-0" aria-labelledby="current-answer-title">
                    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h2 id="current-answer-title" className="text-xl font-semibold">当前回答</h2>
                            <p className="mt-1 text-sm text-muted-foreground">当前生效版本的填写内容与公开批改信息</p>
                        </div>
                        {toNumber(submission.maxScore) !== null && (
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">总分</p>
                                <p className="text-xl font-semibold">{formatScore(submission.totalScore, submission.maxScore)}</p>
                            </div>
                        )}
                    </div>
                    <AnswerList fields={submission.fields} data={submission.data} grades={detail.grades} />
                </section>

                <aside className="min-w-0 space-y-7">
                    <section className="border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6" aria-labelledby="processing-note-title">
                        <h2 id="processing-note-title" className="text-sm font-semibold">处理备注</h2>
                        <p className="mt-2 break-words whitespace-pre-wrap text-sm text-muted-foreground">
                            {submission.processingNote || "暂无处理备注"}
                        </p>
                    </section>
                    <section className="border-t pt-5 lg:border-l lg:pl-6" aria-labelledby="result-summary-title">
                        <h2 id="result-summary-title" className="text-sm font-semibold">结果概况</h2>
                        <dl className="mt-3 space-y-3 text-sm">
                            <div>
                                <dt className="text-muted-foreground">批改</dt>
                                <dd className="mt-0.5 break-words">{gradingStatusLabels[submission.gradingStatus] || "状态未知"}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">处理</dt>
                                <dd className="mt-0.5 break-words">{processingStatusLabels[submission.processingStatus] || "状态未知"}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">版本数</dt>
                                <dd className="mt-0.5">{Math.max(submission.revisionCount, detail.revisions.length)} 个</dd>
                            </div>
                        </dl>
                    </section>
                </aside>
            </div>

            <Separator />

            <section className="py-8" aria-labelledby="revision-history-title">
                <div className="mb-5">
                    <h2 id="revision-history-title" className="text-xl font-semibold">修订时间线</h2>
                    <p className="mt-1 text-sm text-muted-foreground">按时间展示首次提交和后续补交内容</p>
                </div>
                {detail.revisions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">暂无可显示的修订记录。</p>
                ) : (
                    <ol className="relative ml-2 border-l pl-6 sm:ml-3 sm:pl-8">
                        {detail.revisions.map((revision) => (
                            <li key={revision.id} className="relative pb-9 last:pb-0">
                                <span className="bg-background absolute top-1 -left-[1.95rem] flex size-4 items-center justify-center rounded-full border sm:-left-[2.45rem]" aria-hidden="true">
                                    <span className="size-1.5 rounded-full bg-foreground" />
                                </span>
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <h3 className="font-semibold">第 {revision.revisionNumber} 次提交</h3>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {revisionSourceLabels[revision.submittedVia] || "补交"} · {formatDate(revision.createdAt)}
                                        </p>
                                    </div>
                                    {toNumber(revision.maxScore) !== null && (
                                        <Badge variant="outline">{formatScore(revision.totalScore, revision.maxScore)}</Badge>
                                    )}
                                </div>
                                {revision.requestReason && (
                                    <p className="mt-3 break-words whitespace-pre-wrap border-l-2 pl-3 text-sm text-muted-foreground">
                                        补交原因：{revision.requestReason}
                                    </p>
                                )}
                                <details className="mt-4 rounded-md border px-4 py-3">
                                    <summary className="cursor-pointer text-sm font-medium">查看本次回答</summary>
                                    <div className="mt-4">
                                        <AnswerList fields={revision.fields} data={revision.data} grades={revision.grades || []} />
                                    </div>
                                </details>
                            </li>
                        ))}
                    </ol>
                )}
            </section>
        </div>
    );
}

function getRevisionUnavailableReason(detail: UserSubmissionDetail, localError: string | null) {
    if (localError) return localError;
    const request = detail.activeRequest;
    if (!request) return "当前没有待处理的补交请求。";
    if (request.status === "fulfilled") return "本次补交请求已经完成。";
    if (request.status === "cancelled") return "本次补交请求已被取消。";
    if (isExpired(request)) return "本次补交请求已过期。";
    if (request.status !== "open") return "本次补交请求当前不可用。";
    if (!detail.access.canRevise) return "当前账户或访问链接没有补交权限。";

    const enabledFields = detail.submission.fields.filter((field) => field.enabled);
    const editableFields = request.editScope === "all"
        ? enabledFields
        : enabledFields.filter((field) => request.editableFieldKeys.includes(field.key));
    if (editableFields.length === 0) return "本次补交请求没有可修改的字段。";
    return null;
}

function RevisionView({ detail }: { detail: UserSubmissionDetail }) {
    const router = useRouter();
    const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...detail.submission.data }));
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [normalizedData, setNormalizedData] = useState<Record<string, unknown> | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [captchaToken, setCaptchaToken] = useState<string | null>(CAPTCHA_DISABLED ? CAPTCHA_DEVELOPMENT_TOKEN : null);
    const startTimeRef = useRef(Date.now());
    const capWidgetRef = useRef<CapWidgetHandle>(null);
    const request = detail.activeRequest;
    const unavailableReason = getRevisionUnavailableReason(detail, localError);
    const editableFields = useMemo(() => {
        if (!request) return [];
        const enabledFields = detail.submission.fields.filter((field) => field.enabled);
        return request.editScope === "all"
            ? enabledFields
            : enabledFields.filter((field) => request.editableFieldKeys.includes(field.key));
    }, [detail.submission.fields, request]);
    const editableFieldKeys = request?.editScope === "selected"
        ? editableFields.map((field) => field.key)
        : undefined;
    const changes = useMemo<ChangeSummary[]>(() => editableFields
        .filter((field) => !valuesEqual(detail.submission.data[field.key], values[field.key]))
        .map((field) => ({
            key: field.key,
            label: field.label || "未命名题目",
            before: formatValue(detail.submission.data[field.key], field),
            after: formatValue(values[field.key], field),
        })), [detail.submission.data, editableFields, values]);

    const focusRevisionField = (fieldKey?: string) => {
        if (!fieldKey) return;
        const element = document.getElementById(`revision-field-${fieldKey}`)
            ?? document.querySelector(`[name="${CSS.escape(fieldKey)}"]`);
        if (element instanceof HTMLElement) element.focus();
    };

    const openConfirmation = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (unavailableReason) return;
        setFieldErrors({});
        const validation = validateSubmissionValues(detail.submission.fields, values);
        if (!validation.ok) {
            setFieldErrors({ [validation.fieldKey]: validation.error });
            requestAnimationFrame(() => focusRevisionField(validation.fieldKey));
            toast.error(validation.error);
            return;
        }
        if (changes.length === 0) {
            toast.error("请至少修改一个可编辑字段");
            return;
        }
        setNormalizedData(validation.value);
        setConfirmOpen(true);
    };

    const submitRevision = async () => {
        if (!normalizedData || unavailableReason || !captchaToken) return;
        setSubmitting(true);
        try {
            const duration = Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000));
            const response = await fetch(`/api/forms/submissions/${detail.submission.id}/revisions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    data: normalizedData,
                    fingerprint: generateFingerprint(),
                    duration,
                    captchaToken,
                }),
            });
            const payload = await response.json().catch(() => ({})) as { error?: string; fieldKey?: string; code?: string };
            if (!response.ok) {
                capWidgetRef.current?.reset();
                let message = payload.error || "补交失败，请稍后重试";
                if (response.status === 401) message = "登录状态或访问授权已失效";
                if (response.status === 403) message = "当前账户或访问链接没有补交权限";
                if (response.status === 404) message = "提交结果或补交请求不存在";
                if (response.status === 409) message = "补交请求已完成、取消或发生冲突";
                if (response.status === 410) message = "补交请求已过期";
                if (payload.fieldKey) {
                    setFieldErrors({ [payload.fieldKey]: message });
                    setConfirmOpen(false);
                    requestAnimationFrame(() => focusRevisionField(payload.fieldKey));
                }
                toast.error(message);
                if ([401, 403, 404, 409, 410].includes(response.status)) {
                    setLocalError(message);
                    setConfirmOpen(false);
                }
                return;
            }
            toast.success("补交已提交");
            router.push(`/forms/submissions/${detail.submission.id}`);
            router.refresh();
        } catch {
            capWidgetRef.current?.reset();
            toast.error("网络异常，补交未提交");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="container mx-auto max-w-3xl px-4 py-10 sm:py-14">
            <Button variant="ghost" size="sm" asChild className="mb-5">
                <Link href={`/forms/submissions/${detail.submission.id}`}>
                    <ArrowLeft aria-hidden="true" />
                    返回结果页
                </Link>
            </Button>

            <header className="border-b pb-7">
                <p className="text-sm text-muted-foreground">补交回答</p>
                <h1 className="mt-1 break-words text-2xl font-semibold sm:text-3xl">{detail.submission.formTitle}</h1>
                {request && (
                    <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
                        <div className="min-w-0 sm:col-span-3">
                            <dt className="font-medium">补交原因</dt>
                            <dd className="mt-1 break-words whitespace-pre-wrap text-muted-foreground">{request.reason}</dd>
                        </div>
                        <div>
                            <dt className="font-medium">可修改范围</dt>
                            <dd className="mt-1 text-muted-foreground">
                                {request.editScope === "all" ? "全部启用字段" : `指定的 ${editableFields.length} 个字段`}
                            </dd>
                        </div>
                        <div>
                            <dt className="font-medium">截止时间</dt>
                            <dd className="mt-1 text-muted-foreground">{formatDate(request.expiresAt)}</dd>
                        </div>
                        <div>
                            <dt className="font-medium">请求时间</dt>
                            <dd className="mt-1 text-muted-foreground">{formatDate(request.createdAt)}</dd>
                        </div>
                    </dl>
                )}
            </header>

            {unavailableReason ? (
                <section className="py-16 text-center" aria-live="polite">
                    <AlertCircle className="mx-auto size-12 text-muted-foreground" aria-hidden="true" />
                    <h2 className="mt-4 text-xl font-semibold">暂时无法补交</h2>
                    <p className="mx-auto mt-2 max-w-lg text-muted-foreground">{unavailableReason}</p>
                    <Button variant="outline" asChild className="mt-6">
                        <Link href={`/forms/submissions/${detail.submission.id}`}>查看提交结果</Link>
                    </Button>
                </section>
            ) : (
                <section className="py-8" aria-labelledby="revision-fields-title">
                    <div className="mb-7">
                        <h2 id="revision-fields-title" className="text-xl font-semibold">修改回答</h2>
                        <p className="mt-1 text-sm text-muted-foreground">只读字段会保留原回答，提交前可核对所有变更。</p>
                    </div>
                    <form className="space-y-6" onSubmit={openConfirmation} noValidate>
                        {Object.values(fieldErrors)[0] && (
                            <div role="alert" aria-live="polite" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                                {Object.values(fieldErrors)[0]}
                            </div>
                        )}
                        <FormResponseFields
                            fields={detail.submission.fields}
                            values={values}
                            onValueChange={(fieldKey, value) => {
                                setValues((current) => ({ ...current, [fieldKey]: value }));
                                setFieldErrors((current) => {
                                    if (!current[fieldKey]) return current;
                                    const next = { ...current };
                                    delete next[fieldKey];
                                    return next;
                                });
                            }}
                            idPrefix="revision-field"
                            editableFieldKeys={editableFieldKeys}
                            disabled={submitting}
                            errors={fieldErrors}
                        />
                        <Separator />
                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <Button variant="outline" asChild>
                                <Link href={`/forms/submissions/${detail.submission.id}`}>取消</Link>
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                <CheckCircle2 aria-hidden="true" />
                                核对并提交
                            </Button>
                        </div>
                    </form>
                </section>
            )}

            <Dialog open={confirmOpen} onOpenChange={(open) => {
                if (!submitting) {
                    setConfirmOpen(open);
                    if (!open) capWidgetRef.current?.reset();
                }
            }}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>确认补交内容</DialogTitle>
                        <DialogDescription>提交后本次请求将完成，以下字段会更新。</DialogDescription>
                    </DialogHeader>
                    <div className="divide-y rounded-md border">
                        {changes.map((change) => (
                            <div key={change.key} className="min-w-0 px-4 py-3 text-sm">
                                <p className="break-words font-medium">{change.label}</p>
                                <dl className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
                                    <div className="min-w-0">
                                        <dt className="text-xs text-muted-foreground">修改前</dt>
                                        <dd className="mt-0.5 break-words whitespace-pre-wrap">{change.before}</dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="text-xs text-muted-foreground">修改后</dt>
                                        <dd className="mt-0.5 break-words whitespace-pre-wrap">{change.after}</dd>
                                    </div>
                                </dl>
                            </div>
                        ))}
                    </div>
                    <CapWidget ref={capWidgetRef} onTokenChange={setCaptchaToken} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>返回修改</Button>
                        <Button onClick={submitRevision} disabled={submitting || !captchaToken}>
                            {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}
                            确认提交
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export function UserSubmissionDetailClient({
    submissionId,
    mode = "detail",
}: UserSubmissionDetailClientProps) {
    const [detail, setDetail] = useState<UserSubmissionDetail | null>(null);
    const [error, setError] = useState<PageError | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        async function loadDetail() {
            try {
                const response = await fetch(`/api/forms/submissions/${submissionId}`, {
                    cache: "no-store",
                    signal: controller.signal,
                });
                if (!response.ok) {
                    setError(getFetchError(response.status));
                    return;
                }
                const payload = await response.json() as UserSubmissionDetail;
                setDetail(payload);
            } catch (requestError) {
                if (requestError instanceof DOMException && requestError.name === "AbortError") return;
                setError(getFetchError(500));
            }
        }

        void loadDetail();
        return () => controller.abort();
    }, [submissionId]);

    if (error) return <ErrorState error={error} />;
    if (!detail) {
        return (
            <div className="flex min-h-[45vh] items-center justify-center" role="status" aria-label="正在加载提交结果">
                <Loader2 className="size-7 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
        );
    }

    return mode === "revise" ? <RevisionView detail={detail} /> : <ResultView detail={detail} />;
}

export type { UserSubmissionDetail };
