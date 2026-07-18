"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormFieldType } from "@/lib/forms";
import { FormFieldCard } from "./form-field-card";

type FormCanvasProps = {
    title: string;
    description: string;
    fields: FormField[];
    selectedIndex: number;
    onTitleChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onSelectField: (index: number) => void;
    onUpdateField: (index: number, updates: Partial<FormField>) => void;
    onDuplicateField: (index: number) => void;
    onRemoveField: (index: number) => void;
    onAddField: (type?: FormFieldType) => void;
    onAddOption: (fieldIndex: number) => void;
    onUpdateOption: (fieldIndex: number, optionIndex: number, label: string) => void;
    onRemoveOption: (fieldIndex: number, optionIndex: number) => void;
};

export function FormCanvas({
    title,
    description,
    fields,
    selectedIndex,
    onTitleChange,
    onDescriptionChange,
    onSelectField,
    onUpdateField,
    onDuplicateField,
    onRemoveField,
    onAddField,
    onAddOption,
    onUpdateOption,
    onRemoveOption,
}: FormCanvasProps) {
    const titleId = "form-editor-title";
    const descriptionId = "form-editor-description";

    return (
        <main className="min-w-0 flex-1 overflow-auto bg-muted/40">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6 lg:py-8">
                <section className="rounded-md border bg-background p-5 shadow-sm sm:p-7">
                    <Label htmlFor={titleId} className="sr-only">
                        表单标题
                    </Label>
                    <Input
                        id={titleId}
                        name="title"
                        value={title}
                        placeholder="未命名表单"
                        className="h-auto border-0 bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 sm:text-3xl"
                        onChange={(event) => onTitleChange(event.target.value)}
                    />
                    <Label htmlFor={descriptionId} className="sr-only">
                        表单描述
                    </Label>
                    <Textarea
                        id={descriptionId}
                        name="description"
                        value={description}
                        placeholder="向填写者说明这个表单的用途，可留空"
                        rows={3}
                        className="mt-2 resize-none border-0 bg-transparent px-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
                        onChange={(event) => onDescriptionChange(event.target.value)}
                    />
                </section>

                {fields.map((field, index) => (
                    <FormFieldCard
                        key={`${field.key}-${index}`}
                        field={field}
                        index={index}
                        selected={selectedIndex === index}
                        onSelect={() => onSelectField(index)}
                        onUpdate={(updates) => onUpdateField(index, updates)}
                        onDuplicate={() => onDuplicateField(index)}
                        onRemove={() => onRemoveField(index)}
                        onAddOption={() => onAddOption(index)}
                        onUpdateOption={(optionIndex, label) => onUpdateOption(index, optionIndex, label)}
                        onRemoveOption={(optionIndex) => onRemoveOption(index, optionIndex)}
                    />
                ))}

                <div className="flex justify-center pb-10 pt-1">
                    <Button variant="outline" onClick={() => onAddField()}>
                        <Plus className="size-4" />
                        添加题目
                    </Button>
                </div>
            </div>
        </main>
    );
}
