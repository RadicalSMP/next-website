"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    Copy,
    Eye,
    GripVertical,
    Loader2,
    Plus,
    Rocket,
    Save,
    Settings2,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
    FormField,
    FormFieldType,
    FormSettings,
    createEmptyFormField,
    cloneFormField,
    DEFAULT_FORM_SETTINGS,
    slugifyFormKey,
} from "@/lib/forms";
import { cn } from "@/lib/utils";

type FormBuilderProps = {
    mode: "create" | "edit";
    formId?: string;
};

type AllowedUser = {
    id: string;
    name: string;
    email: string;
    image: string | null;
};

const fieldTypeLabels: Record<FormFieldType, string> = {
    text: "单行文本",
    textarea: "多行文本",
    number: "数字",
    radio: "单选",
    checkbox: "多选",
    select: "下拉",
    toggle: "开关",
    date: "日期",
    email: "邮箱",
    qq: "QQ",
    mcid: "Minecraft ID",
};

const selectableTypes: FormFieldType[] = [
    "text",
    "textarea",
    "number",
    "radio",
    "checkbox",
    "select",
    "toggle",
    "date",
    "email",
    "qq",
    "mcid",
];

function emptyField(index = 0): FormField {
    return createEmptyFormField(index);
}

function normalizeOptionsText(field: FormField) {
    return (field.options ?? []).map((option) => option.label).join("\n");
}

function optionsFromText(value: string) {
    return value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => ({ label: item, value: item }));
}

function fieldHasOptions(type: FormFieldType) {
    return type === "radio" || type === "checkbox" || type === "select";
}

function formatDate(value: string | null | undefined) {
    if (!value) return "暂无";
    return new Date(value).toLocaleString("zh-CN");
}

export function FormBuilder({ mode, formId }: FormBuilderProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(mode === "edit");
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [slug, setSlug] = useState("");
    const [visibility, setVisibility] = useState("public");
    const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
    const [fields, setFields] = useState<FormField[]>([emptyField()]);
    const [settings, setSettings] = useState<FormSettings>({ ...DEFAULT_FORM_SETTINGS });
    const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
    const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [memberSearchResults, setMemberSearchResults] = useState<AllowedUser[]>([]);
    const [memberSearching, setMemberSearching] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [versions, setVersions] = useState<Array<{ id: string; version: number; published_at: string }>>([]);
    const [currentVersion, setCurrentVersion] = useState<number | null>(null);
    const [publishedAt, setPublishedAt] = useState<string | null>(null);

    const selectedField = fields[selectedIndex] ?? fields[0];

    const fetchForm = useCallback(async () => {
        if (mode !== "edit" || !formId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/forms/${formId}`);
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "表单不存在");
                router.push("/dashboard/forms");
                return;
            }

            const form = data.form;
            const draft = form.draft_payload || {};
            setTitle(form.title || "");
            setDescription(form.description || "");
            setSlug(form.slug || "");
            setVisibility(form.visibility || "public");
            setStatus(form.status || "draft");
            setAllowedUserIds(form.allowed_user_ids || []);
            setAllowedUsers(data.allowedUsers || []);
            setFields(Array.isArray(draft.fields) && draft.fields.length > 0 ? draft.fields : [emptyField()]);
            setSettings({ ...DEFAULT_FORM_SETTINGS, ...(draft.settings || {}) });
            setVersions(data.versions || []);
            setCurrentVersion(form.current_version ?? null);
            setPublishedAt(form.published_at ?? null);
        } catch {
            toast.error("加载表单失败");
        } finally {
            setLoading(false);
        }
    }, [formId, mode, router]);

    useEffect(() => {
        fetchForm();
    }, [fetchForm]);

    const searchUsers = useCallback(async (query: string) => {
        if (!query.trim()) {
            setMemberSearchResults([]);
            return;
        }
        setMemberSearching(true);
        try {
            const res = await fetch(`/api/users?search=${encodeURIComponent(query)}&limit=10`);
            const data = await res.json();
            if (res.ok) {
                setMemberSearchResults(data.users || []);
            }
        } catch {
            setMemberSearchResults([]);
        } finally {
            setMemberSearching(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => searchUsers(memberSearchQuery), 250);
        return () => clearTimeout(timer);
    }, [memberSearchQuery, searchUsers]);

    const addMember = (user: AllowedUser) => {
        if (!allowedUserIds.includes(user.id)) {
            setAllowedUserIds((prev) => [...prev, user.id]);
            setAllowedUsers((prev) => [...prev, user]);
        }
    };

    const removeMember = (userId: string) => {
        setAllowedUserIds((prev) => prev.filter((id) => id !== userId));
        setAllowedUsers((prev) => prev.filter((user) => user.id !== userId));
    };

    const updateField = (index: number, updates: Partial<FormField>) => {
        setFields((prev) => {
            const next = prev.map((field, fieldIndex) => (
                fieldIndex === index ? { ...field, ...updates } : field
            ));
            return next;
        });
    };

    const addField = () => {
        setFields((prev) => {
            const next = [...prev, emptyField(prev.length)];
            setSelectedIndex(next.length - 1);
            return next;
        });
    };

    const duplicateField = (index: number) => {
        setFields((prev) => {
            const source = prev[index];
            if (!source) return prev;
            const copy = {
                ...cloneFormField(source),
                key: `${source.key}_copy_${Date.now().toString(36)}`,
                label: `${source.label || "未命名字段"} 副本`,
            };
            const next = [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
            setSelectedIndex(index + 1);
            return next;
        });
    };

    const removeField = (index: number) => {
        setFields((prev) => {
            if (prev.length === 1) {
                toast.error("至少保留一个字段");
                return prev;
            }
            const next = prev.filter((_, fieldIndex) => fieldIndex !== index);
            setSelectedIndex(Math.max(0, Math.min(index, next.length - 1)));
            return next;
        });
    };

    const moveField = (index: number, direction: -1 | 1) => {
        setFields((prev) => {
            const target = index + direction;
            if (target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];
            setSelectedIndex(target);
            return next;
        });
    };

    const payload = useMemo(() => ({
        title,
        description: description.trim() || null,
        slug,
        visibility,
        status,
        allowedUserIds,
        fields,
        settings,
    }), [allowedUserIds, description, fields, settings, slug, status, title, visibility]);

    const saveForm = async (navigateAfterSave = true) => {
        setSaving(true);
        try {
            const res = await fetch(mode === "create" ? "/api/forms" : `/api/forms/${formId}`, {
                method: mode === "create" ? "POST" : "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "保存失败");
                return null;
            }
            toast.success(mode === "create" ? "表单草稿已创建" : "表单草稿已保存");
            if (mode === "create" && navigateAfterSave) {
                router.push(`/dashboard/forms/${data.form.id}/edit`);
            } else if (mode === "edit") {
                fetchForm();
            }
            return data.form.id as string;
        } catch {
            toast.error("保存失败");
            return null;
        } finally {
            setSaving(false);
        }
    };

    const publishForm = async () => {
        let targetId = formId;
        if (mode === "create") {
            targetId = (await saveForm(false)) ?? undefined;
        } else {
            const savedId = await saveForm(false);
            targetId = savedId ?? formId;
        }
        if (!targetId) return;

        setPublishing(true);
        try {
            const res = await fetch(`/api/forms/${targetId}/publish`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "发布失败");
                return;
            }
            toast.success(`已发布版本 v${data.version.version}`);
            router.push(`/dashboard/forms/${targetId}/edit`);
            fetchForm();
        } catch {
            toast.error("发布失败");
        } finally {
            setPublishing(false);
        }
    };

    const selectedPreview = selectedField ? (
        <div className="rounded-md border bg-background p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                    <Label className="text-base">
                        {selectedField.label || "未命名字段"}
                        {selectedField.required && <span className="ml-1 text-destructive">*</span>}
                    </Label>
                    {selectedField.helpText && (
                        <p className="mt-1 text-sm text-muted-foreground">{selectedField.helpText}</p>
                    )}
                </div>
                {!selectedField.enabled && <Badge variant="secondary">已禁用</Badge>}
            </div>
            {fieldHasOptions(selectedField.type) ? (
                <div className="grid gap-2">
                    {(selectedField.options ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">暂无选项</p>
                    ) : (
                        selectedField.options?.map((option) => (
                            <div key={option.value} className="flex items-center gap-2 text-sm">
                                <span className="size-3 rounded-full border" />
                                <span>{option.label}</span>
                            </div>
                        ))
                    )}
                </div>
            ) : selectedField.type === "textarea" ? (
                <Textarea disabled placeholder={selectedField.placeholder || "多行文本"} rows={4} />
            ) : selectedField.type === "toggle" ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox disabled />
                    <span>开关选择</span>
                </div>
            ) : (
                <Input disabled type={selectedField.type === "date" ? "date" : selectedField.type === "number" ? "number" : "text"} placeholder={selectedField.placeholder || fieldTypeLabels[selectedField.type]} />
            )}
        </div>
    ) : null;

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="mb-2 flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="size-8" asChild>
                            <Link href="/dashboard/forms">
                                <ArrowLeft className="size-4" />
                            </Link>
                        </Button>
                        <Badge variant={status === "published" ? "default" : status === "archived" ? "secondary" : "outline"}>
                            {status === "published" ? "已发布" : status === "archived" ? "已归档" : "草稿"}
                        </Badge>
                        {currentVersion && <Badge variant="outline">v{currentVersion}</Badge>}
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {mode === "create" ? "创建表单" : "编辑表单"}
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        {publishedAt ? `最近发布：${formatDate(publishedAt)}` : "保存草稿后发布，公开页只读取已发布版本。"}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {status === "published" && slug && (
                        <Button variant="outline" asChild>
                            <Link href={`/forms/${slug}`} target="_blank">
                                <Eye className="size-4" />
                                预览
                            </Link>
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => saveForm()} disabled={saving || publishing}>
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        保存草稿
                    </Button>
                    <Button onClick={publishForm} disabled={saving || publishing}>
                        {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                        发布版本
                    </Button>
                </div>
            </div>

            <Separator />

            <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
                <Card className="h-fit">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-base">题目</CardTitle>
                        <Button size="icon" variant="outline" className="size-8" onClick={addField}>
                            <Plus className="size-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {fields.map((field, index) => (
                            <button
                                key={`${field.key}-${index}`}
                                className={cn(
                                    "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                                    selectedIndex === index ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                                )}
                                onClick={() => setSelectedIndex(index)}
                            >
                                <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{field.label || `字段 ${index + 1}`}</p>
                                    <p className="text-xs text-muted-foreground">{fieldTypeLabels[field.type]}</p>
                                </div>
                                {!field.enabled && <span className="size-2 rounded-full bg-muted-foreground" />}
                            </button>
                        ))}
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">表单信息</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="form-title">标题</Label>
                                <Input
                                    id="form-title"
                                    value={title}
                                    placeholder="例如：活动报名"
                                    onChange={(event) => {
                                        const nextTitle = event.target.value;
                                        setTitle(nextTitle);
                                        if (!slug) {
                                            setSlug(slugifyFormKey(nextTitle).replace(/_/g, "-"));
                                        }
                                    }}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="form-description">描述</Label>
                                <Textarea
                                    id="form-description"
                                    value={description}
                                    placeholder="向填写者说明表单用途"
                                    onChange={(event) => setDescription(event.target.value)}
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-base">填写预览</CardTitle>
                            <Badge variant="outline">{fields.filter((field) => field.enabled).length} 个启用字段</Badge>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-md border bg-muted/30 p-4">
                                <h2 className="text-xl font-semibold">{title || "未命名表单"}</h2>
                                {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
                            </div>
                            {selectedPreview}
                        </CardContent>
                    </Card>

                    {versions.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">发布记录</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {versions.map((version) => (
                                    <div key={version.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                                        <span>版本 v{version.version}</span>
                                        <span className="text-muted-foreground">{formatDate(version.published_at)}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Settings2 className="size-4" />
                                发布设置
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="form-slug">访问标识</Label>
                                <Input
                                    id="form-slug"
                                    value={slug}
                                    placeholder="activity-signup"
                                    onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                                />
                                <p className="text-xs text-muted-foreground">公开地址：/forms/{slug || "..."}</p>
                            </div>
                            <div className="grid gap-2">
                                <Label>可见性</Label>
                                <Select value={visibility} onValueChange={setVisibility}>
                                    <SelectTrigger>
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
                                        {allowedUsers.map((user) => (
                                            <Badge key={user.id} variant="secondary" className="gap-1 pr-1">
                                                {user.name}
                                                <button type="button" onClick={() => removeMember(user.id)} className="ml-1 text-muted-foreground hover:text-destructive">
                                                    ×
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                    <Input
                                        value={memberSearchQuery}
                                        placeholder="搜索用户名或邮箱..."
                                        onChange={(event) => setMemberSearchQuery(event.target.value)}
                                    />
                                    <div className="max-h-48 space-y-1 overflow-auto">
                                        {memberSearching ? (
                                            <div className="flex justify-center py-4">
                                                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                                            </div>
                                        ) : memberSearchResults.length === 0 ? (
                                            <p className="py-3 text-center text-xs text-muted-foreground">输入关键字搜索成员</p>
                                        ) : (
                                            memberSearchResults.map((user) => {
                                                const selected = allowedUserIds.includes(user.id);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={user.id}
                                                        className={cn(
                                                            "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                                                            selected ? "bg-primary/10 text-primary" : "hover:bg-muted",
                                                        )}
                                                        onClick={() => (selected ? removeMember(user.id) : addMember(user))}
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium">{user.name}</p>
                                                            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                                                        </div>
                                                        {selected && <Badge variant="secondary">已选</Badge>}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="grid gap-2">
                                <Label>提交按钮文本</Label>
                                <Input
                                    value={settings.submitLabel}
                                    onChange={(event) => setSettings((prev) => ({ ...prev, submitLabel: event.target.value }))}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>提交成功提示</Label>
                                <Textarea
                                    value={settings.successMessage}
                                    onChange={(event) => setSettings((prev) => ({ ...prev, successMessage: event.target.value }))}
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {selectedField && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">字段属性</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>标题</Label>
                                    <Input
                                        value={selectedField.label}
                                        onChange={(event) => {
                                            const label = event.target.value;
                                            updateField(selectedIndex, {
                                                label,
                                                key: selectedField.key.startsWith("field_")
                                                    ? slugifyFormKey(label) || selectedField.key
                                                    : selectedField.key,
                                            });
                                        }}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>字段 key</Label>
                                    <Input
                                        value={selectedField.key}
                                        onChange={(event) => updateField(selectedIndex, { key: event.target.value.replace(/[^a-z0-9_]/g, "") })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>类型</Label>
                                    <Select
                                        value={selectedField.type}
                                        onValueChange={(value) => updateField(selectedIndex, {
                                            type: value as FormFieldType,
                                            options: fieldHasOptions(value as FormFieldType) ? selectedField.options : [],
                                        })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {selectableTypes.map((type) => (
                                                <SelectItem key={type} value={type}>
                                                    {fieldTypeLabels[type]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>说明</Label>
                                    <Textarea
                                        value={selectedField.helpText || ""}
                                        onChange={(event) => updateField(selectedIndex, { helpText: event.target.value })}
                                        rows={2}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>占位提示</Label>
                                    <Input
                                        value={selectedField.placeholder || ""}
                                        onChange={(event) => updateField(selectedIndex, { placeholder: event.target.value })}
                                    />
                                </div>
                                {fieldHasOptions(selectedField.type) && (
                                    <div className="grid gap-2">
                                        <Label>选项（每行一个）</Label>
                                        <Textarea
                                            value={normalizeOptionsText(selectedField)}
                                            onChange={(event) => updateField(selectedIndex, { options: optionsFromText(event.target.value) })}
                                            rows={5}
                                        />
                                    </div>
                                )}
                                <div className="grid gap-3">
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={selectedField.required}
                                            onCheckedChange={(checked) => updateField(selectedIndex, { required: checked === true })}
                                        />
                                        必填
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={selectedField.enabled}
                                            onCheckedChange={(checked) => updateField(selectedIndex, { enabled: checked === true })}
                                        />
                                        启用字段
                                    </label>
                                </div>
                                <Separator />
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" onClick={() => moveField(selectedIndex, -1)} disabled={selectedIndex === 0}>
                                        <ArrowUp className="size-4" />
                                        上移
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => moveField(selectedIndex, 1)} disabled={selectedIndex === fields.length - 1}>
                                        <ArrowDown className="size-4" />
                                        下移
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => duplicateField(selectedIndex)}>
                                        <Copy className="size-4" />
                                        复制
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeField(selectedIndex)}>
                                        <Trash2 className="size-4" />
                                        删除
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
