"use client";

import { useMemo, useRef, useState } from "react";
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

function renderPreviewValue(
    field: FormField,
    value: unknown,
    onChange: (next: unknown) => void,
    inputId: string,
) {
    switch (field.type) {
        case "textarea":
            return (
                <Textarea
                    id={inputId}
                    name={field.key}
                    value={String(value ?? "")}
                    placeholder={field.placeholder || ""}
                    onChange={(event) => onChange(event.target.value)}
                    onInput={(event) => onChange(event.currentTarget.value)}
                    rows={4}
                />
            );
        case "number":
            return (
                <Input
                    id={inputId}
                    name={field.key}
                    type="number"
                    value={String(value ?? "")}
                    placeholder={field.placeholder || ""}
                    onChange={(event) => onChange(event.target.value)}
                    onInput={(event) => onChange(event.currentTarget.value)}
                />
            );
        case "date":
            return (
                <Input
                    id={inputId}
                    name={field.key}
                    type="date"
                    value={String(value ?? "")}
                    onChange={(event) => onChange(event.target.value)}
                    onInput={(event) => onChange(event.currentTarget.value)}
                />
            );
        case "checkbox": {
            const selectedValues = Array.isArray(value) ? value.map(String) : [];
            return (
                <div className="grid gap-2">
                    {(field.options ?? []).map((option, optionIndex) => {
                        const optionId = `${inputId}-option-${optionIndex}`;
                        const checked = selectedValues.includes(option.value);
                        return (
                            <div key={option.value} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                    id={optionId}
                                    name={field.key}
                                    checked={checked}
                                    onCheckedChange={(nextChecked) => {
                                        onChange(
                                            nextChecked
                                                ? [...selectedValues, option.value]
                                                : selectedValues.filter((item) => item !== option.value),
                                        );
                                    }}
                                />
                                <Label htmlFor={optionId}>{option.label}</Label>
                            </div>
                        );
                    })}
                </div>
            );
        }
        case "toggle":
            return (
                <div className="flex items-center gap-2">
                    <Checkbox id={inputId} name={field.key} checked={Boolean(value)} onCheckedChange={(checked) => onChange(Boolean(checked))} />
                    <Label htmlFor={inputId} className="text-sm font-normal text-muted-foreground">
                        {field.helpText || field.label}
                    </Label>
                </div>
            );
        case "radio":
            return (
                <div className="grid gap-2">
                    {(field.options ?? []).map((option, optionIndex) => {
                        const optionId = `${inputId}-option-${optionIndex}`;
                        return (
                            <div key={option.value} className="flex items-center gap-2 text-sm">
                                <input
                                    id={optionId}
                                    name={field.key}
                                    type="radio"
                                    checked={String(value ?? "") === option.value}
                                    onChange={() => onChange(option.value)}
                                />
                                <Label htmlFor={optionId} className="font-normal">
                                    {option.label}
                                </Label>
                            </div>
                        );
                    })}
                </div>
            );
        case "select":
            return (
                <select
                    id={inputId}
                    name={field.key}
                    className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) => onChange(event.target.value)}
                >
                    <option value="" disabled>
                        {field.placeholder || "请选择"}
                    </option>
                    {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                    </select>
            );
        default:
            return (
                <Input
                    id={inputId}
                    name={field.key}
                    value={String(value ?? "")}
                    placeholder={field.placeholder || ""}
                    onChange={(event) => onChange(event.target.value)}
                    onInput={(event) => onChange(event.currentTarget.value)}
                />
            );
    }
}

type FormFillClientProps = {
    initialForm: FormData | null;
    initialError?: string | null;
};

export function FormFillClient({ initialForm, initialError = null }: FormFillClientProps) {
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [values, setValues] = useState<Record<string, unknown>>(() => (
        initialForm ? buildSubmissionDefaults(initialForm.fields) : {}
    ));
    const startTimeRef = useRef(Date.now());

    const updateValue = (key: string, value: unknown) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    };

    const submitLabel = useMemo(() => initialForm?.settings?.submitLabel || "提交表单", [initialForm]);
    const successMessage = useMemo(() => initialForm?.settings?.successMessage || "提交成功，感谢你的填写。", [initialForm]);

    const handleSubmit = async () => {
        if (!initialForm) return;

        setSubmitting(true);
        try {
            const duration = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : null;
            const res = await fetch(`/api/forms/${initialForm.id}/submissions`, {
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

    if (initialError) {
        return (
            <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
                <FileText className="mx-auto mb-4 size-16 text-muted-foreground" />
                <h1 className="mb-2 text-2xl font-bold">无法访问表单</h1>
                <p className="mb-6 text-muted-foreground">{initialError}</p>
                {initialError.includes("登录") ? (
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

    if (!initialForm) return null;

    return (
        <div className="container mx-auto max-w-2xl px-4 py-12">
            <div className="mb-8 rounded-lg border bg-muted/20 p-5">
                <h1 className="text-2xl font-bold">{initialForm.title}</h1>
                {initialForm.description && <p className="mt-2 text-muted-foreground">{initialForm.description}</p>}
                {initialForm.settings?.introText && <p className="mt-4 text-sm text-muted-foreground">{initialForm.settings.introText}</p>}
            </div>
            <Separator className="mb-8" />
            <div className="space-y-6">
                {initialForm.fields.filter((field) => field.enabled).map((field) => (
                    <div key={field.key} className="grid gap-2">
                        <Label htmlFor={`form-field-${field.key}`}>
                            {field.label}
                            {field.required && <span className="ml-1 text-destructive">*</span>}
                        </Label>
                        {renderPreviewValue(
                            field,
                            values[field.key],
                            (next) => updateValue(field.key, next),
                            `form-field-${field.key}`,
                        )}
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
