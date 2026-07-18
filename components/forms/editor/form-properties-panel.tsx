"use client";

import {
    AlertCircle,
    Bell,
    CheckCircle2,
    CircleDot,
    ClipboardCheck,
    ExternalLink,
    ListChecks,
    Loader2,
    Plus,
    Search,
    Settings2,
    Sparkles,
    Trash2,
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
import {
    FormField,
    FormFieldType,
    FormResultConfig,
    FormSettings,
    FormVisibility,
    ResultGradingRule,
    ResultMatchStrategy,
    ResultNotificationTemplate,
    ResultRecipientSource,
    SubmissionProcessingStatus,
    isManualGradingField,
    isObjectiveGradingField,
} from "@/lib/forms";
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
    formId: string | null;
    selectedField: FormField | null;
    selectedIndex: number;
    fields: FormField[];
    fieldsLength: number;
    slug: string;
    visibility: FormVisibility;
    settings: FormSettings;
    resultConfig: FormResultConfig;
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
    onResultConfigChange: (updater: (prev: FormResultConfig) => FormResultConfig) => void;
    onApplyJoinApplicationPreset: () => void;
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
    const tabs: EditorPanel[] = ["field", "form", "result", "publish"];
    return (
        <div className="grid grid-cols-4 gap-1 rounded-md bg-muted p-1">
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

const NONE_VALUE = "__none";

const processingStatusLabels: Record<SubmissionProcessingStatus, string> = {
    not_required: "无需处理",
    pending: "待处理",
    approved: "已通过",
    rejected: "已拒绝",
    needs_changes: "需补充",
};

const notificationTemplateLabels: Record<Exclude<ResultNotificationTemplate, null>, string> = {
    join_application_result: "入服申请结果",
    score_result: "成绩结果",
    generic_result: "通用结果",
};

function selectableFields(fields: FormField[]) {
    return fields.filter((field) => field.key.trim().length > 0);
}

function fieldByKey(fields: FormField[], key: string) {
    return fields.find((field) => field.key === key) ?? null;
}

function defaultCorrectAnswer(field: FormField) {
    if (field.type === "checkbox") {
        return [];
    }
    if (field.type === "toggle") {
        return false;
    }
    if (field.type === "radio" || field.type === "select") {
        return field.options?.[0]?.value ?? "";
    }
    return null;
}

function createResultRule(field: FormField): ResultGradingRule {
    const gradingType = isObjectiveGradingField(field.type) ? "auto" : "manual";

    return {
        fieldKey: field.key,
        enabled: true,
        gradingType,
        correctAnswer: gradingType === "auto" ? defaultCorrectAnswer(field) : null,
        maxScore: 1,
        matchStrategy: "exact",
        requiredManual: gradingType === "manual",
        prompt: "",
    };
}

function chooseFirstGradableField(fields: FormField[]) {
    return selectableFields(fields).find((field) => isObjectiveGradingField(field.type) || isManualGradingField(field.type)) ?? null;
}

function resultFieldLabel(field: FormField | null, fallback: string) {
    if (!field) return fallback;
    return field.label || field.key || fallback;
}

function updateRuleField(rule: ResultGradingRule, field: FormField): ResultGradingRule {
    const gradingType = isObjectiveGradingField(field.type) ? "auto" : "manual";
    return {
        ...rule,
        fieldKey: field.key,
        gradingType,
        correctAnswer: gradingType === "auto" ? defaultCorrectAnswer(field) : null,
        matchStrategy: field.type === "checkbox" ? rule.matchStrategy : "exact",
        requiredManual: gradingType === "manual",
    };
}

function CorrectAnswerInput({
    field,
    rule,
    onRuleChange,
}: {
    field: FormField;
    rule: ResultGradingRule;
    onRuleChange: (updates: Partial<ResultGradingRule>) => void;
}) {
    if (field.type === "toggle") {
        return (
            <div className="flex items-center gap-2 rounded-md border p-2">
                <Checkbox
                    id={`result-answer-${field.key}`}
                    checked={rule.correctAnswer === true}
                    onCheckedChange={(checked) => onRuleChange({ correctAnswer: checked === true })}
                />
                <Label htmlFor={`result-answer-${field.key}`} className="text-sm font-normal">正确答案为开启</Label>
            </div>
        );
    }

    if (field.type === "checkbox") {
        const selected = Array.isArray(rule.correctAnswer) ? rule.correctAnswer.map(String) : [];
        return (
            <div className="grid gap-2 rounded-md border p-2">
                {(field.options ?? []).map((option, optionIndex) => {
                    const id = `result-answer-${field.key}-${optionIndex}`;
                    const checked = selected.includes(option.value);
                    return (
                        <div key={option.value} className="flex items-center gap-2">
                            <Checkbox
                                id={id}
                                checked={checked}
                                onCheckedChange={(nextChecked) => {
                                    onRuleChange({
                                        correctAnswer: nextChecked
                                            ? [...selected, option.value]
                                            : selected.filter((value) => value !== option.value),
                                    });
                                }}
                            />
                            <Label htmlFor={id} className="text-sm font-normal">{option.label}</Label>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <Select
            value={typeof rule.correctAnswer === "string" ? rule.correctAnswer : ""}
            onValueChange={(value) => onRuleChange({ correctAnswer: value })}
        >
            <SelectTrigger className="w-full">
                <SelectValue placeholder="选择正确答案" />
            </SelectTrigger>
            <SelectContent>
                {(field.options ?? []).map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function ResultSettingsPanel({
    fields,
    resultConfig,
    onResultConfigChange,
    onApplyJoinApplicationPreset,
}: Pick<FormPropertiesPanelProps,
    | "fields"
    | "resultConfig"
    | "onResultConfigChange"
    | "onApplyJoinApplicationPreset"
>) {
    const fieldsWithKeys = selectableFields(fields);
    const objectiveFields = fieldsWithKeys.filter((field) => isObjectiveGradingField(field.type));
    const manualFields = fieldsWithKeys.filter((field) => isManualGradingField(field.type));
    const gradableFields = fieldsWithKeys.filter((field) => isObjectiveGradingField(field.type) || isManualGradingField(field.type));
    const emailFields = fieldsWithKeys.filter((field) => field.type === "email" || /email|邮箱/i.test(`${field.key} ${field.label}`));
    const totalScore = resultConfig.grading.rules.reduce((sum, rule) => sum + Number(rule.maxScore || 0), 0);

    const updateRule = (index: number, updates: Partial<ResultGradingRule>) => {
        onResultConfigChange((prev) => ({
            ...prev,
            grading: {
                ...prev.grading,
                enabled: true,
                rules: prev.grading.rules.map((rule, ruleIndex) => (
                    ruleIndex === index ? { ...rule, ...updates } : rule
                )),
            },
        }));
    };

    const addRule = () => {
        const field = gradableFields.find((item) => !resultConfig.grading.rules.some((rule) => rule.fieldKey === item.key))
            ?? chooseFirstGradableField(fields);
        if (!field) return;
        onResultConfigChange((prev) => ({
            ...prev,
            grading: {
                ...prev.grading,
                enabled: true,
                rules: [...prev.grading.rules, createResultRule(field)],
            },
        }));
    };

    return (
        <div className="space-y-5">
            <div className="rounded-md border bg-muted/25 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <ClipboardCheck className="size-4 text-muted-foreground" />
                    结果收集
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                    提交会进入结果中心。批改、处理和通知都是可选能力。
                </p>
                <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={onApplyJoinApplicationPreset}>
                    <Sparkles className="size-4" />
                    应用入服申请预设
                </Button>
            </div>

            <div className="grid gap-3">
                <div className="grid gap-2">
                    <Label htmlFor="result-collection-label">结果标签</Label>
                    <Input
                        id="result-collection-label"
                        value={resultConfig.collection.label}
                        placeholder="问卷 / 测验 / 入服申请"
                        onChange={(event) => onResultConfigChange((prev) => ({
                            ...prev,
                            collection: { ...prev.collection, label: event.target.value },
                        }))}
                    />
                </div>
                <div className="flex items-center gap-2 rounded-md border p-3">
                    <Checkbox
                        id="result-allow-anonymous"
                        checked={resultConfig.collection.allowAnonymous}
                        onCheckedChange={(checked) => onResultConfigChange((prev) => ({
                            ...prev,
                            collection: { ...prev.collection, allowAnonymous: checked === true },
                        }))}
                    />
                    <Label htmlFor="result-allow-anonymous" className="text-sm font-normal">允许匿名结果</Label>
                </div>
            </div>

            <Separator />

            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <ListChecks className="size-4 text-muted-foreground" />
                            批改
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            客观题自动得分，主观题进入人工批改。
                        </p>
                    </div>
                    <Checkbox
                        aria-label="启用批改"
                        checked={resultConfig.grading.enabled}
                        onCheckedChange={(checked) => {
                            onResultConfigChange((prev) => {
                                if (checked !== true) {
                                    return { ...prev, grading: { ...prev.grading, enabled: false, mode: "none", rules: [] } };
                                }
                                const fallbackField = chooseFirstGradableField(fields);
                                return {
                                    ...prev,
                                    grading: {
                                        ...prev.grading,
                                        enabled: true,
                                        rules: prev.grading.rules.length > 0
                                            ? prev.grading.rules
                                            : fallbackField ? [createResultRule(fallbackField)] : [],
                                    },
                                };
                            });
                        }}
                    />
                </div>

                {resultConfig.grading.enabled && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                            <span className="text-muted-foreground">总分</span>
                            <span className="font-medium">{totalScore}</span>
                        </div>
                        {resultConfig.grading.rules.length === 0 ? (
                            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                                没有可批改题目。先添加单选、多选、下拉、开关或文本题。
                            </div>
                        ) : resultConfig.grading.rules.map((rule, index) => {
                            const field = fieldByKey(fields, rule.fieldKey);
                            const fieldOptions = rule.gradingType === "auto" ? objectiveFields : [...objectiveFields, ...manualFields];
                            return (
                                <div key={`${rule.fieldKey}-${index}`} className="space-y-3 rounded-md border p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">
                                                {resultFieldLabel(field, `规则 ${index + 1}`)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {rule.gradingType === "auto" ? "客观题自动批改" : "主观题人工批改"}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="size-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => onResultConfigChange((prev) => ({
                                                ...prev,
                                                grading: {
                                                    ...prev.grading,
                                                    rules: prev.grading.rules.filter((_, ruleIndex) => ruleIndex !== index),
                                                },
                                            }))}
                                            aria-label="删除批改规则"
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label className="text-xs text-muted-foreground">题目</Label>
                                        <Select
                                            value={rule.fieldKey}
                                            onValueChange={(value) => {
                                                const nextField = fieldByKey(fields, value);
                                                if (nextField) {
                                                    updateRule(index, updateRuleField(rule, nextField));
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {fieldOptions.map((item) => (
                                                    <SelectItem key={item.key} value={item.key}>
                                                        {item.label || item.key}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs text-muted-foreground">满分</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={rule.maxScore}
                                                onChange={(event) => updateRule(index, { maxScore: Number(event.target.value || 0) })}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs text-muted-foreground">方式</Label>
                                            <Select
                                                value={rule.gradingType}
                                                onValueChange={(value) => {
                                                    const nextType = value === "auto" ? "auto" : "manual";
                                                    if (!field) return;
                                                    updateRule(index, {
                                                        gradingType: nextType,
                                                        correctAnswer: nextType === "auto" ? defaultCorrectAnswer(field) : null,
                                                        requiredManual: nextType === "manual",
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {field && isObjectiveGradingField(field.type) && <SelectItem value="auto">自动</SelectItem>}
                                                    {field && isManualGradingField(field.type) && <SelectItem value="manual">人工</SelectItem>}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {field && rule.gradingType === "auto" && (
                                        <div className="grid gap-2">
                                            <Label className="text-xs text-muted-foreground">正确答案</Label>
                                            <CorrectAnswerInput field={field} rule={rule} onRuleChange={(updates) => updateRule(index, updates)} />
                                            {field.type === "checkbox" && (
                                                <Select
                                                    value={rule.matchStrategy}
                                                    onValueChange={(value) => updateRule(index, { matchStrategy: value as ResultMatchStrategy })}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="exact">完全匹配</SelectItem>
                                                        <SelectItem value="partial">部分给分</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                    )}

                                    {rule.gradingType === "manual" && (
                                        <div className="grid gap-2">
                                            <div className="flex items-center gap-2 rounded-md border p-2">
                                                <Checkbox
                                                    id={`manual-required-${index}`}
                                                    checked={rule.requiredManual}
                                                    onCheckedChange={(checked) => updateRule(index, { requiredManual: checked === true })}
                                                />
                                                <Label htmlFor={`manual-required-${index}`} className="text-sm font-normal">必批题</Label>
                                            </div>
                                            <Textarea
                                                value={rule.prompt}
                                                rows={2}
                                                placeholder="批改提示，可留空"
                                                onChange={(event) => updateRule(index, { prompt: event.target.value })}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <Button type="button" variant="outline" size="sm" className="w-full" onClick={addRule} disabled={gradableFields.length === 0}>
                            <Plus className="size-4" />
                            添加批改规则
                        </Button>
                    </div>
                )}
            </div>

            <Separator />

            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <div className="text-sm font-medium">处理状态</div>
                        <p className="mt-1 text-xs text-muted-foreground">用于入服申请、报名筛选等需要结论的结果。</p>
                    </div>
                    <Checkbox
                        aria-label="启用处理状态"
                        checked={resultConfig.processing.enabled}
                        onCheckedChange={(checked) => onResultConfigChange((prev) => ({
                            ...prev,
                            processing: { ...prev.processing, enabled: checked === true },
                        }))}
                    />
                </div>
                {resultConfig.processing.enabled && (
                    <div className="grid gap-2">
                        <Label className="text-xs text-muted-foreground">默认状态</Label>
                        <Select
                            value={resultConfig.processing.defaultStatus}
                            onValueChange={(value) => onResultConfigChange((prev) => ({
                                ...prev,
                                processing: { ...prev.processing, defaultStatus: value as SubmissionProcessingStatus },
                            }))}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {resultConfig.processing.statuses.map((status) => (
                                    <SelectItem key={status} value={status}>{processingStatusLabels[status]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            <Separator />

            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Bell className="size-4 text-muted-foreground" />
                            结果通知
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">默认手动发送，不会自动通知填写者。</p>
                    </div>
                    <Checkbox
                        aria-label="启用结果通知"
                        checked={resultConfig.notifications.enabled}
                        onCheckedChange={(checked) => onResultConfigChange((prev) => ({
                            ...prev,
                            notifications: {
                                ...prev.notifications,
                                enabled: checked === true,
                                template: checked === true
                                    ? (prev.notifications.template ?? "generic_result")
                                    : prev.notifications.template,
                            },
                        }))}
                    />
                </div>
                {resultConfig.notifications.enabled && (
                    <div className="space-y-3">
                        <div className="grid gap-2">
                            <Label className="text-xs text-muted-foreground">模板</Label>
                            <Select
                                value={resultConfig.notifications.template ?? "generic_result"}
                                onValueChange={(value) => onResultConfigChange((prev) => ({
                                    ...prev,
                                    notifications: {
                                        ...prev.notifications,
                                        template: value as Exclude<ResultNotificationTemplate, null>,
                                    },
                                }))}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(notificationTemplateLabels).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs text-muted-foreground">收件人来源</Label>
                            <Select
                                value={resultConfig.notifications.recipient.source}
                                onValueChange={(value) => onResultConfigChange((prev) => ({
                                    ...prev,
                                    notifications: {
                                        ...prev.notifications,
                                        recipient: {
                                            source: value as ResultRecipientSource,
                                            fieldKey: value === "mapped_field" ? prev.notifications.recipient.fieldKey : null,
                                        },
                                    },
                                }))}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="mapped_field">表单邮箱字段</SelectItem>
                                    <SelectItem value="account_email">账号邮箱</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {resultConfig.notifications.recipient.source === "mapped_field" && (
                            <div className="grid gap-2">
                                <Label className="text-xs text-muted-foreground">邮箱字段</Label>
                                <Select
                                    value={resultConfig.notifications.recipient.fieldKey ?? NONE_VALUE}
                                    onValueChange={(value) => onResultConfigChange((prev) => ({
                                        ...prev,
                                        notifications: {
                                            ...prev.notifications,
                                            recipient: {
                                                ...prev.notifications.recipient,
                                                fieldKey: value === NONE_VALUE ? null : value,
                                            },
                                        },
                                    }))}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NONE_VALUE}>未选择</SelectItem>
                                        {(emailFields.length > 0 ? emailFields : fieldsWithKeys).map((field) => (
                                            <SelectItem key={field.key} value={field.key}>{field.label || field.key}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="space-y-3 rounded-md border p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <Label htmlFor="notification-auto-send" className="text-sm">自动发送</Label>
                                    <p className="mt-1 text-xs text-muted-foreground">业务状态变化后自动投递，失败不会回滚结果。</p>
                                </div>
                                <Checkbox
                                    id="notification-auto-send"
                                    checked={resultConfig.notifications.autoSend}
                                    onCheckedChange={(checked) => onResultConfigChange((prev) => ({
                                        ...prev,
                                        notifications: {
                                            ...prev.notifications,
                                            autoSend: checked === true,
                                        },
                                    }))}
                                />
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">触发时机</Label>
                                {([
                                    ["revisionRequested", "请求补交", false],
                                    ["gradingCompleted", "批改完成", !resultConfig.grading.enabled],
                                    ["processingChanged", "处理结果变化", !resultConfig.processing.enabled],
                                ] as const).map(([key, label, capabilityDisabled]) => (
                                    <div key={key} className="flex items-center gap-2">
                                        <Checkbox
                                            id={`notification-event-${key}`}
                                            checked={resultConfig.notifications.events[key]}
                                            disabled={!resultConfig.notifications.autoSend || capabilityDisabled}
                                            onCheckedChange={(checked) => onResultConfigChange((prev) => ({
                                                ...prev,
                                                notifications: {
                                                    ...prev.notifications,
                                                    events: {
                                                        ...prev.notifications.events,
                                                        [key]: checked === true,
                                                    },
                                                },
                                            }))}
                                        />
                                        <Label
                                            htmlFor={`notification-event-${key}`}
                                            className="text-sm font-normal"
                                        >
                                            {label}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3 rounded-md border p-3">
                            <Label className="text-xs text-muted-foreground">成绩邮件内容</Label>
                            {([
                                ["includeQuestionScores", "逐题得分"],
                                ["includeComments", "批改评语"],
                                ["includeCorrectAnswers", "正确答案"],
                            ] as const).map(([key, label]) => (
                                <div key={key} className="flex items-center gap-2">
                                    <Checkbox
                                        id={`notification-content-${key}`}
                                        checked={resultConfig.notifications.content[key]}
                                        disabled={!resultConfig.grading.enabled}
                                        onCheckedChange={(checked) => onResultConfigChange((prev) => ({
                                            ...prev,
                                            notifications: {
                                                ...prev.notifications,
                                                content: {
                                                    ...prev.notifications.content,
                                                    [key]: checked === true,
                                                },
                                            },
                                        }))}
                                    />
                                    <Label
                                        htmlFor={`notification-content-${key}`}
                                        className="text-sm font-normal"
                                    >
                                        {label}
                                    </Label>
                                </div>
                            ))}
                            <div className="flex gap-2 text-xs text-amber-700 dark:text-amber-300">
                                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                                <span>发送正确答案可能造成题库泄露，默认保持关闭。</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Separator />

            <div className="space-y-3">
                <div>
                    <div className="text-sm font-medium">字段映射</div>
                    <p className="mt-1 text-xs text-muted-foreground">映射后的字段会用于结果详情、通知和入服申请展示。</p>
                </div>
                {([
                    ["email", "邮箱"],
                    ["playerName", "玩家名"],
                    ["qq", "QQ"],
                    ["mcid", "Minecraft ID"],
                ] as const).map(([key, label]) => (
                    <div key={key} className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">{label}</Label>
                        <Select
                            value={resultConfig.fieldMappings[key] ?? NONE_VALUE}
                            onValueChange={(value) => onResultConfigChange((prev) => ({
                                ...prev,
                                fieldMappings: {
                                    ...prev.fieldMappings,
                                    [key]: value === NONE_VALUE ? null : value,
                                },
                            }))}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE_VALUE}>未映射</SelectItem>
                                {fieldsWithKeys.map((field) => (
                                    <SelectItem key={field.key} value={field.key}>{field.label || field.key}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PublishPanel({
    formId,
    publishIssues,
    versions,
    currentVersion,
    publishedAt,
    onSelectIssue,
}: Pick<FormPropertiesPanelProps,
    | "formId"
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

            {formId && (
                <Button variant="outline" className="w-full" asChild>
                    <Link href={`/dashboard/forms/${formId}/view`} target="_blank">
                        <ExternalLink className="size-4" />
                        预览草稿
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
                {panel === "result" && (
                    <ResultSettingsPanel {...props} />
                )}
                {panel === "publish" && (
                    <PublishPanel {...props} />
                )}
            </div>
        </aside>
    );
}
