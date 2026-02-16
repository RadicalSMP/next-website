"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    RiMoreLine, RiAddLine, RiEditLine, RiDeleteBinLine,
    RiEyeLine, RiDraftLine, RiCheckLine,
} from "react-icons/ri";

interface Post {
    id: string;
    title: string;
    slug: string;
    status: string;
    author_name: string | null;
    published_at: string | null;
    created_at: string;
    updated_at: string;
}

const PAGE_SIZE = 10;

export default function BlogManagePage() {
    const router = useRouter();
    const [posts, setPosts] = useState<Post[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // 删除弹窗
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletePostId, setDeletePostId] = useState("");
    const [deletePostTitle, setDeletePostTitle] = useState("");

    // 请求去重
    const inflightRef = useRef<Set<string>>(new Set());

    const fetchPosts = useCallback(async () => {
        const key = `${page}:${statusFilter}`;
        if (inflightRef.current.has(key)) return;
        inflightRef.current.add(key);

        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: PAGE_SIZE.toString(),
            });
            if (statusFilter) params.set("status", statusFilter);

            const res = await fetch(`/api/blog?${params}`);
            const data = await res.json();
            setPosts(data.posts || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error("获取文章列表失败:", err);
        } finally {
            inflightRef.current.delete(key);
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    const handleToggleStatus = async (postId: string, currentStatus: string) => {
        setActionLoading(true);
        try {
            const newStatus = currentStatus === "published" ? "draft" : "published";
            await fetch(`/api/blog/${postId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            await fetchPosts();
        } catch (err) {
            console.error("更新状态失败:", err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        setActionLoading(true);
        try {
            await fetch(`/api/blog/${deletePostId}`, { method: "DELETE" });
            setDeleteDialogOpen(false);
            await fetchPosts();
        } catch (err) {
            console.error("删除文章失败:", err);
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "—";
        try {
            return new Date(dateStr).toLocaleDateString("zh-CN", {
                year: "numeric", month: "2-digit", day: "2-digit",
            });
        } catch {
            return "—";
        }
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className="space-y-6">
            {/* 页头 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">文章管理</h1>
                    <p className="text-muted-foreground mt-1">管理博客文章</p>
                </div>
                <Button onClick={() => router.push("/dashboard/blog/new")}>
                    <RiAddLine className="size-4 mr-2" />
                    新建文章
                </Button>
            </div>

            {/* 筛选 */}
            <div className="flex items-center gap-2">
                <Button
                    variant={statusFilter === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setStatusFilter(null); setPage(0); }}
                >
                    全部
                </Button>
                <Button
                    variant={statusFilter === "published" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setStatusFilter("published"); setPage(0); }}
                >
                    已发布
                </Button>
                <Button
                    variant={statusFilter === "draft" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setStatusFilter("draft"); setPage(0); }}
                >
                    草稿
                </Button>
            </div>

            {/* 文章表格 */}
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>标题</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>作者</TableHead>
                            <TableHead>发布时间</TableHead>
                            <TableHead>更新时间</TableHead>
                            <TableHead className="w-[60px]">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    加载中...
                                </TableCell>
                            </TableRow>
                        ) : posts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    暂无文章
                                </TableCell>
                            </TableRow>
                        ) : (
                            posts.map((post) => (
                                <TableRow key={post.id}>
                                    <TableCell className="font-medium max-w-[300px] truncate">
                                        {post.title}
                                    </TableCell>
                                    <TableCell>
                                        {post.status === "published" ? (
                                            <Badge variant="default">已发布</Badge>
                                        ) : (
                                            <Badge variant="secondary">草稿</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>{post.author_name || "—"}</TableCell>
                                    <TableCell>{formatDate(post.published_at)}</TableCell>
                                    <TableCell>{formatDate(post.updated_at)}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8" disabled={actionLoading}>
                                                    <RiMoreLine className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/blog/${post.id}/edit`)}>
                                                    <RiEditLine className="size-4 mr-2" />
                                                    编辑
                                                </DropdownMenuItem>
                                                {post.status === "published" && (
                                                    <DropdownMenuItem onClick={() => window.open(`/blogs/${post.slug}`, "_blank")}>
                                                        <RiEyeLine className="size-4 mr-2" />
                                                        查看
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleToggleStatus(post.id, post.status)}>
                                                    {post.status === "published" ? (
                                                        <><RiDraftLine className="size-4 mr-2" />转为草稿</>
                                                    ) : (
                                                        <><RiCheckLine className="size-4 mr-2" />发布</>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    onClick={() => {
                                                        setDeletePostId(post.id);
                                                        setDeletePostTitle(post.title);
                                                        setDeleteDialogOpen(true);
                                                    }}
                                                >
                                                    <RiDeleteBinLine className="size-4 mr-2" />
                                                    删除
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        共 {total} 篇文章，第 {page + 1} / {totalPages} 页
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline" size="sm"
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0 || loading}
                        >
                            上一页
                        </Button>
                        <Button
                            variant="outline" size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1 || loading}
                        >
                            下一页
                        </Button>
                    </div>
                </div>
            )}

            {/* 删除确认弹窗 */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除文章《<span className="font-semibold">{deletePostTitle}</span>》吗？此操作不可撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={actionLoading}
                        >
                            {actionLoading ? "处理中..." : "确认删除"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
