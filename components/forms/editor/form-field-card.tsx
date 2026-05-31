"use client";

import {
    Copy,
    GripVertical,
    Plus,
    Trash2,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { fieldHasOptions, fieldTypeIcons, fieldTypeLabels } from "./constants";

type FormFieldCardProps = {
    field: FormField;
    index: number;
    selected: boolean;
    onSelect: () => void;
    onUpdate: (updates: Partial<FormField>) => void;
    onDuplicate: () => void;
    onRemove: () => void;
    onAddOption: () => void;
    onUpdateOption: (optionIndex: number, label: string) => void;
    onRemoveOption: (optionIndex: number) => void;
};

function FieldPreviewInput({ field, index }: { field: FormField; index: number }) {
    const previewLabel = field.label ? `${field.label} 预览` : fieldTypeLabels[field.type];
    const previewId = `field-${index}-preview-${field.type}`;
    const previewName = `field_${index}_preview_${field.type}`;

    if (field.type === "textarea") {
        return (
            <Textarea
                id={previewId}
                name={previewName}
                disabled
                rows={3}
                placeholder={field.placeholder || "填写者将在这里输入多行文本"}
                aria-label={previewLabel}
                className="resize-none bg-muted/40"
            />
        );
    }
    if (field.type === "toggle") {
        return (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <Checkbox id={previewId} name={previewName} disabled aria-label={previewLabel} />
                <span>开关选择</span>
            </div>
        );
    }
    if (field.type === "date") {
        return <Input id={previewId} name={previewName} disabled type="date" aria-label={previewLabel} className="bg-muted/40" />;
    }
    if (field.type === "number") {
        return <Input id={previewId} name={previewName} disabled type="number" placeholder={field.placeholder || "数字"} aria-label={previewLabel} className="bg-muted/40" />;
    }
    if (field.type === "email") {
        return <Input id={previewId} name={previewName} disabled type="email" placeholder={field.placeholder || "name@example.com"} aria-label={previewLabel} className="bg-muted/40" />;
    }
    return (
        <Input
            id={previewId}
            name={previewName}
            disabled
            placeholder={field.placeholder || fieldTypeLabels[field.type]}
            aria-label={previewLabel}
            className="bg-muted/40"
        />
    );
}

export function FormFieldCard({
    field,
    index,
    selected,
    onSelect,
    onUpdate,
    onDuplicate,
    onRemove,
    onAddOption,
    onUpdateOption,
    onRemoveOption,
}: FormFieldCardProps) {
    const Icon = fieldTypeIcons[field.type];
    const titleId = `field-${index}-label`;
    const helpTextId = `field-${index}-help`;

    return (
        <section
            className={cn(
                "group rounded-md border bg-background shadow-sm transition-all",
                selected ? "border-primary ring-2 ring-primary/10" : "border-border/70 hover:border-border",
                !field.enabled && "opacity-60",
            )}
            onClick={onSelect}
        >
            <div className="flex items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
                <GripVertical className="size-4" />
                <Icon className="size-4" />
                <span>题目 {index + 1}</span>
                <span>·</span>
                <span>{fieldTypeLabels[field.type]}</span>
                {field.required && <span className="text-destructive">必填</span>}
                {!field.enabled && <span>已禁用</span>}
                <div className="ml-auto hidden items-center gap-1 group-hover:flex">
                    <Button variant="ghost" size="icon" className="size-7" onClick={(event) => {
                        event.stopPropagation();
                        onDuplicate();
                    }} aria-label="复制题目">
                        <Copy className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={(event) => {
                        event.stopPropagation();
                        onRemove();
                    }} aria-label="删除题目">
                        <Trash2 className="size-3.5" />
                    </Button>
                </div>
            </div>

            <div className="space-y-4 p-4">
                <div className="grid gap-2">
                    <Label htmlFor={titleId} className="sr-only">字段标题</Label>
                    <Input
                        id={titleId}
                        name={`field_${index}_label`}
                        value={field.label}
                        placeholder="题目标题"
                        className="border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:ring-0 md:text-lg"
                        onChange={(event) => onUpdate({ label: event.target.value })}
                        onFocus={onSelect}
                    />
                    <Textarea
                        id={helpTextId}
                        name={`field_${index}_helpText`}
                        value={field.helpText || ""}
                        placeholder="补充说明，可留空"
                        rows={2}
                        className="min-h-10 resize-none border-0 bg-transparent px-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
                        onChange={(event) => onUpdate({ helpText: event.target.value })}
                        onFocus={onSelect}
                    />
                </div>

                {fieldHasOptions(field.type) ? (
                    <div className="space-y-2">
                        {(field.options ?? []).map((option, optionIndex) => (
                            <div key={`${option.value}-${optionIndex}`} className="flex items-center gap-2">
                                <span className={cn(
                                    "size-4 shrink-0 border",
                                    field.type === "checkbox" ? "rounded-sm" : "rounded-full",
                                )} />
                                <Label htmlFor={`field-${index}-option-${optionIndex}`} className="sr-only">
                                    选项 {optionIndex + 1}
                                </Label>
                                <Input
                                    id={`field-${index}-option-${optionIndex}`}
                                    name={`field_${index}_option_${optionIndex}`}
                                    value={option.label}
                                    placeholder={`选项 ${optionIndex + 1}`}
                                    onChange={(event) => onUpdateOption(optionIndex, event.target.value)}
                                    onFocus={onSelect}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onRemoveOption(optionIndex);
                                    }}
                                    aria-label="删除选项"
                                >
                                    <X className="size-4" />
                                </Button>
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={(event) => {
                                event.stopPropagation();
                                onAddOption();
                            }}
                        >
                            <Plus className="size-4" />
                            添加选项
                        </Button>
                    </div>
                    ) : (
                        <FieldPreviewInput field={field} index={index} />
                    )}
                </div>
            </section>
    );
}
