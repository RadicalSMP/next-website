"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, CheckCircle2, FileText } from "lucide-react";
import Link from "next/link";

/* ─── 类型定义 ─────────────────────────────────────────────── */

interface FormField {
    key: string;
    label: string;
    type: "text" | "textarea" | "select" | "checkbox" | "number";
    required: boolean;
    placeholder?: string;
    options?: string[];
}

interface FormData {
    id: string;
    title: string;
    description: string | null;
    slug: string;
    fields: FormField[];
    visibility: string;
}

/* ─── 简易浏览器指纹 ──────────────────────────────────────── */

function generateFingerprint(): string {
    const components = [
        navigator.userAgent,
        navigator.language,
        screen.width + "x" + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || "",
        navigator.maxTouchPoints || 0,
    ];
    const str = components.join("|");
    // 简单 hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

/* ─── 主组件 ─────────────────────────────────────────────── */

export function FormFillClient({ slug }: { slug: string }) {
    const [form, setForm] = useState<FormData | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [values, setValues] = useState<Record<string, unknown>>({});
    const startTimeRef = useRef<number>(0);

    // ─── 加载表单 ─────────────────────────────────────────
    const fetchForm = useCallback(async () => {
        try {
            const res = await fetch(`/api/forms/by-slug/${encodeURIComponent(slug)}`);
            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "表单不存在");
                return;
            }
            const data = await res.json();
            setForm(data.form);

            // 初始化默认值
            const defaults: Record<string, unknown> = {};
            for (const field of data.form.fields) {
                if (field.type === "checkbox") {
                    defaults[field.key] = false;
                } else {
                    defaults[field.key] = "";
                }
            }
            setValues(defaults);

            // 开始计时
            startTimeRef.current = Date.now();
        } catch {
            setError("加载表单失败");
        } finally {
            setLoading(false);
        }
    }, [slug]);

    useEffect(() => {
        fetchForm();
    }, [fetchForm]);

    // ─── 更新字段值 ───────────────────────────────────────
    const updateValue = (key: string, value: unknown) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    };

    // ─── 提交 ─────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!form) return;

        // 客户端校验必填字段
        for (const field of form.fields) {
            if (field.required) {
                const value = values[field.key];
                if (
                    value === undefined ||
                    value === null ||
                    (typeof value === "string" && value.trim() === "")
                ) {
                    toast.error(`请填写「${field.label}」`);
                    return;
                }
            }
        }

        setSubmitting(true);
        try {
            // 计算填写用时（秒）
            const duration = startTimeRef.current
                ? Math.round((Date.now() - startTimeRef.current) / 1000)
                : null;
            const fingerprint = generateFingerprint();

            const res = await fetch(`/api/forms/${form.id}/submissions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    data: values,
                    fingerprint,
                    duration,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "提交失败");
                return;
            }

            setSubmitted(true);
            toast.success("提交成功！");
        } catch {
            toast.error("提交失败，请稍后重试");
        } finally {
            setSubmitting(false);
        }
    };

    // ─── 渲染字段 ─────────────────────────────────────────
    const renderField = (field: FormField) => {
        switch (field.type) {
            case "text":
                return (
                    <Input
                        placeholder={field.placeholder}
                        value={(values[field.key] as string) || ""}
                        onChange={(e) => updateValue(field.key, e.target.value)}
                    />
                );
            case "textarea":
                return (
                    <Textarea
                        placeholder={field.placeholder}
                        value={(values[field.key] as string) || ""}
                        onChange={(e) => updateValue(field.key, e.target.value)}
                        rows={4}
                    />
                );
            case "number":
                return (
                    <Input
                        type="number"
                        placeholder={field.placeholder}
                        value={(values[field.key] as string) || ""}
                        onChange={(e) => updateValue(field.key, e.target.value)}
                    />
                );
            case "select":
                return (
                    <Select
                        value={(values[field.key] as string) || ""}
                        onValueChange={(v) => updateValue(field.key, v)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={field.placeholder || "请选择"} />
                        </SelectTrigger>
                        <SelectContent>
                            {(field.options || []).map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                    {opt}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            case "checkbox":
                return (
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id={`field-${field.key}`}
                            checked={!!values[field.key]}
                            onCheckedChange={(checked) => updateValue(field.key, !!checked)}
                        />
                        <Label htmlFor={`field-${field.key}`} className="text-sm font-normal">
                            {field.placeholder || field.label}
                        </Label>
                    </div>
                );
            default:
                return null;
        }
    };

    // ─── 加载中 ───────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // ─── 错误状态 ─────────────────────────────────────────
    if (error) {
        return (
            <div className="container max-w-2xl mx-auto py-20 px-4 text-center">
                <FileText className="size-16 text-muted-foreground mx-auto mb-4" />
                <h1 className="text-2xl font-bold mb-2">无法访问表单</h1>
                <p className="text-muted-foreground mb-6">原因: {error}</p>
                {error === "需要登录后才能查看此表单" ? (
                    <Button variant="default" asChild>
                        <Link href="/sign-in">去登录</Link>
                    </Button>
                ) : (
                    <Button variant="outline" asChild>
                        <Link href="/forms">返回表单列表</Link>
                    </Button>
                )}
            </div>
        );
    }

    // ─── 提交成功 ─────────────────────────────────────────
    if (submitted) {
        return (
            <div className="container max-w-2xl mx-auto py-20 px-4 text-center">
                <CheckCircle2 className="size-16 text-green-500 mx-auto mb-4" />
                <h1 className="text-2xl font-bold mb-2">提交成功！</h1>
                <p className="text-muted-foreground mb-6">
                    感谢您的提交，我们已收到您的信息。
                </p>
                <Button variant="outline" asChild>
                    <Link href="/forms">返回表单列表</Link>
                </Button>
            </div>
        );
    }

    // ─── 表单填写 ─────────────────────────────────────────
    if (!form) return null;

    return (
        <div className="container max-w-2xl mx-auto py-12 px-4">
            {/* 标题区 */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold">{form.title}</h1>
                {form.description && (
                    <p className="text-muted-foreground text-base mt-2">
                        {form.description}
                    </p>
                )}
            </div>

            <Separator className="mb-8" />

            {/* 字段区 */}
            <div className="space-y-6">
                {form.fields.map((field) => (
                    <div key={field.key} className="grid gap-2">
                        {field.type !== "checkbox" && (
                            <Label htmlFor={`field-${field.key}`}>
                                {field.label}
                                {field.required && (
                                    <span className="text-destructive ml-1">*</span>
                                )}
                            </Label>
                        )}
                        {renderField(field)}
                    </div>
                ))}

                <div className="pt-4">
                    <Button
                        className="w-full"
                        size="lg"
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            "提交"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
