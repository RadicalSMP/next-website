"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    Save,
    Settings2,
    Sparkles,
    CheckCircle2,
    XCircle,
    Clock,
    Trash2,
    Plus,
} from "lucide-react";
import Link from "next/link";

/* ─── 类型定义 ─────────────────────────────────────────────── */

interface FormField {
    key: string;
    label: string;
    type: string;
    options?: string[];
}

interface ObjectiveRule {
    field_key: string;
    correct_answer: string | boolean;
    score: number;
}

interface ScoringRules {
    id?: string;
    duration_threshold: number;
    duration_score: number;
    ua_score: number;
    ai_prompt: string;
    ai_max_score: number;
    objective_rules: ObjectiveRule[];
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
    // 评分
    duration_score: number | null;
    ua_score: number | null;
    objective_score: number | null;
    objective_detail: Record<string, { got: number; max: number }> | null;
    ai_score: number | null;
    ai_detail: { score?: number; comment?: string; details?: Record<string, { score: number; comment: string }> } | null;
    ai_scored_at: string | null;
    total_score: number | null;
    max_possible_score: number | null;
    // 审核
    review_status: "approved" | "rejected" | null;
    review_note: string | null;
    review_at: string | null;
    reviewer_name: string | null;
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

function getStatusBadge(status: string | null) {
    switch (status) {
        case "approved":
            return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1"><CheckCircle2 className="size-3" />已通过</Badge>;
        case "rejected":
            return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 gap-1"><XCircle className="size-3" />已拒绝</Badge>;
        default:
            return <Badge variant="outline" className="gap-1"><Clock className="size-3" />待审核</Badge>;
    }
}

/* ─── 主组件 ─────────────────────────────────────────────── */

export default function ReviewFormsPage() {
    // 评分配置状态
    const [showConfig, setShowConfig] = useState(false);
    const [configLoading, setConfigLoading] = useState(true);
    const [configSaving, setConfigSaving] = useState(false);
    const [formFields, setFormFields] = useState<FormField[]>([]);
    const [rules, setRules] = useState<ScoringRules>({
        duration_threshold: 60,
        duration_score: 10,
        ua_score: 10,
        ai_prompt: "",
        ai_max_score: 50,
        objective_rules: [],
    });

    // 提交列表状态
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const limit = 20;

    // 审核对话框状态
    const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
    const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
    const [reviewNote, setReviewNote] = useState("");
    const [reviewTargetId, setReviewTargetId] = useState<string | null>(null);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);

    // AI 评分中的提交 ID
    const [aiScoringIds, setAiScoringIds] = useState<Set<string>>(new Set());

    // ─── 加载评分配置 ─────────────────────────────────────
    const fetchConfig = useCallback(async () => {
        try {
            const res = await fetch("/api/forms/review/config");
            if (res.ok) {
                const data = await res.json();
                if (data.rules) {
                    setRules({
                        ...data.rules,
                        objective_rules: data.rules.objective_rules || [],
                    });
                }
                if (data.formFields) {
                    setFormFields(data.formFields);
                }
            }
        } catch {
            // 忽略
        } finally {
            setConfigLoading(false);
        }
    }, []);

    // ─── 加载提交列表 ─────────────────────────────────────
    const fetchSubmissions = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(limit),
            });
            if (statusFilter !== "all") {
                params.set("status", statusFilter);
            }
            const res = await fetch(`/api/forms/review/submissions?${params}`);
            const data = await res.json();
            setSubmissions(data.submissions || []);
            setTotal(data.total || 0);
        } catch {
            toast.error("获取提交列表失败");
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    useEffect(() => {
        setLoading(true);
        fetchSubmissions();
    }, [fetchSubmissions]);

    const totalPages = Math.ceil(total / limit);

    // ─── 保存评分配置 ─────────────────────────────────────
    const handleSaveConfig = async () => {
        setConfigSaving(true);
        try {
            const res = await fetch("/api/forms/review/config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(rules),
            });
            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "保存失败");
                return;
            }
            toast.success("评分规则已保存");
        } catch {
            toast.error("保存失败");
        } finally {
            setConfigSaving(false);
        }
    };

    // ─── 触发 AI 评分 ────────────────────────────────────
    const handleAiScore = async (submissionId: string) => {
        setAiScoringIds((prev) => new Set(prev).add(submissionId));
        try {
            const res = await fetch("/api/forms/review/score-ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submission_id: submissionId }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "AI 评分失败");
                return;
            }
            toast.success(`AI 评分完成: ${data.ai_score} 分`);
            fetchSubmissions();
        } catch {
            toast.error("AI 评分请求失败");
        } finally {
            setAiScoringIds((prev) => {
                const next = new Set(prev);
                next.delete(submissionId);
                return next;
            });
        }
    };

    // ─── 打开审核对话框 ──────────────────────────────────
    const openReviewDialog = (submissionId: string, action: "approved" | "rejected") => {
        setReviewTargetId(submissionId);
        setReviewAction(action);
        setReviewNote("");
        setReviewDialogOpen(true);
    };

    // ─── 提交审核 ────────────────────────────────────────
    const handleReviewSubmit = async () => {
        if (!reviewTargetId) return;
        setReviewSubmitting(true);
        try {
            const res = await fetch("/api/forms/review/decide", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    submission_id: reviewTargetId,
                    status: reviewAction,
                    note: reviewNote.trim() || undefined,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "审核失败");
                return;
            }
            toast.success(reviewAction === "approved" ? "已通过并发送通知邮件" : "已拒绝并发送通知邮件");
            setReviewDialogOpen(false);
            fetchSubmissions();
        } catch {
            toast.error("审核请求失败");
        } finally {
            setReviewSubmitting(false);
        }
    };

    // ─── 客观题规则操作 ──────────────────────────────────
    const addObjectiveRule = () => {
        setRules((prev) => ({
            ...prev,
            objective_rules: [
                ...prev.objective_rules,
                { field_key: "", correct_answer: "", score: 5 },
            ],
        }));
    };

    const updateObjectiveRule = (index: number, updates: Partial<ObjectiveRule>) => {
        setRules((prev) => {
            const newRules = [...prev.objective_rules];
            newRules[index] = { ...newRules[index], ...updates };
            return { ...prev, objective_rules: newRules };
        });
    };

    const removeObjectiveRule = (index: number) => {
        setRules((prev) => ({
            ...prev,
            objective_rules: prev.objective_rules.filter((_, i) => i !== index),
        }));
    };

    // 可用于客观题的字段（select 和 checkbox）
    const objectiveFields = formFields.filter(
        (f) => f.type === "select" || f.type === "checkbox",
    );

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
                        <h1 className="text-3xl font-bold tracking-tight">入服申请审核</h1>
                    </div>
                    <p className="text-muted-foreground ml-10">
                        审核入服申请表单（join-application），共 {total} 条提交
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => setShowConfig(!showConfig)}
                    className="gap-1.5"
                >
                    <Settings2 className="size-4" />
                    {showConfig ? "收起配置" : "评分配置"}
                </Button>
            </div>

            <Separator />

            {/* ─── 评分配置面板 ───────────────────────────── */}
            {showConfig && (
                <Card>
                    <CardHeader>
                        <CardTitle>评分规则配置</CardTitle>
                        <CardDescription>
                            配置入服申请的自动评分规则。修改后点击保存生效。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {configLoading ? (
                            <div className="flex justify-center py-6">
                                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <>
                                {/* 基础分设置 */}
                                <div>
                                    <h4 className="font-medium text-sm mb-3">基础分设置</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs">作答时间阈值（秒）</Label>
                                            <Input
                                                type="number"
                                                value={rules.duration_threshold}
                                                onChange={(e) =>
                                                    setRules((prev) => ({
                                                        ...prev,
                                                        duration_threshold: parseInt(e.target.value) || 0,
                                                    }))
                                                }
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                作答时间 &ge; 此值时获得时间分
                                            </p>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs">时间分值</Label>
                                            <Input
                                                type="number"
                                                value={rules.duration_score}
                                                onChange={(e) =>
                                                    setRules((prev) => ({
                                                        ...prev,
                                                        duration_score: parseInt(e.target.value) || 0,
                                                    }))
                                                }
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs">UA 正常分值</Label>
                                            <Input
                                                type="number"
                                                value={rules.ua_score}
                                                onChange={(e) =>
                                                    setRules((prev) => ({
                                                        ...prev,
                                                        ua_score: parseInt(e.target.value) || 0,
                                                    }))
                                                }
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                User-Agent 为正常浏览器时得分
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* 客观题评分规则 */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-medium text-sm">客观题评分规则</h4>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={addObjectiveRule}
                                            disabled={objectiveFields.length === 0}
                                        >
                                            <Plus className="size-3.5 mr-1" />
                                            添加规则
                                        </Button>
                                    </div>
                                    {objectiveFields.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-3">
                                            当前表单没有 select 或 checkbox 类型的字段，无法配置客观题规则。
                                        </p>
                                    ) : rules.objective_rules.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-3">
                                            暂无客观题规则，点击上方按钮添加。
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            {rules.objective_rules.map((rule, index) => (
                                                <div key={index} className="flex items-end gap-3 bg-muted/30 rounded-lg p-3">
                                                    <div className="grid gap-1.5 flex-1">
                                                        <Label className="text-xs">字段</Label>
                                                        <Select
                                                            value={rule.field_key}
                                                            onValueChange={(v) => updateObjectiveRule(index, { field_key: v })}
                                                        >
                                                            <SelectTrigger><SelectValue placeholder="选择字段" /></SelectTrigger>
                                                            <SelectContent>
                                                                {objectiveFields.map((f) => (
                                                                    <SelectItem key={f.key} value={f.key}>
                                                                        {f.label}（{f.type}）
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="grid gap-1.5 flex-1">
                                                        <Label className="text-xs">正确答案</Label>
                                                        {formFields.find((f) => f.key === rule.field_key)?.type === "checkbox" ? (
                                                            <Select
                                                                value={String(rule.correct_answer)}
                                                                onValueChange={(v) =>
                                                                    updateObjectiveRule(index, { correct_answer: v === "true" })
                                                                }
                                                            >
                                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="true">是（勾选）</SelectItem>
                                                                    <SelectItem value="false">否（未勾选）</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <Select
                                                                value={String(rule.correct_answer)}
                                                                onValueChange={(v) => updateObjectiveRule(index, { correct_answer: v })}
                                                            >
                                                                <SelectTrigger><SelectValue placeholder="选择答案" /></SelectTrigger>
                                                                <SelectContent>
                                                                    {(formFields.find((f) => f.key === rule.field_key)?.options || []).map((opt) => (
                                                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    </div>
                                                    <div className="grid gap-1.5 w-24">
                                                        <Label className="text-xs">分值</Label>
                                                        <Input
                                                            type="number"
                                                            value={rule.score}
                                                            onChange={(e) =>
                                                                updateObjectiveRule(index, { score: parseInt(e.target.value) || 0 })
                                                            }
                                                        />
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-9 text-destructive hover:text-destructive shrink-0"
                                                        onClick={() => removeObjectiveRule(index)}
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <Separator />

                                {/* AI 评分设置 */}
                                <div>
                                    <h4 className="font-medium text-sm mb-3">AI 主观题评分</h4>
                                    <div className="space-y-3">
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs">AI 评分满分值</Label>
                                            <Input
                                                type="number"
                                                className="w-32"
                                                value={rules.ai_max_score}
                                                onChange={(e) =>
                                                    setRules((prev) => ({
                                                        ...prev,
                                                        ai_max_score: parseInt(e.target.value) || 0,
                                                    }))
                                                }
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs">AI 系统提示词</Label>
                                            <Textarea
                                                rows={4}
                                                placeholder="描述 AI 如何评分…"
                                                value={rules.ai_prompt || ""}
                                                onChange={(e) =>
                                                    setRules((prev) => ({
                                                        ...prev,
                                                        ai_prompt: e.target.value,
                                                    }))
                                                }
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                可使用 {"{max_score}"} 占位符表示满分值。AI 连接配置请前往
                                                <Link href="/dashboard/settings" className="text-primary ml-1 hover:underline">系统设置</Link>
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* 保存按钮 */}
                                <div className="flex justify-end pt-2">
                                    <Button onClick={handleSaveConfig} disabled={configSaving}>
                                        {configSaving ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Save className="size-4 mr-1.5" />
                                                保存规则
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ─── 状态筛选 ──────────────────────────────── */}
            <div className="flex gap-2">
                {[
                    { value: "all", label: "全部" },
                    { value: "pending", label: "待审核" },
                    { value: "approved", label: "已通过" },
                    { value: "rejected", label: "已拒绝" },
                ].map((tab) => (
                    <Button
                        key={tab.value}
                        variant={statusFilter === tab.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                            setStatusFilter(tab.value);
                            setPage(0);
                        }}
                    >
                        {tab.label}
                    </Button>
                ))}
            </div>

            {/* ─── 提交列表 ──────────────────────────────── */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10" />
                            <TableHead>提交者</TableHead>
                            <TableHead>提交时间</TableHead>
                            <TableHead className="text-center">基础分</TableHead>
                            <TableHead className="text-center">客观分</TableHead>
                            <TableHead className="text-center">AI 分</TableHead>
                            <TableHead className="text-center">总分</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={9} className="py-8">
                                    <div className="flex justify-center">
                                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : submissions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="py-12">
                                    <div className="flex flex-col items-center justify-center text-center">
                                        <ClipboardList className="size-12 text-muted-foreground mb-4" />
                                        <p className="text-muted-foreground">暂无提交记录</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            submissions.map((sub) => {
                                const isExpanded = expandedId === sub.id;
                                const baseScore = (sub.duration_score ?? 0) + (sub.ua_score ?? 0);

                                return (
                                    <Fragment key={sub.id}>
                                        <TableRow className={sub.review_status === "approved" ? "bg-green-500/5" : sub.review_status === "rejected" ? "bg-red-500/5" : ""}>
                                            {/* 展开按钮 */}
                                            <TableCell>
                                                <button
                                                    className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                                    onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                                                >
                                                    {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                                </button>
                                            </TableCell>

                                            {/* 提交者 */}
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{sub.user_name || "匿名用户"}</p>
                                                    <p className="text-xs text-muted-foreground">{sub.user_email || "-"}</p>
                                                </div>
                                            </TableCell>

                                            {/* 提交时间 */}
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(sub.created_at).toLocaleString("zh-CN")}
                                            </TableCell>

                                            {/* 基础分 */}
                                            <TableCell className="text-center">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <span className="font-mono text-sm">{baseScore}</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>时间分: {sub.duration_score ?? 0}</p>
                                                            <p>UA 分: {sub.ua_score ?? 0}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>

                                            {/* 客观分 */}
                                            <TableCell className="text-center font-mono text-sm">
                                                {sub.objective_score ?? 0}
                                            </TableCell>

                                            {/* AI 分 */}
                                            <TableCell className="text-center">
                                                {sub.ai_score !== null ? (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger>
                                                                <span className="font-mono text-sm">{sub.ai_score}</span>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-xs">
                                                                <p>{sub.ai_detail?.comment || "无评语"}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">未评</span>
                                                )}
                                            </TableCell>

                                            {/* 总分 */}
                                            <TableCell className="text-center">
                                                <span className="font-mono font-semibold">
                                                    {sub.total_score ?? 0}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    /{sub.max_possible_score ?? "?"}
                                                </span>
                                            </TableCell>

                                            {/* 状态 */}
                                            <TableCell>
                                                {getStatusBadge(sub.review_status)}
                                            </TableCell>

                                            {/* 操作 */}
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-1 text-xs h-7"
                                                        onClick={() => handleAiScore(sub.id)}
                                                        disabled={aiScoringIds.has(sub.id)}
                                                    >
                                                        {aiScoringIds.has(sub.id) ? (
                                                            <Loader2 className="size-3 animate-spin" />
                                                        ) : (
                                                            <Sparkles className="size-3" />
                                                        )}
                                                        {sub.ai_score !== null ? "重评" : "AI"}
                                                    </Button>
                                                    {sub.review_status !== "approved" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="gap-1 text-xs h-7 text-green-600 hover:text-green-700"
                                                            onClick={() => openReviewDialog(sub.id, "approved")}
                                                        >
                                                            <CheckCircle2 className="size-3" />
                                                            通过
                                                        </Button>
                                                    )}
                                                    {sub.review_status !== "rejected" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="gap-1 text-xs h-7 text-red-600 hover:text-red-700"
                                                            onClick={() => openReviewDialog(sub.id, "rejected")}
                                                        >
                                                            <XCircle className="size-3" />
                                                            拒绝
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>

                                        {/* ─── 展开详情 ──── */}
                                        {isExpanded && (
                                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                <TableCell colSpan={9} className="p-0">
                                                    <div className="px-6 py-4 space-y-4">
                                                        {/* 表单内容 */}
                                                        <div>
                                                            <p className="text-xs font-medium text-muted-foreground mb-2">提交内容</p>
                                                            <div className="grid gap-2">
                                                                {formFields.map((field) => (
                                                                    <div key={field.key} className="flex gap-3 bg-background rounded px-3 py-2 text-sm">
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
                                                            <p className="text-xs font-medium text-muted-foreground mb-2">客户端信息</p>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="flex items-center gap-2 bg-background rounded px-3 py-2 text-sm">
                                                                    <Globe className="size-3.5 text-muted-foreground shrink-0" />
                                                                    <span className="font-medium text-muted-foreground min-w-[60px] shrink-0">IP：</span>
                                                                    <span className="font-mono text-xs">{sub.ip_address || "-"}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 bg-background rounded px-3 py-2 text-sm">
                                                                    <Timer className="size-3.5 text-muted-foreground shrink-0" />
                                                                    <span className="font-medium text-muted-foreground min-w-[60px] shrink-0">用时：</span>
                                                                    <span>{sub.duration != null ? formatDuration(sub.duration) : "-"}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 bg-background rounded px-3 py-2 text-sm">
                                                                    <Fingerprint className="size-3.5 text-muted-foreground shrink-0" />
                                                                    <span className="font-medium text-muted-foreground min-w-[60px] shrink-0">指纹：</span>
                                                                    <span className="font-mono text-xs">{sub.fingerprint || "-"}</span>
                                                                </div>
                                                                <div className="flex items-start gap-2 bg-background rounded px-3 py-2 text-sm">
                                                                    <Monitor className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                                                    <span className="font-medium text-muted-foreground min-w-[60px] shrink-0">UA：</span>
                                                                    <span className="font-mono text-xs break-all">{sub.user_agent || "-"}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* 评分明细 */}
                                                        <div>
                                                            <p className="text-xs font-medium text-muted-foreground mb-2">评分明细</p>
                                                            <div className="grid grid-cols-4 gap-2">
                                                                <div className="bg-background rounded px-3 py-2 text-sm">
                                                                    <p className="text-xs text-muted-foreground">时间分</p>
                                                                    <p className="font-mono font-semibold">{sub.duration_score ?? 0}</p>
                                                                    {sub.duration != null && (
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {sub.duration}s {sub.duration >= rules.duration_threshold ? "\u2265" : "<"} {rules.duration_threshold}s
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="bg-background rounded px-3 py-2 text-sm">
                                                                    <p className="text-xs text-muted-foreground">UA 分</p>
                                                                    <p className="font-mono font-semibold">{sub.ua_score ?? 0}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {(sub.ua_score ?? 0) > 0 ? "正常浏览器" : "异常 UA"}
                                                                    </p>
                                                                </div>
                                                                <div className="bg-background rounded px-3 py-2 text-sm">
                                                                    <p className="text-xs text-muted-foreground">客观题分</p>
                                                                    <p className="font-mono font-semibold">{sub.objective_score ?? 0}</p>
                                                                    {sub.objective_detail && Object.keys(sub.objective_detail).length > 0 && (
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {Object.entries(sub.objective_detail).map(([k, v]) => `${k}: ${v.got}/${v.max}`).join(", ")}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="bg-background rounded px-3 py-2 text-sm">
                                                                    <p className="text-xs text-muted-foreground">AI 主观分</p>
                                                                    <p className="font-mono font-semibold">
                                                                        {sub.ai_score !== null ? sub.ai_score : "-"}
                                                                    </p>
                                                                    {sub.ai_scored_at && (
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {new Date(sub.ai_scored_at).toLocaleString("zh-CN")}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* AI 评语 */}
                                                        {sub.ai_detail && (
                                                            <div>
                                                                <p className="text-xs font-medium text-muted-foreground mb-2">AI 评语</p>
                                                                <div className="bg-background rounded px-3 py-3 text-sm space-y-2">
                                                                    <p>{sub.ai_detail.comment || "无评语"}</p>
                                                                    {sub.ai_detail.details && (
                                                                        <div className="grid gap-1 mt-2 pt-2 border-t">
                                                                            {Object.entries(sub.ai_detail.details).map(([label, detail]) => (
                                                                                <div key={label} className="flex items-start gap-2 text-xs">
                                                                                    <Badge variant="outline" className="shrink-0 text-xs">{label}: {detail.score}</Badge>
                                                                                    <span className="text-muted-foreground">{detail.comment}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* 审核记录 */}
                                                        {sub.review_status && (
                                                            <div>
                                                                <p className="text-xs font-medium text-muted-foreground mb-2">审核记录</p>
                                                                <div className="bg-background rounded px-3 py-2 text-sm flex items-center gap-3">
                                                                    {getStatusBadge(sub.review_status)}
                                                                    <span className="text-muted-foreground">
                                                                        由 {sub.reviewer_name || "未知"} 于{" "}
                                                                        {sub.review_at ? new Date(sub.review_at).toLocaleString("zh-CN") : "-"}
                                                                    </span>
                                                                    {sub.review_note && (
                                                                        <span className="text-muted-foreground">| 备注: {sub.review_note}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
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

            {/* ─── 分页 ──────────────────────────────────── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                        上一页
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        第 {page + 1} / {totalPages} 页
                    </span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                        下一页
                    </Button>
                </div>
            )}

            {/* ─── 审核对话框 ────────────────────────────── */}
            <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {reviewAction === "approved" ? "通过申请" : "拒绝申请"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            {reviewAction === "approved"
                                ? "确认通过此入服申请？将发送邮件通知申请人。"
                                : "确认拒绝此入服申请？将发送邮件通知申请人。"}
                        </p>
                        <div className="grid gap-2">
                            <Label>{reviewAction === "approved" ? "备注（可选）" : "拒绝理由（可选）"}</Label>
                            <Textarea
                                placeholder={reviewAction === "approved" ? "欢迎加入..." : "请说明拒绝原因..."}
                                value={reviewNote}
                                onChange={(e) => setReviewNote(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">取消</Button>
                        </DialogClose>
                        <Button
                            variant={reviewAction === "approved" ? "default" : "destructive"}
                            onClick={handleReviewSubmit}
                            disabled={reviewSubmitting}
                        >
                            {reviewSubmitting ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : reviewAction === "approved" ? (
                                <>
                                    <CheckCircle2 className="size-4 mr-1.5" />
                                    确认通过
                                </>
                            ) : (
                                <>
                                    <XCircle className="size-4 mr-1.5" />
                                    确认拒绝
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
