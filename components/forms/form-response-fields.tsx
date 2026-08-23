"use client";

import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormField } from "@/lib/forms";

type FormResponseFieldsProps = {
    fields: FormField[];
    values: Record<string, unknown>;
    onValueChange: (fieldKey: string, value: unknown) => void;
    idPrefix: string;
    editableFieldKeys?: string[];
    disabled?: boolean;
    errors?: Record<string, string>;
};

type FormResponseControlProps = {
    field: FormField;
    value: unknown;
    onChange: (value: unknown) => void;
    inputId: string;
    disabled: boolean;
    invalid: boolean;
    describedBy?: string;
    labelId: string;
};

const HARD_MAX_LENGTH: Partial<Record<FormField["type"], number>> = {
    text: 4_096,
    textarea: 50_000,
    radio: 512,
    select: 512,
    date: 10,
    email: 320,
    qq: 12,
    mcid: 16,
};

function maxLengthFor(field: FormField) {
    const configured = field.validation?.maxLength;
    const hardLimit = HARD_MAX_LENGTH[field.type];
    if (configured === undefined) return hardLimit;
    return hardLimit === undefined ? configured : Math.min(configured, hardLimit);
}

function FormResponseControl({
    field,
    value,
    onChange,
    inputId,
    disabled,
    invalid,
    describedBy,
    labelId,
}: FormResponseControlProps) {
    const common = {
        "aria-describedby": describedBy,
        "aria-invalid": invalid || undefined,
        disabled,
        name: field.key,
    };

    switch (field.type) {
        case "textarea":
            return (
                <Textarea
                    {...common}
                    id={inputId}
                    value={String(value ?? "")}
                    placeholder={field.placeholder || ""}
                    required={field.required}
                    minLength={field.validation?.minLength}
                    maxLength={maxLengthFor(field)}
                    autoComplete="off"
                    onChange={(event) => onChange(event.target.value)}
                    rows={4}
                />
            );
        case "number":
            return (
                <Input
                    {...common}
                    id={inputId}
                    type="number"
                    inputMode="decimal"
                    value={String(value ?? "")}
                    placeholder={field.placeholder || ""}
                    required={field.required}
                    min={field.validation?.min}
                    max={field.validation?.max}
                    autoComplete="off"
                    onChange={(event) => onChange(event.target.value)}
                />
            );
        case "date":
            return (
                <Input
                    {...common}
                    id={inputId}
                    type="date"
                    value={String(value ?? "")}
                    required={field.required}
                    autoComplete="off"
                    onChange={(event) => onChange(event.target.value)}
                />
            );
        case "checkbox": {
            const selectedValues = Array.isArray(value) ? value.map(String) : [];
            return (
                <div
                    className="grid gap-2"
                    role="group"
                    aria-labelledby={labelId}
                    aria-describedby={describedBy}
                >
                    {(field.options ?? []).map((option, optionIndex) => {
                        const optionId = `${inputId}-option-${optionIndex}`;
                        const checked = selectedValues.includes(option.value);
                        return (
                            <div key={option.value} className="flex min-h-8 items-center gap-2 text-sm">
                                <Checkbox
                                    id={optionId}
                                    name={field.key}
                                    checked={checked}
                                    disabled={disabled}
                                    aria-invalid={invalid || undefined}
                                    aria-required={field.required || undefined}
                                    onCheckedChange={(nextChecked) => {
                                        onChange(
                                            nextChecked
                                                ? [...selectedValues, option.value]
                                                : selectedValues.filter((item) => item !== option.value),
                                        );
                                    }}
                                />
                                <Label htmlFor={optionId} className="font-normal">{option.label}</Label>
                            </div>
                        );
                    })}
                </div>
            );
        }
        case "toggle":
            return (
                <div className="flex min-h-8 items-center gap-2">
                    <Checkbox
                        id={inputId}
                        name={field.key}
                        checked={Boolean(value)}
                        disabled={disabled}
                        aria-describedby={describedBy}
                        aria-invalid={invalid || undefined}
                        aria-required={field.required || undefined}
                        onCheckedChange={(checked) => onChange(Boolean(checked))}
                    />
                    <Label htmlFor={inputId} className="text-sm font-normal text-muted-foreground">
                        {field.helpText || field.label || "启用"}
                    </Label>
                </div>
            );
        case "radio":
            return (
                <div
                    className="grid gap-2"
                    role="radiogroup"
                    aria-labelledby={labelId}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    aria-required={field.required || undefined}
                >
                    {(field.options ?? []).map((option, optionIndex) => {
                        const optionId = `${inputId}-option-${optionIndex}`;
                        return (
                            <div key={option.value} className="flex min-h-8 items-center gap-2 text-sm">
                                <input
                                    id={optionId}
                                    name={field.key}
                                    type="radio"
                                    value={option.value}
                                    checked={String(value ?? "") === option.value}
                                    disabled={disabled}
                                    onChange={() => onChange(option.value)}
                                />
                                <Label htmlFor={optionId} className="font-normal">{option.label}</Label>
                            </div>
                        );
                    })}
                </div>
            );
        case "select":
            return (
                <select
                    {...common}
                    id={inputId}
                    className="border-input bg-background text-foreground ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={typeof value === "string" ? value : ""}
                    required={field.required}
                    autoComplete="off"
                    onChange={(event) => onChange(event.target.value)}
                >
                    <option value="" disabled>{field.placeholder || "请选择"}</option>
                    {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            );
        default: {
            const type = field.type === "email" ? "email" : "text";
            const inputMode = field.type === "email" ? "email" : field.type === "qq" ? "numeric" : "text";
            const semanticPattern = field.type === "qq"
                ? "[1-9][0-9]{4,11}"
                : field.type === "mcid"
                    ? "[A-Za-z0-9_]{3,16}"
                    : undefined;
            return (
                <Input
                    {...common}
                    id={inputId}
                    type={type}
                    inputMode={inputMode}
                    value={String(value ?? "")}
                    placeholder={field.placeholder || ""}
                    required={field.required}
                    minLength={field.validation?.minLength}
                    maxLength={maxLengthFor(field)}
                    pattern={field.validation?.pattern || semanticPattern}
                    autoComplete={field.type === "email" ? "email" : "off"}
                    spellCheck={field.type === "text" ? undefined : false}
                    onChange={(event) => onChange(event.target.value)}
                />
            );
        }
    }
}

export function FormResponseFields({
    fields,
    values,
    onValueChange,
    idPrefix,
    editableFieldKeys,
    disabled = false,
    errors = {},
}: FormResponseFieldsProps) {
    const visibleFields = fields.filter((field) => field.enabled);
    const editableFieldKeySet = editableFieldKeys === undefined ? null : new Set(editableFieldKeys);

    if (visibleFields.length === 0) {
        return (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                当前没有启用的题目。
            </div>
        );
    }

    return visibleFields.map((field, index) => {
        const inputId = `${idPrefix}-${field.key || index}`;
        const labelId = `${inputId}-label`;
        const helpId = field.helpText ? `${inputId}-help` : undefined;
        const error = errors[field.key];
        const errorId = error ? `${inputId}-error` : undefined;
        const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
        const readOnly = disabled || (editableFieldKeySet !== null && !editableFieldKeySet.has(field.key));
        const isChoiceGroup = field.type === "checkbox" || field.type === "radio";

        return (
            <div key={field.key || index} className="grid gap-2" data-field-key={field.key}>
                <div className="flex flex-wrap items-center gap-2">
                    {isChoiceGroup ? (
                        <p id={labelId} className="text-sm font-medium">
                            {field.label || `未命名题目 ${index + 1}`}
                            {field.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
                        </p>
                    ) : (
                        <Label id={labelId} htmlFor={inputId}>
                            {field.label || `未命名题目 ${index + 1}`}
                            {field.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
                        </Label>
                    )}
                    {readOnly && (
                        <Badge variant="outline">
                            <Lock aria-hidden="true" />
                            只读
                        </Badge>
                    )}
                </div>
                <FormResponseControl
                    field={field}
                    value={values[field.key]}
                    onChange={(value) => onValueChange(field.key, value)}
                    inputId={inputId}
                    disabled={readOnly}
                    invalid={Boolean(error)}
                    describedBy={describedBy}
                    labelId={labelId}
                />
                {field.helpText && field.type !== "toggle" && (
                    <p id={helpId} className="text-xs text-muted-foreground">{field.helpText}</p>
                )}
                {error && <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>}
            </div>
        );
    });
}
