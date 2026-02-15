"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    RiMoreLine, RiShieldLine, RiUserLine, RiForbidLine,
    RiCheckLine, RiDeleteBinLine, RiSearchLine, RiRefreshLine,
} from "react-icons/ri";

// ─── 类型 ────────────────────────────────────────────────────
interface User {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role?: string | null;
    banned?: boolean | null;
    banReason?: string | null;
    banExpires?: string | null;
    createdAt: string;
    emailVerified?: boolean;
}

// ─── 封禁时长选项 ───────────────────────────────────────────
const BAN_DURATIONS = [
    { label: "1 天", value: 86400 },
    { label: "7 天", value: 604800 },
    { label: "30 天", value: 2592000 },
    { label: "永久", value: 0 },
];

const PAGE_SIZE = 10;
const CACHE_TTL = 30_000; // 缓存有效期 30 秒

interface CacheEntry {
    users: User[];
    total: number;
    timestamp: number;
}

// ─── 主组件 ─────────────────────────────────────────────────
export default function UserManagePage() {
    const [users, setUsers] = useState<User[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [inputValue, setInputValue] = useState("");     // 输入框值（每次按键更新）
    const [committedQuery, setCommittedQuery] = useState(""); // 已提交的搜索词（仅提交时更新）
    const [loading, setLoading] = useState(true);

    // 缓存：key = "page:query"
    const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
    // 请求去重：记录正在进行的请求 key
    const inflightRef = useRef<Set<string>>(new Set());

    // 封禁弹窗
    const [banDialogOpen, setBanDialogOpen] = useState(false);
    const [banUserId, setBanUserId] = useState("");
    const [banUserName, setBanUserName] = useState("");
    const [banReason, setBanReason] = useState("");
    const [banDuration, setBanDuration] = useState(604800); // 默认 7 天

    // 删除弹窗
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteUserId, setDeleteUserId] = useState("");
    const [deleteUserName, setDeleteUserName] = useState("");

    // 操作加载状态
    const [actionLoading, setActionLoading] = useState(false);

    // ─── 缓存工具 ────────────────────────────────────────────
    const getCacheKey = useCallback((p: number, q: string) => `${p}:${q}`, []);

    const invalidateCache = useCallback(() => {
        cacheRef.current.clear();
    }, []);

    // ─── 获取用户列表 ────────────────────────────────────────
    const fetchUsers = useCallback(async (options?: { skipCache?: boolean }) => {
        const key = getCacheKey(page, committedQuery);

        // 检查缓存
        if (!options?.skipCache) {
            const cached = cacheRef.current.get(key);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                setUsers(cached.users);
                setTotal(cached.total);
                setLoading(false);
                return;
            }
        }

        // 去重：跳过同一 key 的重复请求（React StrictMode 会触发两次 effect）
        if (inflightRef.current.has(key) && !options?.skipCache) return;
        inflightRef.current.add(key);

        setLoading(true);
        try {
            const { data, error } = await authClient.admin.listUsers({
                query: {
                    limit: PAGE_SIZE,
                    offset: page * PAGE_SIZE,
                    ...(committedQuery ? { searchValue: committedQuery, searchField: "email" as const } : {}),
                    sortBy: "createdAt" as const,
                    sortDirection: "desc" as const,
                },
            });
            if (error) {
                console.error("获取用户列表失败:", error);
                return;
            }
            if (data) {
                const userList = (data.users as User[]) || [];
                const userTotal = data.total || 0;
                setUsers(userList);
                setTotal(userTotal);
                // 写入缓存
                cacheRef.current.set(key, {
                    users: userList,
                    total: userTotal,
                    timestamp: Date.now(),
                });
            }
        } catch (err) {
            console.error("获取用户列表失败:", err);
        } finally {
            inflightRef.current.delete(key);
            setLoading(false);
        }
    }, [page, committedQuery, getCacheKey]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // ─── 操作方法 ────────────────────────────────────────────
    const handleSetRole = async (userId: string, role: "admin" | "user") => {
        setActionLoading(true);
        try {
            await authClient.admin.setRole({ userId, role });
            invalidateCache();
            await fetchUsers({ skipCache: true });
        } catch (err) {
            console.error("设置角色失败:", err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleBan = async () => {
        setActionLoading(true);
        try {
            await authClient.admin.banUser({
                userId: banUserId,
                banReason: banReason || undefined,
                ...(banDuration > 0 ? { banExpiresIn: banDuration } : {}),
            });
            setBanDialogOpen(false);
            setBanReason("");
            invalidateCache();
            await fetchUsers({ skipCache: true });
        } catch (err) {
            console.error("封禁用户失败:", err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleUnban = async (userId: string) => {
        setActionLoading(true);
        try {
            await authClient.admin.unbanUser({ userId });
            invalidateCache();
            await fetchUsers({ skipCache: true });
        } catch (err) {
            console.error("解封用户失败:", err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        setActionLoading(true);
        try {
            await authClient.admin.removeUser({ userId: deleteUserId });
            setDeleteDialogOpen(false);
            invalidateCache();
            await fetchUsers({ skipCache: true });
        } catch (err) {
            console.error("删除用户失败:", err);
        } finally {
            setActionLoading(false);
        }
    };

    // ─── 辅助方法 ────────────────────────────────────────────
    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString("zh-CN", {
                year: "numeric", month: "2-digit", day: "2-digit",
            });
        } catch {
            return "—";
        }
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(0);
        setCommittedQuery(inputValue);
    };

    // ─── 渲染 ────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* 页头 */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
                <p className="text-muted-foreground mt-1">管理所有注册用户</p>
            </div>

            {/* 搜索栏 */}
            <form onSubmit={handleSearch} className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        placeholder="按邮箱搜索..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button type="submit" variant="secondary" size="sm">
                    搜索
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setInputValue(""); setCommittedQuery(""); setPage(0); }}
                >
                    <RiRefreshLine className="size-4" />
                </Button>
            </form>

            {/* 用户表格 */}
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>名称</TableHead>
                            <TableHead>邮箱</TableHead>
                            <TableHead>角色</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>注册时间</TableHead>
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
                        ) : users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    {committedQuery ? "未找到匹配的用户" : "暂无用户"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                        {user.name || "—"}
                                    </TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        {user.role === "admin" ? (
                                            <Badge variant="default">管理员</Badge>
                                        ) : (
                                            <Badge variant="secondary">用户</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {user.banned ? (
                                            <Badge variant="destructive">已封禁</Badge>
                                        ) : (
                                            <Badge variant="outline">正常</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8" disabled={actionLoading}>
                                                    <RiMoreLine className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {/* 角色管理 */}
                                                {user.role === "admin" ? (
                                                    <DropdownMenuItem onClick={() => handleSetRole(user.id, "user")}>
                                                        <RiUserLine className="size-4 mr-2" />
                                                        设为普通用户
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem onClick={() => handleSetRole(user.id, "admin")}>
                                                        <RiShieldLine className="size-4 mr-2" />
                                                        设为管理员
                                                    </DropdownMenuItem>
                                                )}

                                                <DropdownMenuSeparator />

                                                {/* 封禁/解封 */}
                                                {user.banned ? (
                                                    <DropdownMenuItem onClick={() => handleUnban(user.id)}>
                                                        <RiCheckLine className="size-4 mr-2" />
                                                        解封
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem onClick={() => {
                                                        setBanUserId(user.id);
                                                        setBanUserName(user.name || user.email);
                                                        setBanDialogOpen(true);
                                                    }}>
                                                        <RiForbidLine className="size-4 mr-2" />
                                                        封禁
                                                    </DropdownMenuItem>
                                                )}

                                                <DropdownMenuSeparator />

                                                {/* 删除 */}
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    onClick={() => {
                                                        setDeleteUserId(user.id);
                                                        setDeleteUserName(user.name || user.email);
                                                        setDeleteDialogOpen(true);
                                                    }}
                                                >
                                                    <RiDeleteBinLine className="size-4 mr-2" />
                                                    删除用户
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
                        共 {total} 位用户，第 {page + 1} / {totalPages} 页
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0 || loading}
                        >
                            上一页
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1 || loading}
                        >
                            下一页
                        </Button>
                    </div>
                </div>
            )}

            {/* 封禁弹窗 */}
            <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>封禁用户</DialogTitle>
                        <DialogDescription>
                            确定要封禁 <span className="font-semibold">{banUserName}</span> 吗？封禁后该用户将无法登录。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>封禁原因（可选）</Label>
                            <Input
                                placeholder="请输入封禁原因..."
                                value={banReason}
                                onChange={(e) => setBanReason(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>封禁时长</Label>
                            <div className="flex flex-wrap gap-2">
                                {BAN_DURATIONS.map((d) => (
                                    <Button
                                        key={d.value}
                                        type="button"
                                        variant={banDuration === d.value ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setBanDuration(d.value)}
                                    >
                                        {d.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setBanDialogOpen(false)}>
                            取消
                        </Button>
                        <Button variant="destructive" onClick={handleBan} disabled={actionLoading}>
                            {actionLoading ? "处理中..." : "确认封禁"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 删除确认弹窗 */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除用户 <span className="font-semibold">{deleteUserName}</span> 吗？此操作不可撤销，该用户的所有数据将被永久删除。
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
