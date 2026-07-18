"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    AlertCircle,
    ArrowRight,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 20;

const statusOptions = [
    { value: "all", label: "全部提交" },
    { value: "pending", label: "待处理" },
    { value: "needs_changes", label: "需补充" },
    { value: "graded", label: "已批改" },
    { value: "approved", label: "已通过" },
    { value: "rejected", label: "已拒绝" },
    { value: "resubmitted", label: "已补交" },
] as const;

type SubmissionStatusFilter = typeof statusOptions[number]["value"];

type UserSubmission = {
    id: string;
    form_id: string;
    form_title: string | null;
    form_slug: string | null;
    form_version: number | string | null;
    grading_status: string;
    processing_status: string;
    total_score: number | string | null;
    max_score: number | string | null;
    revision_count: number | string | null;
    revision_status: string | null;
    revision_request_status: string | null;
    revision_request_expires_at: string | null;
    created_at: string;
    last_resubmitted_at: string | null;
};

type SubmissionListPayload = {
    submissions: UserSubmission[];
    total: number;
    page: number;
    limit: number;
    pageCount: number;
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

const revisionStatusLabels: Record<string, string> = {
    requested: "待补交",
    resubmitted: "已补交",
    open: "待补交",
    fulfilled: "已补交",
    cancelled: "补交已取消",
    expired: "补交已过期",
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
});

function isStatusFilter(value: string): value is SubmissionStatusFilter {
    return statusOptions.some((option) => option.value === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function readErrorMessage(value: unknown) {
    return isRecord(value) && typeof value.error === "string" ? value.error : null;
}

function normalizePayload(value: unknown): SubmissionListPayload {
    if (!isRecord(value) || !Array.isArray(value.submissions)) {
        throw new Error("服务器返回的数据格式不正确");
    }

    return {
        submissions: value.submissions as UserSubmission[],
        total: Number(value.total) || 0,
        page: Number(value.page) || 0,
        limit: Number(value.limit) || PAGE_SIZE,
        pageCount: Math.max(0, Number(value.pageCount) || 0),
    };
}

function toNumber(value: number | string | null | undefined) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function formatScore(score: number | string | null, maxScore: number | string | null) {
    const current = toNumber(score);
    const maximum = toNumber(maxScore);
    if (current === null || maximum === null) return "暂未评分";
    return `${current} / ${maximum} 分`;
}

function formatDate(value: string | null) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
}

function getBadgeVariant(value: string) {
    if (value === "rejected" || value === "cancelled" || value === "expired") {
        return "destructive" as const;
    }
    if (
        value === "manual_required" ||
        value === "pending" ||
        value === "needs_changes" ||
        value === "requested" ||
        value === "open"
    ) {
        return "secondary" as const;
    }
    if (
        value === "approved" ||
        value === "graded" ||
        value === "auto_graded" ||
        value === "fulfilled" ||
        value === "resubmitted"
    ) {
        return "default" as const;
    }
    return "outline" as const;
}

function getRevisionState(submission: UserSubmission) {
    let status = submission.revision_request_status;
    const expiresAt = submission.revision_request_expires_at
        ? new Date(submission.revision_request_expires_at)
        : null;

    if (
        status === "open" &&
        expiresAt &&
        !Number.isNaN(expiresAt.getTime()) &&
        expiresAt.getTime() <= Date.now()
    ) {
        status = "expired";
    }

    if (!status && submission.revision_status && submission.revision_status !== "none") {
        status = submission.revision_status;
    }
    if (!status) return null;

    let detail: string | null = null;
    if (status === "open" || status === "requested") {
        const formattedExpiry = formatDate(submission.revision_request_expires_at);
        detail = formattedExpiry ? `截止 ${formattedExpiry}` : null;
    } else if (status === "fulfilled" || status === "resubmitted") {
        const formattedResubmission = formatDate(submission.last_resubmitted_at);
        detail = formattedResubmission ? `${formattedResubmission} 补交` : null;
    }

    return {
        status,
        label: revisionStatusLabels[status] || status,
        detail,
    };
}

function SubmissionListSkeleton() {
    return (
        <div className="divide-y rounded-md border" aria-label="正在加载提交记录">
            {[0, 1, 2].map((item) => (
                <div key={item} className="space-y-4 px-4 py-5 sm:px-5">
                    <div className="flex items-center justify-between gap-4">
                        <Skeleton className="h-5 w-44 max-w-[65%]" />
                        <Skeleton className="h-5 w-16" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-24" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function UserSubmissionListClient() {
    const [status, setStatus] = useState<SubmissionStatusFilter>("all");
    const [page, setPage] = useState(0);
    const [data, setData] = useState<SubmissionListPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        async function loadSubmissions() {
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({
                    page: String(page),
                    limit: String(PAGE_SIZE),
                    status,
                });
                const response = await fetch(`/api/forms/submissions/mine?${params}`, {
                    cache: "no-store",
                    signal: controller.signal,
                });
                const body: unknown = await response.json().catch(() => null);

                if (response.status === 401) {
                    window.location.assign("/sign-in?callbackURL=%2Fforms%2Fmy-submissions");
                    return;
                }
                if (!response.ok) {
                    throw new Error(readErrorMessage(body) || "加载提交记录失败");
                }

                setData(normalizePayload(body));
            } catch (loadError) {
                if (controller.signal.aborted) return;
                setError(loadError instanceof Error ? loadError.message : "加载提交记录失败");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        void loadSubmissions();
        return () => controller.abort();
    }, [page, reloadKey, status]);

    const changeStatus = (value: string) => {
        if (!isStatusFilter(value)) return;
        setStatus(value);
        setPage(0);
    };

    return (
        <div className="container mx-auto max-w-4xl px-4 py-12">
            <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-3xl font-bold tracking-tight">我的提交</h1>
                    <p className="mt-2 text-muted-foreground">查看表单处理、评分与补交进度</p>
                </div>
                <Button variant="outline" asChild className="w-full sm:w-auto">
                    <Link href="/forms">
                        <ClipboardList />
                        返回表单列表
                    </Link>
                </Button>
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <label htmlFor="submission-status" className="shrink-0 text-sm font-medium">
                        状态
                    </label>
                    <Select value={status} onValueChange={changeStatus} disabled={loading}>
                        <SelectTrigger id="submission-status" className="w-full min-w-0 sm:w-44" aria-label="筛选提交状态">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {statusOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                    {loading ? "正在加载" : `共 ${data?.total ?? 0} 条记录`}
                </p>
            </div>

            {loading ? (
                <SubmissionListSkeleton />
            ) : error ? (
                <div className="rounded-md border px-4 py-12 text-center" role="alert">
                    <AlertCircle className="mx-auto size-10 text-destructive" />
                    <p className="mt-4 font-medium">无法加载提交记录</p>
                    <p className="mt-1 break-words text-sm text-muted-foreground">{error}</p>
                    <Button variant="outline" className="mt-5" onClick={() => setReloadKey((key) => key + 1)}>
                        <RefreshCw />
                        重新加载
                    </Button>
                </div>
            ) : !data || data.submissions.length === 0 ? (
                <div className="rounded-md border px-4 py-16 text-center">
                    <ClipboardList className="mx-auto size-12 text-muted-foreground" />
                    <p className="mt-4 font-medium">暂无提交记录</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {status === "all" ? "填写并提交表单后，记录会显示在这里" : "当前筛选条件下没有记录"}
                    </p>
                    {status === "all" ? (
                        <Button variant="outline" className="mt-5" asChild>
                            <Link href="/forms">浏览表单</Link>
                        </Button>
                    ) : (
                        <Button variant="outline" className="mt-5" onClick={() => changeStatus("all")}>
                            查看全部提交
                        </Button>
                    )}
                </div>
            ) : (
                <div className="divide-y rounded-md border">
                    {data.submissions.map((submission) => {
                        const revision = getRevisionState(submission);
                        const createdAt = formatDate(submission.created_at) || "时间未知";
                        const version = toNumber(submission.form_version);

                        return (
                            <Link
                                key={submission.id}
                                href={`/forms/submissions/${submission.id}`}
                                className="group block min-w-0 px-4 py-5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-5"
                            >
                                <div className="flex min-w-0 items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <h2 className="break-words font-semibold">
                                                    {submission.form_title || "未命名表单"}
                                                </h2>
                                                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <CalendarDays className="size-3.5" />
                                                        {createdAt}
                                                    </span>
                                                    {version !== null && <span>表单版本 v{version}</span>}
                                                    {(toNumber(submission.revision_count) ?? 0) > 1 && (
                                                        <span>第 {toNumber(submission.revision_count)} 次提交</span>
                                                    )}
                                                </p>
                                            </div>
                                            <p className="shrink-0 font-mono text-sm font-medium">
                                                {formatScore(submission.total_score, submission.max_score)}
                                            </p>
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center gap-2">
                                            <Badge variant={getBadgeVariant(submission.processing_status)}>
                                                {processingStatusLabels[submission.processing_status] || submission.processing_status}
                                            </Badge>
                                            <Badge variant={getBadgeVariant(submission.grading_status)}>
                                                {gradingStatusLabels[submission.grading_status] || submission.grading_status}
                                            </Badge>
                                            {revision && (
                                                <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
                                                    <Badge variant={getBadgeVariant(revision.status)}>{revision.label}</Badge>
                                                    {revision.detail && (
                                                        <span className="break-words text-xs text-muted-foreground">{revision.detail}</span>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ArrowRight className="mt-0.5 hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {!loading && !error && data && data.pageCount > 1 && (
                <nav className="mt-6 flex items-center justify-between gap-3" aria-label="提交记录分页">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((current) => Math.max(0, current - 1))}
                        disabled={page <= 0}
                    >
                        <ChevronLeft />
                        上一页
                    </Button>
                    <span className="text-center text-sm text-muted-foreground">
                        第 {data.page + 1} / {data.pageCount} 页
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((current) => current + 1)}
                        disabled={page >= data.pageCount - 1}
                    >
                        下一页
                        <ChevronRight />
                    </Button>
                </nav>
            )}
        </div>
    );
}
