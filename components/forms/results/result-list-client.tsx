"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
    ArrowLeft,
    ClipboardList,
    Download,
    Eye,
    Loader2,
    Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type ResultRow = {
    id: string;
    form_id: string;
    form_title: string | null;
    collection_label: string | null;
    user_email: string | null;
    user_name: string | null;
    status: string;
    grading_status: string;
    total_score: string | number | null;
    max_score: string | number | null;
    processing_status: string;
    processed_at: string | null;
    processed_by_name: string | null;
    created_at: string;
    duration: number | null;
    version: number | string | null;
};

type ResultStats = {
    total: number;
    form_count?: number;
    last_submitted_at: string | null;
    not_required_grading_count: number;
    auto_graded_count: number;
    manual_required_count: number;
    graded_count: number;
    not_required_processing_count: number;
    pending_processing_count: number;
    approved_count: number;
    rejected_count: number;
    needs_changes_count: number;
    avg_score: string | number | null;
    highest_score: string | number | null;
};

type ResultFormOption = {
    id: string;
    title: string;
    slug: string;
};

type ResultListPayload = {
    results: ResultRow[];
    total: number;
    stats: ResultStats;
    forms: ResultFormOption[];
    labels: string[];
};

type ResultFilters = {
    page: number;
    query: string;
    formId: string;
    status: string;
    gradingStatus: string;
    processingStatus: string;
    scoreFilter: string;
    collectionLabel: string;
};

type ResultListClientProps = {
    initialData: ResultListPayload;
    initialFilters: ResultFilters;
    fixedFormId?: string;
    title: string;
    description: string;
    backHref?: string;
    exportHref?: string;
};

const PAGE_SIZE = 20;

const emptyStats: ResultStats = {
    total: 0,
    last_submitted_at: null,
    not_required_grading_count: 0,
    auto_graded_count: 0,
    manual_required_count: 0,
    graded_count: 0,
    not_required_processing_count: 0,
    pending_processing_count: 0,
    approved_count: 0,
    rejected_count: 0,
    needs_changes_count: 0,
    avg_score: null,
    highest_score: null,
};

const statusLabels: Record<string, string> = {
    all: "全部收集状态",
    submitted: "已提交",
    flagged: "已标记",
    archived: "已归档",
};

const gradingStatusLabels: Record<string, string> = {
    all: "全部批改状态",
    not_required: "无需批改",
    auto_graded: "自动批改",
    manual_required: "待人工批改",
    graded: "已批改",
};

const processingStatusLabels: Record<string, string> = {
    all: "全部处理状态",
    not_required: "无需处理",
    pending: "待处理",
    approved: "已通过",
    rejected: "已拒绝",
    needs_changes: "需补充",
};

const scoreFilterLabels: Record<string, string> = {
    all: "全部分数",
    scored: "有分数",
    unscored: "无分数",
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

function normalizePayload(data: Partial<ResultListPayload> | null | undefined): ResultListPayload {
    return {
        results: Array.isArray(data?.results) ? data.results : [],
        total: Number(data?.total ?? 0),
        stats: { ...emptyStats, ...(data?.stats ?? {}) },
        forms: Array.isArray(data?.forms) ? data.forms : [],
        labels: Array.isArray(data?.labels) ? data.labels : [],
    };
}

function getBadgeVariant(value: string) {
    if (value === "rejected") return "destructive" as const;
    if (value === "manual_required" || value === "pending" || value === "needs_changes") return "secondary" as const;
    if (value === "approved" || value === "graded" || value === "auto_graded") return "default" as const;
    return "outline" as const;
}

function buildQuery(filters: ResultFilters) {
    const params = new URLSearchParams({
        page: String(filters.page),
        limit: String(PAGE_SIZE),
        query: filters.query,
        formId: filters.formId,
        status: filters.status,
        gradingStatus: filters.gradingStatus,
        processingStatus: filters.processingStatus,
        scoreFilter: filters.scoreFilter,
        collectionLabel: filters.collectionLabel,
    });
    return params.toString();
}

export function ResultListClient({
    initialData,
    initialFilters,
    fixedFormId,
    title,
    description,
    backHref,
    exportHref,
}: ResultListClientProps) {
    const [data, setData] = useState<ResultListPayload>(() => normalizePayload(initialData));
    const [filters, setFilters] = useState<ResultFilters>(initialFilters);
    const [draftFilters, setDraftFilters] = useState<ResultFilters>(initialFilters);
    const [loading, setLoading] = useState(false);
    const didMountRef = useRef(false);

    const endpoint = fixedFormId ? `/api/forms/${fixedFormId}/results` : "/api/forms/results";
    const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
    const stats = data.stats;
    const averageScore = toNumber(stats.avg_score);
    const highestScore = toNumber(stats.highest_score);

    const activeFiltersLabel = useMemo(() => {
        const labels = [
            fixedFormId ? null : data.forms.find((form) => form.id === filters.formId)?.title,
            filters.status !== "all" ? statusLabels[filters.status] : null,
            filters.gradingStatus !== "all" ? gradingStatusLabels[filters.gradingStatus] : null,
            filters.processingStatus !== "all" ? processingStatusLabels[filters.processingStatus] : null,
            filters.scoreFilter !== "all" ? scoreFilterLabels[filters.scoreFilter] : null,
            filters.collectionLabel !== "all" ? filters.collectionLabel : null,
            filters.query ? `关键词：${filters.query}` : null,
        ].filter(Boolean);
        return labels.length > 0 ? labels.join(" / ") : "当前显示全部结果";
    }, [data.forms, filters, fixedFormId]);

    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }

        const controller = new AbortController();
        async function fetchResults() {
            setLoading(true);
            try {
                const res = await fetch(`${endpoint}?${buildQuery(filters)}`, {
                    signal: controller.signal,
                });
                const nextData = await res.json();
                if (!res.ok) {
                    toast.error(nextData.error || "获取结果失败");
                    return;
                }
                setData(normalizePayload(nextData));
            } catch (error) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    toast.error("获取结果失败");
                }
            } finally {
                setLoading(false);
            }
        }

        fetchResults();
        return () => controller.abort();
    }, [endpoint, filters]);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFilters({ ...draftFilters, page: 0 });
    };

    const setDraftValue = (key: keyof ResultFilters, value: string) => {
        setDraftFilters((prev) => ({ ...prev, [key]: value, page: 0 }));
    };

    const setPage = (page: number) => {
        const nextPage = Math.min(Math.max(page, 0), totalPages - 1);
        setFilters((prev) => ({ ...prev, page: nextPage }));
        setDraftFilters((prev) => ({ ...prev, page: nextPage }));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        {backHref && (
                            <Button variant="ghost" size="icon" className="size-8" asChild>
                                <Link href={backHref} aria-label="返回">
                                    <ArrowLeft className="size-4" />
                                </Link>
                            </Button>
                        )}
                        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                    </div>
                    <p className={backHref ? "ml-10 mt-1 text-muted-foreground" : "mt-1 text-muted-foreground"}>
                        {description}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {exportHref && (
                        <Button variant="outline" asChild>
                            <Link href={exportHref}>
                                <Download className="size-4" />
                                导出 CSV
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-md border bg-background p-4">
                    <p className="text-sm text-muted-foreground">结果总数</p>
                    <p className="mt-2 text-2xl font-semibold">{stats.total}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {fixedFormId ? "当前表单" : `${stats.form_count ?? 0} 个表单`}
                    </p>
                </div>
                <div className="rounded-md border bg-background p-4">
                    <p className="text-sm text-muted-foreground">待人工批改</p>
                    <p className="mt-2 text-2xl font-semibold">{stats.manual_required_count}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        已批改 {stats.graded_count + stats.auto_graded_count}
                    </p>
                </div>
                <div className="rounded-md border bg-background p-4">
                    <p className="text-sm text-muted-foreground">待处理</p>
                    <p className="mt-2 text-2xl font-semibold">{stats.pending_processing_count}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        通过 {stats.approved_count} / 拒绝 {stats.rejected_count}
                    </p>
                </div>
                <div className="rounded-md border bg-background p-4">
                    <p className="text-sm text-muted-foreground">平均分</p>
                    <p className="mt-2 text-2xl font-semibold">{averageScore === null ? "—" : averageScore.toFixed(2)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        最高分 {highestScore === null ? "—" : highestScore}
                    </p>
                </div>
                <div className="rounded-md border bg-background p-4">
                    <p className="text-sm text-muted-foreground">最近提交</p>
                    <p className="mt-2 text-sm font-medium">{formatDate(stats.last_submitted_at)}</p>
                </div>
            </div>

            <Separator />

            <form className="grid gap-2 lg:grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(132px,0.8fr))_auto]" onSubmit={handleSubmit}>
                <Input
                    id="result-search"
                    name="query"
                    value={draftFilters.query}
                    onChange={(event) => setDraftValue("query", event.target.value)}
                    placeholder="搜索邮箱、姓名、表单或内容"
                    aria-label="搜索结果"
                />

                {!fixedFormId && (
                    <Select name="formId" value={draftFilters.formId} onValueChange={(value) => setDraftValue("formId", value)}>
                        <SelectTrigger id="result-form-filter" aria-label="筛选表单" className="w-full">
                            <SelectValue placeholder="表单" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部表单</SelectItem>
                            {data.forms.map((form) => (
                                <SelectItem key={form.id} value={form.id}>
                                    {form.title || "未命名表单"}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                <Select name="gradingStatus" value={draftFilters.gradingStatus} onValueChange={(value) => setDraftValue("gradingStatus", value)}>
                    <SelectTrigger id="result-grading-status-filter" aria-label="筛选批改状态" className="w-full">
                        <SelectValue placeholder="批改状态" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(gradingStatusLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select name="processingStatus" value={draftFilters.processingStatus} onValueChange={(value) => setDraftValue("processingStatus", value)}>
                    <SelectTrigger id="result-processing-status-filter" aria-label="筛选处理状态" className="w-full">
                        <SelectValue placeholder="处理状态" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(processingStatusLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select name="scoreFilter" value={draftFilters.scoreFilter} onValueChange={(value) => setDraftValue("scoreFilter", value)}>
                    <SelectTrigger id="result-score-filter" aria-label="筛选分数状态" className="w-full">
                        <SelectValue placeholder="分数" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(scoreFilterLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select name="collectionLabel" value={draftFilters.collectionLabel} onValueChange={(value) => setDraftValue("collectionLabel", value)}>
                    <SelectTrigger id="result-collection-label-filter" aria-label="筛选结果场景" className="w-full">
                        <SelectValue placeholder="场景" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部场景</SelectItem>
                        {data.labels.map((label) => (
                            <SelectItem key={label} value={label}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    搜索
                </Button>
            </form>

            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <p>{activeFiltersLabel}</p>
                <p>共 {data.total} 条结果</p>
            </div>

            <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[920px]">
                    <TableHeader>
                        <TableRow>
                            <TableHead>表单</TableHead>
                            <TableHead>场景</TableHead>
                            <TableHead>提交者</TableHead>
                            <TableHead>分数</TableHead>
                            <TableHead>批改状态</TableHead>
                            <TableHead>处理状态</TableHead>
                            <TableHead>提交时间</TableHead>
                            <TableHead className="w-[88px]">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="py-10 text-center">
                                    <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : data.results.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="py-12">
                                    <div className="flex flex-col items-center justify-center text-center">
                                        <ClipboardList className="mb-4 size-12 text-muted-foreground" />
                                        <p className="text-muted-foreground">暂无结果</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.results.map((result) => (
                                <TableRow key={result.id}>
                                    <TableCell>
                                        <div>
                                            <p className="max-w-[220px] truncate font-medium">{result.form_title || "未命名表单"}</p>
                                            <p className="text-xs text-muted-foreground">v{result.version ?? "-"}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {result.collection_label ? (
                                            <Badge variant="outline">{result.collection_label}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">{result.user_name || "匿名用户"}</p>
                                            <p className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">{result.user_email || "—"}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">{formatScore(result.total_score, result.max_score)}</TableCell>
                                    <TableCell>
                                        <Badge variant={getBadgeVariant(result.grading_status)}>
                                            {gradingStatusLabels[result.grading_status] || result.grading_status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getBadgeVariant(result.processing_status)}>
                                            {processingStatusLabels[result.processing_status] || result.processing_status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{formatDate(result.created_at)}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" className="size-8" asChild>
                                            <Link
                                                href={`/dashboard/forms/${result.form_id}/results/${result.id}`}
                                                aria-label="查看结果详情"
                                            >
                                                <Eye className="size-4" />
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {data.total > PAGE_SIZE && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        第 {filters.page + 1} / {totalPages} 页
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={filters.page === 0 || loading}
                            onClick={() => setPage(filters.page - 1)}
                        >
                            上一页
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={filters.page >= totalPages - 1 || loading}
                            onClick={() => setPage(filters.page + 1)}
                        >
                            下一页
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export type { ResultFilters, ResultListPayload };
