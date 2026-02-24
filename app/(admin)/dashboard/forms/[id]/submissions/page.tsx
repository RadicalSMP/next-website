"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    Loader2,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    ArrowLeft,
    Globe,
    Fingerprint,
    Monitor,
    Timer,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

/* ─── 类型定义 ─────────────────────────────────────────────── */

interface FormField {
    key: string;
    label: string;
    type: string;
}

interface Submission {
    id: string;
    form_id: string;
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
}

interface FormInfo {
    id: string;
    title: string;
    fields: FormField[];
}

/* ─── 辅助函数 ─────────────────────────────────────────────── */

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds} 秒`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分钟`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h} 小时 ${rm} 分` : `${h} 小时`;
}

/* ─── 主组件 ─────────────────────────────────────────────── */

export default function FormSubmissionsPage() {
    const params = useParams<{ id: string }>();

    const [formInfo, setFormInfo] = useState<FormInfo | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const limit = 20;

    // ─── 加载表单信息 ─────────────────────────────────────
    const fetchFormInfo = useCallback(async () => {
        try {
            const res = await fetch(`/api/forms/${params.id}`);
            if (res.ok) {
                const data = await res.json();
                setFormInfo(data.form);
            }
        } catch {
            // 忽略
        }
    }, [params.id]);

    // ─── 加载提交列表 ─────────────────────────────────────
    const fetchSubmissions = useCallback(async () => {
        try {
            const queryParams = new URLSearchParams({
                page: String(page),
                limit: String(limit),
            });
            const res = await fetch(
                `/api/forms/${params.id}/submissions?${queryParams}`,
            );
            const data = await res.json();
            setSubmissions(data.submissions || []);
            setTotal(data.total || 0);
        } catch {
            toast.error("获取提交列表失败");
        } finally {
            setLoading(false);
        }
    }, [params.id, page]);

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
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Button variant="ghost" size="icon" className="size-8" asChild>
                            <Link href="/dashboard/forms">
                                <ArrowLeft className="size-4" />
                            </Link>
                        </Button>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {formInfo?.title || "表单"} - 提交管理
                        </h1>
                    </div>
                    <p className="text-muted-foreground ml-10">
                        共 {total} 条提交记录
                    </p>
                </div>
            </div>

            <Separator />

            {/* 提交列表 */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10" />
                            <TableHead>提交者</TableHead>
                            <TableHead>邮箱</TableHead>
                            <TableHead>IP 地址</TableHead>
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
                                        <ClipboardList className="size-12 text-muted-foreground mb-4" />
                                        <p className="text-muted-foreground">暂无提交记录</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            submissions.map((sub) => {
                                const isExpanded = expandedId === sub.id;

                                return (
                                    <Fragment key={sub.id}>
                                        <TableRow>
                                            {/* 展开按钮 */}
                                            <TableCell>
                                                <button
                                                    className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                                    onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                                                >
                                                    {isExpanded ? (
                                                        <ChevronDown className="size-4" />
                                                    ) : (
                                                        <ChevronRight className="size-4" />
                                                    )}
                                                </button>
                                            </TableCell>

                                            {/* 提交者 */}
                                            <TableCell className="font-medium">
                                                {sub.user_name || "匿名用户"}
                                            </TableCell>

                                            {/* 邮箱 */}
                                            <TableCell className="text-muted-foreground font-mono text-xs">
                                                {sub.user_email || "-"}
                                            </TableCell>

                                            {/* IP 地址 */}
                                            <TableCell className="text-muted-foreground font-mono text-xs">
                                                {sub.ip_address || "-"}
                                            </TableCell>

                                            {/* 填写用时 */}
                                            <TableCell className="text-muted-foreground text-xs">
                                                {sub.duration != null ? (
                                                    <Badge variant="outline" className="gap-1 font-normal">
                                                        <Timer className="size-3" />
                                                        {formatDuration(sub.duration)}
                                                    </Badge>
                                                ) : "-"}
                                            </TableCell>

                                            {/* 提交时间 */}
                                            <TableCell className="text-muted-foreground">
                                                {new Date(sub.created_at).toLocaleString("zh-CN")}
                                            </TableCell>
                                        </TableRow>

                                        {/* 展开详情 */}
                                        {isExpanded && (
                                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                <TableCell colSpan={6} className="p-0">
                                                    <div className="px-6 py-4 space-y-4">
                                                        {/* 表单内容 */}
                                                        <div>
                                                            <p className="text-xs font-medium text-muted-foreground mb-2">
                                                                提交内容
                                                            </p>
                                                            <div className="grid gap-2">
                                                                {formInfo?.fields.map((field) => (
                                                                    <div
                                                                        key={field.key}
                                                                        className="flex gap-3 bg-background rounded px-3 py-2 text-sm"
                                                                    >
                                                                        <span className="font-medium text-muted-foreground min-w-[120px] shrink-0">
                                                                            {field.label}：
                                                                        </span>
                                                                        <span className="text-foreground whitespace-pre-wrap break-all">
                                                                            {sub.data[field.key] !== undefined
                                                                                ? field.type === "checkbox"
                                                                                    ? sub.data[field.key] ? "是" : "否"
                                                                                    : String(sub.data[field.key])
                                                                                : "-"}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* 客户端元数据 */}
                                                        <div>
                                                            <p className="text-xs font-medium text-muted-foreground mb-2">
                                                                客户端信息
                                                            </p>
                                                            <div className="grid gap-2">
                                                                <div className="flex items-center gap-2 bg-background rounded px-3 py-2 text-sm">
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger>
                                                                                <Globe className="size-3.5 text-muted-foreground shrink-0" />
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>IP 地址</TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                    <span className="font-medium text-muted-foreground min-w-[80px] shrink-0">IP 地址：</span>
                                                                    <span className="font-mono text-xs">{sub.ip_address || "-"}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 bg-background rounded px-3 py-2 text-sm">
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger>
                                                                                <Fingerprint className="size-3.5 text-muted-foreground shrink-0" />
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>浏览器指纹</TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                    <span className="font-medium text-muted-foreground min-w-[80px] shrink-0">指纹：</span>
                                                                    <span className="font-mono text-xs">{sub.fingerprint || "-"}</span>
                                                                </div>
                                                                <div className="flex items-start gap-2 bg-background rounded px-3 py-2 text-sm">
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger>
                                                                                <Monitor className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>User-Agent</TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                    <span className="font-medium text-muted-foreground min-w-[80px] shrink-0">UA：</span>
                                                                    <span className="font-mono text-xs break-all">{sub.user_agent || "-"}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 bg-background rounded px-3 py-2 text-sm">
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger>
                                                                                <Timer className="size-3.5 text-muted-foreground shrink-0" />
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>填写用时</TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                    <span className="font-medium text-muted-foreground min-w-[80px] shrink-0">用时：</span>
                                                                    <span>{sub.duration != null ? formatDuration(sub.duration) : "-"}</span>
                                                                </div>
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

            {/* 分页 */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => setPage(page - 1)}
                    >
                        上一页
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        第 {page + 1} / {totalPages} 页
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage(page + 1)}
                    >
                        下一页
                    </Button>
                </div>
            )}
        </div>
    );
}
