"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, ChevronRight, ClipboardList, Download, Globe, Fingerprint, Loader2, Monitor, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type FormField = {
    key: string;
    label: string;
    type: string;
};

type Submission = {
    id: string;
    user_id: string | null;
    user_email: string | null;
    user_name: string | null;
    user_image: string | null;
    data: Record<string, unknown>;
    ip_address: string | null;
    user_agent: string | null;
    fingerprint: string | null;
    duration: number | null;
    created_at: string;
    version: number;
    version_title: string;
};

type FormInfo = {
    id: string;
    title: string;
    fields: FormField[];
    current_version: number | null;
};

function formatDuration(seconds: number) {
    if (seconds < 60) return `${seconds} 秒`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分钟`;
}

export default function FormSubmissionsPage() {
    const params = useParams<{ id: string }>();
    const [formInfo, setFormInfo] = useState<FormInfo | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const [stats, setStats] = useState<{ submitted_count: number; flagged_count: number; archived_count: number; last_submitted_at: string | null }>({
        submitted_count: 0,
        flagged_count: 0,
        archived_count: 0,
        last_submitted_at: null,
    });
    const limit = 20;

    const fetchFormInfo = useCallback(async () => {
        try {
            const res = await fetch(`/api/forms/${params.id}`);
            const data = await res.json();
            if (res.ok) {
                setFormInfo(data.form);
            }
        } catch {
            // ignore
        }
    }, [params.id]);

    const fetchSubmissions = useCallback(async () => {
        try {
            const paramsQuery = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                query,
                status,
            });
            const res = await fetch(`/api/forms/${params.id}/submissions?${paramsQuery}`);
            const data = await res.json();
            setSubmissions(data.submissions || []);
            setTotal(data.total || 0);
            setStats(data.stats || stats);
        } catch {
            toast.error("获取提交列表失败");
        } finally {
            setLoading(false);
        }
    }, [page, params.id, query, status, stats]);

    useEffect(() => {
        fetchFormInfo();
    }, [fetchFormInfo]);

    useEffect(() => {
        setLoading(true);
        fetchSubmissions();
    }, [fetchSubmissions]);

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="size-8" asChild>
                            <Link href="/dashboard/forms">
                                <ArrowLeft className="size-4" />
                            </Link>
                        </Button>
                        <h1 className="text-3xl font-bold tracking-tight">{formInfo?.title || "表单"} - 提交管理</h1>
                    </div>
                    <p className="ml-10 text-muted-foreground">共 {total} 条提交记录</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href={`/api/forms/${params.id}/submissions/export`}>
                        <Download className="size-4" />
                        导出 CSV
                    </Link>
                </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border p-4">
                    <p className="text-sm text-muted-foreground">总提交</p>
                    <p className="mt-2 text-2xl font-semibold">{total}</p>
                </div>
                <div className="rounded-md border p-4">
                    <p className="text-sm text-muted-foreground">最近提交</p>
                    <p className="mt-2 text-sm font-medium">{stats.last_submitted_at ? new Date(stats.last_submitted_at).toLocaleString("zh-CN") : "暂无"}</p>
                </div>
                <div className="rounded-md border p-4">
                    <p className="text-sm text-muted-foreground">状态分布</p>
                    <p className="mt-2 text-sm">
                        提交 {stats.submitted_count} / 标记 {stats.flagged_count} / 归档 {stats.archived_count}
                    </p>
                </div>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
                <input
                    className="h-10 min-w-64 rounded-md border bg-background px-3 text-sm"
                    placeholder="搜索邮箱、姓名或内容"
                    value={query}
                    onChange={(event) => {
                        setPage(0);
                        setQuery(event.target.value);
                    }}
                />
                <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={status}
                    onChange={(event) => {
                        setPage(0);
                        setStatus(event.target.value);
                    }}
                >
                    <option value="all">全部状态</option>
                    <option value="submitted">提交</option>
                    <option value="flagged">标记</option>
                    <option value="archived">归档</option>
                </select>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10" />
                            <TableHead>提交者</TableHead>
                            <TableHead>邮箱</TableHead>
                            <TableHead>版本</TableHead>
                            <TableHead>填写用时</TableHead>
                            <TableHead>提交时间</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-8">
                                    <div className="flex justify-center">
                                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : submissions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-12">
                                    <div className="flex flex-col items-center justify-center text-center">
                                        <ClipboardList className="mb-4 size-12 text-muted-foreground" />
                                        <p className="text-muted-foreground">暂无提交记录</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            submissions.map((submission) => {
                                const isExpanded = expandedId === submission.id;
                                return (
                                    <Fragment key={submission.id}>
                                        <TableRow>
                                            <TableCell>
                                                <button
                                                    className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
                                                    onClick={() => setExpandedId(isExpanded ? null : submission.id)}
                                                >
                                                    {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                                </button>
                                            </TableCell>
                                            <TableCell className="font-medium">{submission.user_name || "匿名用户"}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{submission.user_email || "-"}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">v{submission.version}</Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {submission.duration != null ? <Badge variant="outline" className="gap-1 font-normal"><Timer className="size-3" />{formatDuration(submission.duration)}</Badge> : "-"}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{new Date(submission.created_at).toLocaleString("zh-CN")}</TableCell>
                                        </TableRow>

                                        {isExpanded && (
                                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                <TableCell colSpan={6} className="p-0">
                                                    <div className="space-y-4 px-6 py-4">
                                                        <div>
                                                            <p className="mb-2 text-xs font-medium text-muted-foreground">提交内容</p>
                                                            <div className="grid gap-2">
                                                                {formInfo?.fields.map((field) => (
                                                                    <div key={field.key} className="flex gap-3 rounded bg-background px-3 py-2 text-sm">
                                                                        <span className="min-w-[120px] shrink-0 font-medium text-muted-foreground">{field.label}：</span>
                                                                        <span className="break-all whitespace-pre-wrap text-foreground">
                                                                            {field.type === "checkbox"
                                                                                ? submission.data[field.key] ? "是" : "否"
                                                                                : String(submission.data[field.key] ?? "-")}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="grid gap-2 md:grid-cols-2">
                                                            <div className="flex items-center gap-2 rounded bg-background px-3 py-2 text-sm">
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger>
                                                                            <Globe className="size-3.5 text-muted-foreground" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>IP 地址</TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                                <span className="font-medium text-muted-foreground">IP：</span>
                                                                <span className="font-mono text-xs">{submission.ip_address || "-"}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 rounded bg-background px-3 py-2 text-sm">
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger>
                                                                            <Fingerprint className="size-3.5 text-muted-foreground" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>浏览器指纹</TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                                <span className="font-medium text-muted-foreground">指纹：</span>
                                                                <span className="font-mono text-xs">{submission.fingerprint || "-"}</span>
                                                            </div>
                                                            <div className="flex items-start gap-2 rounded bg-background px-3 py-2 text-sm md:col-span-2">
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger>
                                                                            <Monitor className="mt-0.5 size-3.5 text-muted-foreground" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>User-Agent</TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                                <span className="font-medium text-muted-foreground">UA：</span>
                                                                <span className="break-all font-mono text-xs">{submission.user_agent || "-"}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>上一页</Button>
                    <span className="text-sm text-muted-foreground">第 {page + 1} / {totalPages} 页</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>下一页</Button>
                </div>
            )}
        </div>
    );
}
