"use client";

import {
    AlertCircle,
    CheckCircle2,
    CircleDot,
    ExternalLink,
    Loader2,
    Search,
    Settings2,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormFieldType, FormSettings, FormVisibility } from "@/lib/forms";
import { cn } from "@/lib/utils";
import {
    advancedFieldTypes,
    commonFieldTypes,
    fieldHasOptions,
    fieldTypeDescriptions,
    fieldTypeIcons,
    fieldTypeLabels,
    panelLabels,
} from "./constants";
import { AllowedUser, EditorPanel, PublishIssue } from "./types";
import { formatDateTime } from "./utils";

type FormPropertiesPanelProps = {
    panel: EditorPanel;
    onPanelChange: (panel: EditorPanel) => void;
    selectedField: FormField | null;
    selectedIndex: number;
    fieldsLength: number;
    slug: string;
    visibility: FormVisibility;
    settings: FormSettings;
    allowedUserIds: string[];
    allowedUsers: AllowedUser[];
    memberSearchQuery: string;
    memberSearchResults: AllowedUser[];
    memberSearching: boolean;
    publishIssues: PublishIssue[];
    versions: Array<{ id: string; version: number; published_at: string }>;
    currentVersion: number | null;
    publishedAt: string | null;
    onSlugChange: (value: string) => void;
    onVisibilityChange: (value: FormVisibility) => void;
    onSettingsChange: (updater: (prev: FormSettings) => FormSettings) => void;
    onFieldUpdate: (index: number, updates: Partial<FormField>) => void;
    onMemberQueryChange: (value: string) => void;
    onAddMember: (user: AllowedUser) => void;
    onRemoveMember: (userId: string) => void;
    onSelectIssue: (issue: PublishIssue) => void;
};

function PanelTabs({
    value,
    onChange,
}: {
    value: EditorPanel;
    onChange: (panel: EditorPanel) => void;
}) {
    const tabs: EditorPanel[] = ["field", "form", "publish"];
    return (
        <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
            {tabs.map((tab) => (
                <button
                    key={tab}
                    type="button"
                    className={cn(
                        "rounded-sm px-2 py-1.5 text-xs font-medium transition-colors",
                        value === tab ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => onChange(tab)}
                >
                    {panelLabels[tab]}
                </button>
            ))}
        </div>
    );
}

function FieldTypeSelect({
    id,
    labelId,
    name,
    value,
    onValueChange,
}: {
    id: string;
    labelId: string;
    name: string;
    value: FormFieldType;
    onValueChange: (value: FormFieldType) => void;
}) {
    const renderItem = (type: FormFieldType) => {
        const Icon = fieldTypeIcons[type];
        return (
            <SelectItem key={type} value={type}>
                <span className="flex items-center gap-2">
                    <Icon className="size-4 text-muted-foreground" />
                    {fieldTypeLabels[type]}
                </span>
            </SelectItem>
        );
    };

    return (
        <Select name={name} value={value} onValueChange={(next) => onValueChange(next as FormFieldType)}>
            <SelectTrigger id={id} aria-labelledby={labelId} className="w-full">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">常用字段</div>
                {commonFieldTypes.map(renderItem)}
                <Separator className="my-1" />
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">高级字段</div>
                {advancedFieldTypes.map(renderItem)}
            </SelectContent>
        </Select>
    );
}

function FieldPanel({
    field,
    index,
    fieldsLength,
    onFieldUpdate,
}: {
    field: FormField | null;
    index: number;
    fieldsLength: number;
    onFieldUpdate: (index: number, updates: Partial<FormField>) => void;
}) {
    if (!field) {
        return (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                选择一个题目后编辑属性。
            </div>
        );
    }

    const Icon = fieldTypeIcons[field.type];
    const fieldPrefix = `field-properties-${index}`;
    const typeLabelId = `${fieldPrefix}-type-label`;
    const typeId = `${fieldPrefix}-type`;
    const keyId = `${fieldPrefix}-key`;
    const placeholderId = `${fieldPrefix}-placeholder`;
    const defaultValueId = `${fieldPrefix}-default-value`;
    const defaultToggleId = `${fieldPrefix}-default-toggle`;
    const requiredId = `${fieldPrefix}-required`;
    const enabledId = `${fieldPrefix}-enabled`;
    const minLengthId = `${fieldPrefix}-min-length`;
    const maxLengthId = `${fieldPrefix}-max-length`;
    const minValueId = `${fieldPrefix}-min-value`;
    const maxValueId = `${fieldPrefix}-max-value`;

    return (
        <div className="space-y-4">
            <div className="rounded-md border bg-muted/25 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4 text-muted-foreground" />
                    题目 {index + 1} / {fieldsLength}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                    {fieldTypeDescriptions[field.type]}
                </p>
            </div>

            <div className="grid gap-2">
                <Label id={typeLabelId} htmlFor={typeId}>字段类型</Label>
                <FieldTypeSelect
                    id={typeId}
                    labelId={typeLabelId}
                    name={`${fieldPrefix}-type`}
                    value={field.type}
                    onValueChange={(value) => onFieldUpdate(index, { type: value })}
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor={keyId}>字段 key</Label>
                <Input
                    id={keyId}
                    name={`${fieldPrefix}-key`}
                    value={field.key}
                    placeholder="field_key"
                    onChange={(event) => onFieldUpdate(index, { key: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                    key 用于提交数据和导出列名，发布后请谨慎修改。
                </p>
            </div>

            <div className="grid gap-2">
                <Label htmlFor={placeholderId}>占位提示</Label>
                <Input
                    id={placeholderId}
                    name={`${fieldPrefix}-placeholder`}
                    value={field.placeholder || ""}
                    placeholder="填写提示"
                    onChange={(event) => onFieldUpdate(index, { placeholder: event.target.value })}
                />
            </div>

            {!fieldHasOptions(field.type) && field.type !== "toggle" && (
                <div className="grid gap-2">
                    <Label htmlFor={defaultValueId}>默认值</Label>
                    <Input
                        id={defaultValueId}
                        name={`${fieldPrefix}-default-value`}
                        value={typeof field.defaultValue === "string" || typeof field.defaultValue === "number" ? String(field.defaultValue) : ""}
                        placeholder="可留空"
                        onChange={(event) => onFieldUpdate(index, { defaultValue: event.target.value })}
                    />
                </div>
            )}

            {field.type === "toggle" && (
                <div className="flex items-center gap-2 rounded-md border p-3">
                    <Checkbox
                        id={defaultToggleId}
                        name={`${fieldPrefix}-default-toggle`}
                        aria-label="默认开启"
                        checked={field.defaultValue === true}
                        onCheckedChange={(checked) => onFieldUpdate(index, { defaultValue: checked === true })}
                    />
                    <Label htmlFor={defaultToggleId}>默认开启</Label>
                </div>
            )}

            <div className="grid gap-3 rounded-md border p-3">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={requiredId}
                        name={`${fieldPrefix}-required`}
                        aria-label="必填"
                        checked={field.required}
                        onCheckedChange={(checked) => onFieldUpdate(index, { required: checked === true })}
                    />
                    <Label htmlFor={requiredId}>必填</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={enabledId}
                        name={`${fieldPrefix}-enabled`}
                        aria-label="启用字段"
                        checked={field.enabled}
                        onCheckedChange={(checked) => onFieldUpdate(index, { enabled: checked === true })}
                    />
                    <Label htmlFor={enabledId}>启用字段</Label>
                </div>
            </div>

            {(field.type === "text" || field.type === "textarea" || field.type === "email" || field.type === "qq" || field.type === "mcid") && (
                <div className="grid gap-3">
                    <p className="text-sm font-medium">长度限制</p>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor={minLengthId} className="text-xs text-muted-foreground">最短</Label>
                            <Input
                                id={minLengthId}
                                name={`${fieldPrefix}-min-length`}
                                type="number"
                                value={field.validation?.minLength ?? ""}
                                placeholder="最短"
                                onChange={(event) => onFieldUpdate(index, {
                                    validation: {
                                        ...field.validation,
                                        minLength: event.target.value ? Number(event.target.value) : undefined,
                                    },
                                })}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor={maxLengthId} className="text-xs text-muted-foreground">最长</Label>
                            <Input
                                id={maxLengthId}
                                name={`${fieldPrefix}-max-length`}
                                type="number"
                                value={field.validation?.maxLength ?? ""}
                                placeholder="最长"
                                onChange={(event) => onFieldUpdate(index, {
                                    validation: {
                                        ...field.validation,
                                        maxLength: event.target.value ? Number(event.target.value) : undefined,
                                    },
                                })}
                            />
                        </div>
                    </div>
                </div>
            )}

            {field.type === "number" && (
                <div className="grid gap-3">
                    <p className="text-sm font-medium">数值范围</p>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor={minValueId} className="text-xs text-muted-foreground">最小</Label>
                            <Input
                                id={minValueId}
                                name={`${fieldPrefix}-min-value`}
                                type="number"
                                value={field.validation?.min ?? ""}
                                placeholder="最小"
                                onChange={(event) => onFieldUpdate(index, {
                                    validation: {
                                        ...field.validation,
                                        min: event.target.value ? Number(event.target.value) : undefined,
                                    },
                                })}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor={maxValueId} className="text-xs text-muted-foreground">最大</Label>
                            <Input
                                id={maxValueId}
                                name={`${fieldPrefix}-max-value`}
                                type="number"
                                value={field.validation?.max ?? ""}
                                placeholder="最大"
                                onChange={(event) => onFieldUpdate(index, {
                                    validation: {
                                        ...field.validation,
                                        max: event.target.value ? Number(event.target.value) : undefined,
                                    },
                                })}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function FormSettingsPanel({
    slug,
    visibility,
    settings,
    allowedUserIds,
    allowedUsers,
    memberSearchQuery,
    memberSearchResults,
    memberSearching,
    onSlugChange,
    onVisibilityChange,
    onSettingsChange,
    onMemberQueryChange,
    onAddMember,
    onRemoveMember,
}: Pick<FormPropertiesPanelProps,
    | "slug"
    | "visibility"
    | "settings"
    | "allowedUserIds"
    | "allowedUsers"
    | "memberSearchQuery"
    | "memberSearchResults"
    | "memberSearching"
    | "onSlugChange"
    | "onVisibilityChange"
    | "onSettingsChange"
    | "onMemberQueryChange"
    | "onAddMember"
    | "onRemoveMember"
>) {
    const slugId = "form-settings-slug";
    const visibilityLabelId = "form-settings-visibility-label";
    const visibilityId = "form-settings-visibility";
    const memberSearchId = "form-settings-member-search";
    const submitLabelId = "form-settings-submit-label";
    const successMessageId = "form-settings-success-message";
    const introTextId = "form-settings-intro-text";

    return (
        <div className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor={slugId}>访问标识</Label>
                <Input
                    id={slugId}
                    name="form-settings-slug"
                    value={slug}
                    placeholder="activity-signup"
                    onChange={(event) => onSlugChange(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">公开地址：/forms/{slug || "..."}</p>
            </div>

            <div className="grid gap-2">
                <Label id={visibilityLabelId} htmlFor={visibilityId}>可见性</Label>
                <Select name="form-settings-visibility" value={visibility} onValueChange={(value) => onVisibilityChange(value as FormVisibility)}>
                    <SelectTrigger id={visibilityId} aria-labelledby={visibilityLabelId} className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="public">公开填写</SelectItem>
                        <SelectItem value="authenticated">登录后填写</SelectItem>
                        <SelectItem value="members">指定成员填写</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {visibility === "members" && (
                <div className="grid gap-3 rounded-md border p-3">
                    <div className="flex flex-wrap gap-2">
                        {allowedUsers.length === 0 ? (
                            <p className="text-xs text-muted-foreground">尚未选择成员</p>
                        ) : allowedUsers.map((user) => (
                            <Badge key={user.id} variant="secondary" className="gap-1 pr-1">
                                {user.name}
                                <button
                                    type="button"
                                    className="ml-1 text-muted-foreground hover:text-destructive"
                                    aria-label={`移除成员 ${user.name}`}
                                    onClick={() => onRemoveMember(user.id)}
                                >
                                    ×
                                </button>
                            </Badge>
                        ))}
                    </div>
                    <div className="relative">
                        <Label htmlFor={memberSearchId} className="sr-only">搜索用户名或邮箱</Label>
                        <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            id={memberSearchId}
                            name="form-settings-member-search"
                            value={memberSearchQuery}
                            placeholder="搜索用户名或邮箱"
                            className="pl-8"
                            onChange={(event) => onMemberQueryChange(event.target.value)}
                        />
                    </div>
                    <div className="max-h-48 space-y-1 overflow-auto">
                        {memberSearching ? (
                            <div className="flex justify-center py-3">
                                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                            </div>
                        ) : memberSearchResults.length === 0 ? (
                            <p className="py-2 text-center text-xs text-muted-foreground">输入关键字搜索成员</p>
                        ) : memberSearchResults.map((user) => {
                            const selected = allowedUserIds.includes(user.id);
                            return (
                                <button
                                    key={user.id}
                                    type="button"
                                    className={cn(
                                        "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors",
                                        selected ? "bg-primary/10 text-primary" : "hover:bg-muted",
                                    )}
                                    onClick={() => selected ? onRemoveMember(user.id) : onAddMember(user)}
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate font-medium">{user.name}</span>
                                        <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                                    </span>
                                    {selected && <Badge variant="secondary">已选</Badge>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="grid gap-2">
                <Label htmlFor={submitLabelId}>提交按钮文本</Label>
                <Input
                    id={submitLabelId}
                    name="form-settings-submit-label"
                    value={settings.submitLabel}
                    onChange={(event) => onSettingsChange((prev) => ({ ...prev, submitLabel: event.target.value }))}
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor={successMessageId}>提交成功提示</Label>
                <Textarea
                    id={successMessageId}
                    name="form-settings-success-message"
                    value={settings.successMessage}
                    rows={3}
                    onChange={(event) => onSettingsChange((prev) => ({ ...prev, successMessage: event.target.value }))}
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor={introTextId}>表单说明</Label>
                <Textarea
                    id={introTextId}
                    name="form-settings-intro-text"
                    value={settings.introText}
                    rows={3}
                    placeholder="显示在填写页开头，可留空"
                    onChange={(event) => onSettingsChange((prev) => ({ ...prev, introText: event.target.value }))}
                />
            </div>
        </div>
    );
}

function PublishPanel({
    slug,
    publishIssues,
    versions,
    currentVersion,
    publishedAt,
    onSelectIssue,
}: Pick<FormPropertiesPanelProps,
    | "slug"
    | "publishIssues"
    | "versions"
    | "currentVersion"
    | "publishedAt"
    | "onSelectIssue"
>) {
    const errors = publishIssues.filter((issue) => issue.severity === "error");

    return (
        <div className="space-y-4">
            <div className={cn(
                "rounded-md border p-3",
                errors.length === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" : "border-destructive/25 bg-destructive/5",
            )}>
                <div className="flex items-center gap-2 text-sm font-medium">
                    {errors.length === 0 ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4 text-destructive" />}
                    {errors.length === 0 ? "可以发布" : `${errors.length} 项需要处理`}
                </div>
                <p className="mt-1 text-xs opacity-80">
                    发布会生成一个只读版本，公开填写页读取已发布版本。
                </p>
            </div>

            <div className="space-y-2">
                {publishIssues.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        所有发布检查已通过
                    </div>
                ) : publishIssues.map((issue) => (
                    <button
                        key={issue.id}
                        type="button"
                        className="flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                        onClick={() => onSelectIssue(issue)}
                    >
                        {issue.severity === "error" ? (
                            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                        ) : (
                            <CircleDot className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0">
                            <span className="block font-medium">{issue.label}</span>
                            <span className="block text-xs text-muted-foreground">{issue.detail}</span>
                        </span>
                    </button>
                ))}
            </div>

            {slug && (
                <Button variant="outline" className="w-full" asChild>
                    <Link href={`/forms/${slug}`} target="_blank">
                        <ExternalLink className="size-4" />
                        打开公开预览
                    </Link>
                </Button>
            )}

            <Separator />

            <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Settings2 className="size-4 text-muted-foreground" />
                    发布记录
                </div>
                {currentVersion && (
                    <p className="text-xs text-muted-foreground">
                        当前线上版本 v{currentVersion}，最近发布：{formatDateTime(publishedAt)}
                    </p>
                )}
                {versions.length === 0 ? (
                    <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        暂无发布记录。
                    </p>
                ) : versions.map((version) => (
                    <div key={version.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <span>v{version.version}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(version.published_at)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function FormPropertiesPanel(props: FormPropertiesPanelProps) {
    const {
        panel,
        onPanelChange,
        selectedField,
        selectedIndex,
        fieldsLength,
        onFieldUpdate,
    } = props;

    return (
        <aside className="flex h-full min-h-0 flex-col border-l bg-background">
            <div className="border-b p-3">
                <PanelTabs value={panel} onChange={onPanelChange} />
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
                {panel === "field" && (
                    <FieldPanel
                        field={selectedField}
                        index={selectedIndex}
                        fieldsLength={fieldsLength}
                        onFieldUpdate={onFieldUpdate}
                    />
                )}
                {panel === "form" && (
                    <FormSettingsPanel {...props} />
                )}
                {panel === "publish" && (
                    <PublishPanel {...props} />
                )}
            </div>
        </aside>
    );
}
