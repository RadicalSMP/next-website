"use client";

import {
    ArrowDown,
    ArrowUp,
    Copy,
    GripVertical,
    Plus,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollAreaFallback } from "./scroll-area-fallback";
import {
    advancedFieldTypes,
    commonFieldTypes,
    fieldTypeDescriptions,
    fieldTypeIcons,
    fieldTypeLabels,
} from "./constants";
import { FormField, FormFieldType } from "@/lib/forms";
import { cn } from "@/lib/utils";

type FormFieldOutlineProps = {
    fields: FormField[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    onAdd: (type?: FormFieldType) => void;
    onDuplicate: (index: number) => void;
    onRemove: (index: number) => void;
    onMove: (index: number, direction: -1 | 1) => void;
};

function FieldTypeMenu({ onAdd }: { onAdd: (type?: FormFieldType) => void }) {
    const renderType = (type: FormFieldType) => {
        const Icon = fieldTypeIcons[type];
        return (
            <DropdownMenuItem key={type} onClick={() => onAdd(type)} className="items-start gap-2">
                <Icon className="mt-0.5 size-4" />
                <span className="grid gap-0.5">
                    <span>{fieldTypeLabels[type]}</span>
                    <span className="text-xs text-muted-foreground">{fieldTypeDescriptions[type]}</span>
                </span>
            </DropdownMenuItem>
        );
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="sm" className="w-full">
                    <Plus className="size-4" />
                    新增题目
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel>常用字段</DropdownMenuLabel>
                {commonFieldTypes.map(renderType)}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>高级字段</DropdownMenuLabel>
                {advancedFieldTypes.map(renderType)}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function FormFieldOutline({
    fields,
    selectedIndex,
    onSelect,
    onAdd,
    onDuplicate,
    onRemove,
    onMove,
}: FormFieldOutlineProps) {
    return (
        <aside className="flex h-full min-h-0 flex-col border-r bg-muted/35">
            <div className="border-b p-3">
                <FieldTypeMenu onAdd={onAdd} />
            </div>
            <ScrollAreaFallback className="min-h-0 flex-1 p-2">
                <div className="space-y-1">
                    {fields.map((field, index) => {
                        const Icon = fieldTypeIcons[field.type];
                        return (
                            <div
                                key={`${field.key}-${index}`}
                                className={cn(
                                    "group rounded-md border bg-background/75 transition-colors",
                                    selectedIndex === index ? "border-primary shadow-sm" : "border-transparent hover:border-border",
                                    !field.enabled && "opacity-60",
                                )}
                            >
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
                                    onClick={() => onSelect(index)}
                                >
                                    <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">
                                            {field.label || `题目 ${index + 1}`}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {fieldTypeLabels[field.type]} · {field.key || "未设置 key"}
                                        </span>
                                    </span>
                                </button>
                                <div className="hidden items-center gap-1 border-t px-2 py-1 group-hover:flex">
                                    <Button variant="ghost" size="icon" className="size-7" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label="上移题目">
                                        <ArrowUp className="size-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="size-7" onClick={() => onMove(index, 1)} disabled={index === fields.length - 1} aria-label="下移题目">
                                        <ArrowDown className="size-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="size-7" onClick={() => onDuplicate(index)} aria-label="复制题目">
                                        <Copy className="size-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="ml-auto size-7 text-destructive hover:text-destructive" onClick={() => onRemove(index)} aria-label="删除题目">
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollAreaFallback>
        </aside>
    );
}
