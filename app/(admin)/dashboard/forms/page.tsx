"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
    Loader2,
    Plus,
    Trash2,
    Pencil,
    Eye,
    FileText,
    Copy,
    ClipboardList,
} from "lucide-react";
import Link from "next/link";

/* ─── 类型定义 ─────────────────────────────────────────────── */

interface FormItem {
    id: string;
    title: string;
    description: string | null;
    slug: string;
    fields: unknown[];
    visibility: string;
    status: string;
    created_by_name: string | null;
    created_at: string;
    updated_at: string;
    submission_count: number;
}

/* ─── 主组件 ─────────────────────────────────────────────── */

export default function FormsManagePage() {
    const [forms, setForms] = useState<FormItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchForms = useCallback(async () => {
        try {
            const res = await fetch("/api/forms");
            const data = await res.json();
            setForms(data.forms || []);
        } catch {
            toast.error("获取表单列表失败");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchForms();
    }, [fetchForms]);

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`确认删除表单「${title}」？关联的所有提交记录也会被删除。`)) return;
        try {
            const res = await fetch(`/api/forms/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "删除失败");
                return;
            }
            toast.success("已删除");
            fetchForms();
        } catch {
            toast.error("删除失败");
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === "active" ? "closed" : "active";
        try {
            const res = await fetch(`/api/forms/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "操作失败");
                return;
            }
            toast.success(newStatus === "active" ? "已开启" : "已关闭");
            fetchForms();
        } catch {
            toast.error("操作失败");
        }
    };

    const copyFormUrl = (slug: string) => {
        const url = `${window.location.origin}/forms/${slug}`;
        navigator.clipboard.writeText(url);
        toast.success("表单链接已复制");
    };

    const visibilityLabel = (v: string) => {
        switch (v) {
            case "public": return "公开";
            case "authenticated": return "登录可见";
            case "members": return "指定成员";
            default: return v;
        }
    };

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">表单管理</h1>
                    <p className="text-muted-foreground mt-1">
                        创建和管理自定义表单
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/forms/new">
                        <Plus className="size-4 mr-1.5" />
                        创建表单
                    </Link>
                </Button>
            </div>

            <Separator />

            {/* 表单列表 */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>表单名称</TableHead>
                            <TableHead>slug</TableHead>
                            <TableHead>可见性</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>提交数</TableHead>
                            <TableHead>创建时间</TableHead>
                            <TableHead className="w-[180px]">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-8">
                                    <div className="flex justify-center">
                                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : forms.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-12">
                                    <div className="flex flex-col items-center justify-center text-center">
                                        <FileText className="size-12 text-muted-foreground mb-4" />
                                        <p className="text-muted-foreground">暂无表单</p>
                                        <p className="text-muted-foreground text-sm">
                                            点击右上角按钮创建第一个表单
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            forms.map((form) => (
                                <TableRow key={form.id}>
                                    {/* 名称 */}
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">{form.title}</p>
                                            {form.description && (
                                                <p className="text-xs text-muted-foreground line-clamp-1">
                                                    {form.description}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>

                                    {/* slug */}
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                                {form.slug}
                                            </code>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-6"
                                                            onClick={() => copyFormUrl(form.slug)}
                                                        >
                                                            <Copy className="size-3" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>复制表单链接</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </TableCell>

                                    {/* 可见性 */}
                                    <TableCell>
                                        <Badge variant="outline">
                                            {visibilityLabel(form.visibility)}
                                        </Badge>
                                    </TableCell>

                                    {/* 状态 */}
                                    <TableCell>
                                        <Badge
                                            variant={form.status === "active" ? "default" : "secondary"}
                                            className="cursor-pointer"
                                            onClick={() => handleToggleStatus(form.id, form.status)}
                                        >
                                            {form.status === "active" ? "活跃" : "已关闭"}
                                        </Badge>
                                    </TableCell>

                                    {/* 提交数 */}
                                    <TableCell>{form.submission_count}</TableCell>

                                    {/* 创建时间 */}
                                    <TableCell className="text-muted-foreground">
                                        {new Date(form.created_at).toLocaleDateString("zh-CN")}
                                    </TableCell>

                                    {/* 操作 */}
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="size-8" asChild>
                                                            <Link href={`/dashboard/forms/${form.id}/submissions`}>
                                                                <ClipboardList className="size-4" />
                                                            </Link>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>查看提交</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="size-8" asChild>
                                                            <Link href={`/forms/${form.slug}`} target="_blank">
                                                                <Eye className="size-4" />
                                                            </Link>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>预览表单</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="size-8" asChild>
                                                            <Link href={`/dashboard/forms/${form.id}/edit`}>
                                                                <Pencil className="size-4" />
                                                            </Link>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>编辑表单</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8 text-destructive hover:text-destructive"
                                                            onClick={() => handleDelete(form.id, form.title)}
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>删除表单</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
