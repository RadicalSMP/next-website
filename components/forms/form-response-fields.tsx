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
};

type FormResponseControlProps = {
    field: FormField;
    value: unknown;
    onChange: (value: unknown) => void;
    inputId: string;
    disabled: boolean;
};

function FormResponseControl({
    field,
    value,
    onChange,
    inputId,
    disabled,
}: FormResponseControlProps) {
    switch (field.type) {
        case "textarea":
            return (
                <Textarea
                    id={inputId}
                    name={field.key}
                    value={String(value ?? "")}
                    placeholder={field.placeholder || ""}
                    disabled={disabled}
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
                    disabled={disabled}
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
                    disabled={disabled}
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
                                    disabled={disabled}
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
                    <Checkbox
                        id={inputId}
                        name={field.key}
                        checked={Boolean(value)}
                        disabled={disabled}
                        onCheckedChange={(checked) => onChange(Boolean(checked))}
                    />
                    <Label htmlFor={inputId} className="text-sm font-normal text-muted-foreground">
                        {field.helpText || field.label || "启用"}
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
                                    disabled={disabled}
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
                    disabled={disabled}
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
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.value)}
                    onInput={(event) => onChange(event.currentTarget.value)}
                />
            );
    }
}

export function FormResponseFields({
    fields,
    values,
    onValueChange,
    idPrefix,
    editableFieldKeys,
    disabled = false,
}: FormResponseFieldsProps) {
    const visibleFields = fields.filter((field) => field.enabled);
    const editableFieldKeySet = editableFieldKeys === undefined
        ? null
        : new Set(editableFieldKeys);

    if (visibleFields.length === 0) {
        return (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                当前没有启用的题目。
            </div>
        );
    }

    return visibleFields.map((field, index) => {
        const inputId = `${idPrefix}-${field.key || index}`;
        const readOnly = disabled || (editableFieldKeySet !== null && !editableFieldKeySet.has(field.key));

        return (
            <div key={field.key || index} className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor={inputId}>
                        {field.label || `未命名题目 ${index + 1}`}
                        {field.required && <span className="ml-1 text-destructive">*</span>}
                    </Label>
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
                />
                {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            </div>
        );
    });
}
