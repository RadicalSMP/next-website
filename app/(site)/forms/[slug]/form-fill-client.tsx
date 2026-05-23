"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { buildSubmissionDefaults, normalizeFormFields } from "@/lib/forms";

type FormField = ReturnType<typeof normalizeFormFields>[number];

type FormData = {
    id: string;
    title: string;
    description: string | null;
    slug: string;
    visibility: string;
    versionId: string;
    version: number;
    fields: FormField[];
    settings?: {
        submitLabel?: string;
        successMessage?: string;
        introText?: string;
    };
};

function generateFingerprint(): string {
    const components = [
        navigator.userAgent,
        navigator.language,
        `${screen.width}x${screen.height}`,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || "",
        navigator.maxTouchPoints || 0,
    ];
    const str = components.join("|");
    let hash = 0;
    for (let index = 0; index < str.length; index += 1) {
        hash = ((hash << 5) - hash) + str.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

function renderPreviewValue(field: FormField, value: unknown, onChange: (next: unknown) => void) {
    switch (field.type) {
        case "textarea":
            return <Textarea value={String(value ?? "")} placeholder={field.placeholder || ""} onChange={(event) => onChange(event.target.value)} rows={4} />;
        case "number":
            return <Input type="number" value={String(value ?? "")} placeholder={field.placeholder || ""} onChange={(event) => onChange(event.target.value)} />;
        case "date":
            return <Input type="date" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
        case "checkbox":
        case "toggle":
            return (
                <div className="flex items-center gap-2">
                    <Checkbox checked={Boolean(value)} onCheckedChange={(checked) => onChange(Boolean(checked))} />
                    <span className="text-sm text-muted-foreground">{field.helpText || field.label}</span>
                </div>
            );
        case "radio":
        case "select":
            return (
                <div className="grid gap-2">
                    {(field.options ?? []).map((option) => (
                        <label key={option.value} className="flex items-center gap-2 text-sm">
                            <input
                                type={field.type === "radio" ? "radio" : "radio"}
                                name={field.key}
                                checked={String(value ?? "") === option.value}
                                onChange={() => onChange(option.value)}
                            />
                            <span>{option.label}</span>
                        </label>
                    ))}
                </div>
            );
        default:
            return <Input value={String(value ?? "")} placeholder={field.placeholder || ""} onChange={(event) => onChange(event.target.value)} />;
    }
}

export function FormFillClient({ slug }: { slug: string }) {
    const [form, setForm] = useState<FormData | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [values, setValues] = useState<Record<string, unknown>>({});
    const startTimeRef = useRef(0);

    const fetchForm = useCallback(async () => {
        try {
            const res = await fetch(`/api/forms/by-slug/${encodeURIComponent(slug)}`);
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "表单不存在");
                return;
            }
            setForm(data.form);
            setValues(buildSubmissionDefaults(data.form.fields));
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

    const updateValue = (key: string, value: unknown) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    };

    const submitLabel = useMemo(() => form?.settings?.submitLabel || "提交表单", [form]);
    const successMessage = useMemo(() => form?.settings?.successMessage || "提交成功，感谢你的填写。", [form]);

    const handleSubmit = async () => {
        if (!form) return;

        setSubmitting(true);
        try {
            const duration = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : null;
            const res = await fetch(`/api/forms/${form.id}/submissions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    data: values,
                    fingerprint: generateFingerprint(),
                    duration,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "提交失败");
                return;
            }
            setSubmitted(true);
            toast.success("提交成功");
        } catch {
            toast.error("提交失败，请稍后重试");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
                <FileText className="mx-auto mb-4 size-16 text-muted-foreground" />
                <h1 className="mb-2 text-2xl font-bold">无法访问表单</h1>
                <p className="mb-6 text-muted-foreground">{error}</p>
                {error.includes("登录") ? (
                    <Button asChild>
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

    if (submitted) {
        return (
            <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
                <CheckCircle2 className="mx-auto mb-4 size-16 text-green-500" />
                <h1 className="mb-2 text-2xl font-bold">提交成功</h1>
                <p className="mb-6 text-muted-foreground">{successMessage}</p>
                <Button variant="outline" asChild>
                    <Link href="/forms">返回表单列表</Link>
                </Button>
            </div>
        );
    }

    if (!form) return null;

    return (
        <div className="container mx-auto max-w-2xl px-4 py-12">
            <div className="mb-8 rounded-lg border bg-muted/20 p-5">
                <h1 className="text-2xl font-bold">{form.title}</h1>
                {form.description && <p className="mt-2 text-muted-foreground">{form.description}</p>}
                {form.settings?.introText && <p className="mt-4 text-sm text-muted-foreground">{form.settings.introText}</p>}
            </div>
            <Separator className="mb-8" />
            <div className="space-y-6">
                {form.fields.filter((field) => field.enabled).map((field) => (
                    <div key={field.key} className="grid gap-2">
                        <Label htmlFor={field.key}>
                            {field.label}
                            {field.required && <span className="ml-1 text-destructive">*</span>}
                        </Label>
                        {renderPreviewValue(field, values[field.key], (next) => updateValue(field.key, next))}
                        {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
                    </div>
                ))}
                <div className="pt-2">
                    <Button className="w-full" size="lg" disabled={submitting} onClick={handleSubmit}>
                        {submitting ? <Loader2 className="size-4 animate-spin" /> : submitLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}
