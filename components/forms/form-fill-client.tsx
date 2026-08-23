"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { FormResponseFields } from "@/components/forms/form-response-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { buildSubmissionDefaults, validateSubmissionValues, type FormField } from "@/lib/forms";
import { CapWidget, type CapWidgetHandle } from "@/components/cap-widget";
import { CAPTCHA_DEVELOPMENT_TOKEN, CAPTCHA_DISABLED } from "@/lib/cap-config";

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

type FormFillMode = "submit" | "preview";

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

type FormFillClientProps = {
    initialForm: FormData | null;
    initialError?: string | null;
    mode?: FormFillMode;
    previewLabel?: string;
};

export function FormFillClient({
    initialForm,
    initialError = null,
    mode = "submit",
    previewLabel = "预览模式",
}: FormFillClientProps) {
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [captchaToken, setCaptchaToken] = useState<string | null>(CAPTCHA_DISABLED ? CAPTCHA_DEVELOPMENT_TOKEN : null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [values, setValues] = useState<Record<string, unknown>>(() => (
        initialForm ? buildSubmissionDefaults(initialForm.fields) : {}
    ));
    const startTimeRef = useRef(Date.now());
    const capWidgetRef = useRef<CapWidgetHandle>(null);

    const updateValue = (key: string, value: unknown) => {
        setValues((prev) => ({ ...prev, [key]: value }));
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const focusField = (fieldKey?: string) => {
        if (!fieldKey) return;
        const element = document.getElementById(`form-field-${fieldKey}`)
            ?? document.querySelector(`[name="${CSS.escape(fieldKey)}"]`);
        if (element instanceof HTMLElement) element.focus();
    };

    const submitLabel = useMemo(() => initialForm?.settings?.submitLabel || "提交表单", [initialForm]);
    const successMessage = useMemo(() => initialForm?.settings?.successMessage || "提交成功，感谢你的填写。", [initialForm]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!initialForm || mode === "preview" || !captchaToken) return;

        setFieldErrors({});
        setSubmitError(null);
        const validation = validateSubmissionValues(initialForm.fields, values);
        if (!validation.ok) {
            setSubmitError(validation.error);
            setFieldErrors({ [validation.fieldKey]: validation.error });
            requestAnimationFrame(() => focusField(validation.fieldKey));
            return;
        }

        setSubmitting(true);
        try {
            const duration = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : null;
            const res = await fetch(`/api/forms/${initialForm.id}/submissions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    data: validation.value,
                    fingerprint: generateFingerprint(),
                    duration,
                    captchaToken,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                capWidgetRef.current?.reset();
                const message = data.error || "提交失败";
                setSubmitError(message);
                if (data.fieldKey && typeof data.fieldKey === "string") {
                    setFieldErrors({ [data.fieldKey]: message });
                    requestAnimationFrame(() => focusField(data.fieldKey));
                }
                toast.error(message);
                return;
            }
            setSubmitted(true);
            toast.success("提交成功");
        } catch {
            capWidgetRef.current?.reset();
            setSubmitError("提交失败，请稍后重试");
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
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <h1 className="min-w-0 text-2xl font-bold">{initialForm.title}</h1>
                    {mode === "preview" && <Badge variant="secondary">{previewLabel}</Badge>}
                </div>
                {initialForm.description && <p className="mt-2 text-muted-foreground">{initialForm.description}</p>}
                {initialForm.settings?.introText && <p className="mt-4 text-sm text-muted-foreground">{initialForm.settings.introText}</p>}
            </div>
            <Separator className="mb-8" />
            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                {submitError && (
                    <div id="form-errors" role="alert" aria-live="polite" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        {submitError}
                    </div>
                )}
                <FormResponseFields
                    fields={initialForm.fields}
                    values={values}
                    onValueChange={updateValue}
                    idPrefix="form-field"
                    errors={fieldErrors}
                />
                {mode === "submit" && (
                    <CapWidget ref={capWidgetRef} onTokenChange={setCaptchaToken} />
                )}
                <div className="pt-2">
                    <Button
                        className="w-full"
                        size="lg"
                        disabled={submitting || mode === "preview" || !captchaToken}
                        type={mode === "preview" ? "button" : "submit"}
                    >
                        {submitting ? <Loader2 className="size-4 animate-spin" /> : mode === "preview" ? previewLabel : submitLabel}
                    </Button>
                </div>
            </form>
        </div>
    );
}
