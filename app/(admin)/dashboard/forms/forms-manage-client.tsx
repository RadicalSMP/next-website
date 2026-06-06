"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ClipboardList, Copy, Eye, FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type FormItem = {
    id: string;
    title: string;
    description: string | null;
    slug: string;
    visibility: string;
    status: "draft" | "published" | "archived";
    created_by_name: string | null;
    created_at: string;
    updated_at: string;
    submission_count: number;
    current_version: number | null;
    last_submitted_at: string | null;
};

type FormsManageClientProps = {
    initialForms: FormItem[];
};

type DeleteTarget = Pick<FormItem, "id" | "title" | "submission_count">;

function visibilityLabel(value: string) {
    switch (value) {
        case "public":
            return "公开";
        case "authenticated":
            return "登录可见";
        case "members":
            return "指定成员";
        default:
            return value;
    }
}

function statusBadge(status: FormItem["status"]) {
    switch (status) {
        case "published":
            return <Badge>已发布</Badge>;
        case "archived":
            return <Badge variant="secondary">已归档</Badge>;
        default:
            return <Badge variant="outline">草稿</Badge>;
    }
}

export function FormsManageClient({ initialForms }: FormsManageClientProps) {
    const [forms, setForms] = useState<FormItem[]>(initialForms);
    const [refreshing, setRefreshing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

    const refreshForms = async () => {
        setRefreshing(true);
        try {
            const res = await fetch("/api/forms", { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "获取表单列表失败");
                return;
            }
            setForms(data.forms || []);
        } catch {
            toast.error("获取表单列表失败");
        } finally {
            setRefreshing(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;

        setDeleting(true);
        try {
            const res = await fetch(`/api/forms/${deleteTarget.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "删除失败");
                return;
            }

            setForms((prev) => prev.filter((form) => form.id !== deleteTarget.id));
            setDeleteTarget(null);
            toast.success("已删除表单");
        } catch {
            toast.error("删除失败");
        } finally {
            setDeleting(false);
        }
    };

    const copyFormUrl = async (slug: string) => {
        await navigator.clipboard.writeText(`${window.location.origin}/forms/${slug}`);
        toast.success("表单链接已复制");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">表单管理</h1>
                    <p className="mt-1 text-muted-foreground">创建、编辑和发布表单</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={refreshForms} disabled={refreshing}>
                        {refreshing && <Loader2 className="size-4 animate-spin" />}
                        刷新
                    </Button>
                    <Button asChild>
                        <Link href="/dashboard/forms/new" target="_blank" rel="noreferrer">
                            <Plus className="size-4" />
                            创建表单
                        </Link>
                    </Button>
                </div>
            </div>

            <Separator />

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>表单</TableHead>
                            <TableHead>slug</TableHead>
                            <TableHead>可见性</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>版本</TableHead>
                            <TableHead>提交数</TableHead>
                            <TableHead>操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {forms.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-12">
                                    <div className="flex flex-col items-center justify-center text-center">
                                        <FileText className="mb-4 size-12 text-muted-foreground" />
                                        <p className="text-muted-foreground">暂无表单</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            forms.map((form) => (
                                <TableRow key={form.id}>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">{form.title || "未命名表单"}</p>
                                            {form.description && (
                                                <p className="line-clamp-1 text-xs text-muted-foreground">{form.description}</p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{form.slug}</code>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-6"
                                                            onClick={() => copyFormUrl(form.slug)}
                                                            aria-label={`复制表单 ${form.title || "未命名表单"} 的公开链接`}
                                                        >
                                                            <Copy className="size-3" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>复制公开链接</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{visibilityLabel(form.visibility)}</Badge>
                                    </TableCell>
                                    <TableCell>{statusBadge(form.status)}</TableCell>
                                    <TableCell>{form.current_version ? `v${form.current_version}` : "-"}</TableCell>
                                    <TableCell>{form.submission_count}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="size-8" asChild>
                                                            <Link href={`/dashboard/forms/${form.id}/submissions`} aria-label={`查看表单 ${form.title || "未命名表单"} 的提交`}>
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
                                                            <Link href={`/dashboard/forms/${form.id}/view`} target="_blank" aria-label={`预览表单 ${form.title || "未命名表单"}`}>
                                                                <Eye className="size-4" />
                                                            </Link>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>预览草稿</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="size-8" asChild>
                                                            <Link href={`/dashboard/forms/${form.id}/edit`} target="_blank" rel="noreferrer" aria-label={`编辑表单 ${form.title || "未命名表单"}`}>
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
                                                            onClick={() => setDeleteTarget({
                                                                id: form.id,
                                                                title: form.title || "未命名表单",
                                                                submission_count: form.submission_count,
                                                            })}
                                                            aria-label={`删除表单 ${form.title || "未命名表单"}`}
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

            <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
                if (!open && !deleting) setDeleteTarget(null);
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogMedia className="text-destructive">
                            <AlertTriangle className="size-7" />
                        </AlertDialogMedia>
                        <AlertDialogTitle>删除表单</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除表单 <span className="font-semibold text-foreground">「{deleteTarget?.title}」</span> 吗？
                            {deleteTarget && deleteTarget.submission_count > 0 ? ` 关联的 ${deleteTarget.submission_count} 条提交记录也会被删除。` : " 关联的提交记录也会被删除。"}
                            此操作不可撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                            {deleting && <Loader2 className="size-4 animate-spin" />}
                            删除
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
