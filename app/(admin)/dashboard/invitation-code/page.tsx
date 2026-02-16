"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
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
    Plus,
    Trash2,
    Copy,
    ChevronDown,
    ChevronRight,
    TicketCheck,
    Users,
    Clock,
    Mail,
} from "lucide-react";

/* ─── 类型定义 ─────────────────────────────────────────────── */

interface InvitationCodeUsage {
    id: string;
    codeId: string;
    userId: string;
    email: string;
    userName: string | null;
    usedAt: string;
}

interface InvitationCode {
    id: string;
    code: string;
    maxUses: number;
    uses: number;
    allowedEmails: string[] | null;
    createdAt: string;
    expiresAt: string | null;
    usages: InvitationCodeUsage[];
}

/* ─── 主组件 ─────────────────────────────────────────────── */

export default function InvitationCodePage() {
    const [codes, setCodes] = useState<InvitationCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchCodes = useCallback(async () => {
        try {
            const res = await fetch("/api/invitation-code");
            const data = await res.json();
            setCodes(data.codes || []);
        } catch {
            toast.error("获取邀请码列表失败");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCodes();
    }, [fetchCodes]);

    const handleDelete = async (id: string) => {
        if (!confirm("确认删除此邀请码？关联的使用记录也会被删除。")) return;
        try {
            await fetch(`/api/invitation-code?id=${id}`, { method: "DELETE" });
            toast.success("已删除");
            fetchCodes();
        } catch {
            toast.error("删除失败");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("已复制到剪贴板");
    };

    const isExpired = (expiresAt: string | null) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    const isUsedUp = (code: InvitationCode) => code.uses >= code.maxUses;

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">邀请码管理</h1>
                    <p className="text-muted-foreground mt-1">
                        创建和管理注册邀请码
                    </p>
                </div>
                <CreateCodeDialog onCreated={fetchCodes} />
            </div>

            <Separator />

            {/* 邀请码列表 */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
            ) : codes.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <TicketCheck className="size-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">暂无邀请码</p>
                        <p className="text-muted-foreground text-sm">
                            点击右上角按钮创建第一个邀请码
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {codes.map((code) => {
                        const expired = isExpired(code.expiresAt);
                        const usedUp = isUsedUp(code);
                        const isExpanded = expandedId === code.id;

                        return (
                            <Card
                                key={code.id}
                                className={
                                    expired || usedUp
                                        ? "opacity-60"
                                        : ""
                                }
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <CardTitle className="text-lg font-mono tracking-wider">
                                                {code.code}
                                            </CardTitle>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-7"
                                                            onClick={() => copyToClipboard(code.code)}
                                                        >
                                                            <Copy className="size-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>复制邀请码</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            {expired && (
                                                <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                                                    已过期
                                                </span>
                                            )}
                                            {usedUp && !expired && (
                                                <span className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                                                    已用完
                                                </span>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(code.id)}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                    <CardDescription className="flex flex-wrap gap-4 pt-1">
                                        <span className="flex items-center gap-1">
                                            <Users className="size-3.5" />
                                            使用 {code.uses}/{code.maxUses}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="size-3.5" />
                                            创建于 {new Date(code.createdAt).toLocaleDateString("zh-CN")}
                                        </span>
                                        {code.expiresAt && (
                                            <span className="flex items-center gap-1">
                                                <Clock className="size-3.5" />
                                                过期于 {new Date(code.expiresAt).toLocaleDateString("zh-CN")}
                                            </span>
                                        )}
                                        {code.allowedEmails && code.allowedEmails.length > 0 && (
                                            <span className="flex items-center gap-1">
                                                <Mail className="size-3.5" />
                                                限定 {code.allowedEmails.length} 个邮箱
                                            </span>
                                        )}
                                    </CardDescription>
                                </CardHeader>

                                {/* 邮箱白名单 */}
                                {code.allowedEmails && code.allowedEmails.length > 0 && (
                                    <CardContent className="pt-0 pb-3">
                                        <p className="text-xs text-muted-foreground mb-1">允许的邮箱：</p>
                                        <div className="flex flex-wrap gap-1">
                                            {code.allowedEmails.map((email) => (
                                                <span
                                                    key={email}
                                                    className="text-xs bg-muted px-2 py-0.5 rounded font-mono"
                                                >
                                                    {email}
                                                </span>
                                            ))}
                                        </div>
                                    </CardContent>
                                )}

                                {/* 使用记录折叠 */}
                                {code.usages.length > 0 && (
                                    <CardContent className="pt-0">
                                        <button
                                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                            onClick={() =>
                                                setExpandedId(isExpanded ? null : code.id)
                                            }
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="size-3.5" />
                                            ) : (
                                                <ChevronRight className="size-3.5" />
                                            )}
                                            使用记录 ({code.usages.length})
                                        </button>
                                        {isExpanded && (
                                            <div className="mt-2 space-y-1">
                                                {code.usages.map((usage) => (
                                                    <div
                                                        key={usage.id}
                                                        className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2"
                                                    >
                                                        <span className="font-medium text-foreground">
                                                            {usage.userName || "未知用户"}
                                                        </span>
                                                        <span className="font-mono">{usage.email}</span>
                                                        <span className="ml-auto">
                                                            {new Date(usage.usedAt).toLocaleString("zh-CN")}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ─── 创建邀请码对话框 ───────────────────────────────────── */

function CreateCodeDialog({ onCreated }: { onCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [customCode, setCustomCode] = useState("");
    const [maxUses, setMaxUses] = useState("1");
    const [expiresAt, setExpiresAt] = useState("");
    const [allowedEmailsText, setAllowedEmailsText] = useState("");
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        setCreating(true);
        try {
            const allowedEmails = allowedEmailsText
                .split(/[,，\n]/)
                .map((e) => e.trim())
                .filter(Boolean);

            const res = await fetch("/api/invitation-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: customCode || undefined,
                    maxUses: parseInt(maxUses) || 1,
                    expiresAt: expiresAt || null,
                    allowedEmails: allowedEmails.length > 0 ? allowedEmails : null,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "创建失败");
                return;
            }

            toast.success("邀请码已创建");
            setOpen(false);
            setCustomCode("");
            setMaxUses("1");
            setExpiresAt("");
            setAllowedEmailsText("");
            onCreated();
        } catch {
            toast.error("创建失败");
        } finally {
            setCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="size-4 mr-1.5" />
                    创建邀请码
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>创建邀请码</DialogTitle>
                    <DialogDescription>
                        留空邀请码将自动随机生成 8 位码
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="customCode">邀请码（可选）</Label>
                        <Input
                            id="customCode"
                            placeholder="留空自动生成"
                            value={customCode}
                            onChange={(e) => setCustomCode(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="maxUses">最大使用次数</Label>
                        <Input
                            id="maxUses"
                            type="number"
                            min="1"
                            value={maxUses}
                            onChange={(e) => setMaxUses(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="expiresAt">过期时间（可选）</Label>
                        <Input
                            id="expiresAt"
                            type="datetime-local"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="allowedEmails">
                            限定邮箱（可选，每行一个或用逗号分隔）
                        </Label>
                        <textarea
                            id="allowedEmails"
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            placeholder="user1@example.com&#10;user2@example.com"
                            value={allowedEmailsText}
                            onChange={(e) => setAllowedEmailsText(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            留空则不限制邮箱，填写后仅允许指定邮箱使用该邀请码注册
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">取消</Button>
                    </DialogClose>
                    <Button onClick={handleCreate} disabled={creating}>
                        {creating ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            "创建"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
