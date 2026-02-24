"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Loader2,
    Plus,
    Trash2,
    GripVertical,
    ArrowUp,
    ArrowDown,
    Save,
    X,
    Search,
    UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";

/* ─── 类型定义 ─────────────────────────────────────────────── */

interface FormField {
    key: string;
    label: string;
    type: "text" | "textarea" | "select" | "checkbox" | "number";
    required: boolean;
    placeholder?: string;
    options?: string[];
}

interface UserItem {
    id: string;
    name: string;
    email: string;
    image: string | null;
}

/* ─── 主组件 ─────────────────────────────────────────────── */

export default function FormBuilderNewPage() {
    const router = useRouter();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [slug, setSlug] = useState("");
    const [visibility, setVisibility] = useState("public");
    const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
    const [allowedUsers, setAllowedUsers] = useState<UserItem[]>([]);
    const [fields, setFields] = useState<FormField[]>([]);
    const [saving, setSaving] = useState(false);

    // ─── 成员选择对话框 ───────────────────────────────────
    const [memberDialogOpen, setMemberDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<UserItem[]>([]);
    const [searching, setSearching] = useState(false);

    const searchUsers = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await fetch(`/api/users?search=${encodeURIComponent(query)}&limit=10`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data.users || []);
            }
        } catch {
            // 忽略
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => searchUsers(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery, searchUsers]);

    const addMember = (user: UserItem) => {
        if (!allowedUserIds.includes(user.id)) {
            setAllowedUserIds([...allowedUserIds, user.id]);
            setAllowedUsers([...allowedUsers, user]);
        }
    };

    const removeMember = (userId: string) => {
        setAllowedUserIds(allowedUserIds.filter((id) => id !== userId));
        setAllowedUsers(allowedUsers.filter((u) => u.id !== userId));
    };

    // ─── 字段操作 ─────────────────────────────────────────
    const addField = () => {
        setFields([
            ...fields,
            {
                key: `field_${Date.now()}`,
                label: "",
                type: "text",
                required: false,
                placeholder: "",
            },
        ]);
    };

    const updateField = (index: number, updates: Partial<FormField>) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], ...updates };
        setFields(newFields);
    };

    const removeField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const moveField = (index: number, direction: "up" | "down") => {
        const newFields = [...fields];
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newFields.length) return;
        [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
        setFields(newFields);
    };

    const generateKey = (label: string) => {
        return label
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fff]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_|_$/g, "") || `field_${Date.now()}`;
    };

    // ─── 提交 ─────────────────────────────────────────────
    const handleSave = async () => {
        if (!title.trim()) {
            toast.error("请输入表单标题");
            return;
        }
        if (!slug.trim()) {
            toast.error("请输入表单 slug");
            return;
        }
        if (fields.length === 0) {
            toast.error("至少需要添加一个字段");
            return;
        }
        for (let i = 0; i < fields.length; i++) {
            if (!fields[i].label.trim()) {
                toast.error(`第 ${i + 1} 个字段的标签不能为空`);
                return;
            }
            if (!fields[i].key.trim()) {
                toast.error(`第 ${i + 1} 个字段的 key 不能为空`);
                return;
            }
            if (fields[i].type === "select" && (!fields[i].options || fields[i].options!.length === 0)) {
                toast.error(`第 ${i + 1} 个字段是下拉选择类型，但没有设置选项`);
                return;
            }
        }

        setSaving(true);
        try {
            const res = await fetch("/api/forms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim() || null,
                    slug: slug.trim(),
                    visibility,
                    allowed_user_ids: visibility === "members" ? allowedUserIds : [],
                    fields,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "创建失败");
                return;
            }

            toast.success("表单已创建");
            router.push("/dashboard/forms");
        } catch {
            toast.error("创建失败");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">创建表单</h1>
                <p className="text-muted-foreground mt-1">配置表单基本信息和字段</p>
            </div>

            <Separator />

            {/* 基本信息 */}
            <Card>
                <CardHeader>
                    <CardTitle>基本信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="title">表单标题</Label>
                        <Input id="title" placeholder="例如：入服申请" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">描述（可选）</Label>
                        <Textarea id="description" placeholder="简要描述此表单的用途" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="slug">slug（URL 标识）</Label>
                            <Input id="slug" placeholder="例如：join-application" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
                            <p className="text-xs text-muted-foreground">访问地址：/forms/{slug || "..."}</p>
                        </div>
                        <div className="grid gap-2">
                            <Label>可见性</Label>
                            <Select value={visibility} onValueChange={setVisibility}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="public">公开（所有人可见）</SelectItem>
                                    <SelectItem value="authenticated">登录后可见</SelectItem>
                                    <SelectItem value="members">指定成员可见</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* 指定成员选择 */}
                    {visibility === "members" && (
                        <div className="grid gap-2">
                            <Label>指定成员</Label>
                            <div className="flex flex-wrap gap-2 min-h-[36px] p-2 border rounded-md bg-background">
                                {allowedUsers.map((user) => (
                                    <Badge key={user.id} variant="secondary" className="gap-1 pr-1">
                                        {user.name}
                                        <button onClick={() => removeMember(user.id)} className="ml-1 hover:text-destructive">
                                            <X className="size-3" />
                                        </button>
                                    </Badge>
                                ))}
                                <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={() => { setMemberDialogOpen(true); setSearchQuery(""); setSearchResults([]); }}>
                                    <UserPlus className="size-3" />
                                    添加成员
                                </Button>
                            </div>
                            {allowedUsers.length === 0 && (
                                <p className="text-xs text-muted-foreground">未指定成员时，所有登录用户均可访问</p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 字段配置 */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>表单字段</CardTitle>
                        <Button variant="outline" size="sm" onClick={addField}><Plus className="size-4 mr-1.5" />添加字段</Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {fields.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground"><p>暂无字段，点击上方按钮添加</p></div>
                    ) : (
                        fields.map((field, index) => (
                            <div key={index} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><GripVertical className="size-4" /><span>字段 {index + 1}</span></div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="size-7" onClick={() => moveField(index, "up")} disabled={index === 0}><ArrowUp className="size-3.5" /></Button>
                                        <Button variant="ghost" size="icon" className="size-7" onClick={() => moveField(index, "down")} disabled={index === fields.length - 1}><ArrowDown className="size-3.5" /></Button>
                                        <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => removeField(index)}><Trash2 className="size-3.5" /></Button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">标签</Label>
                                        <Input placeholder="显示名称" value={field.label} onChange={(e) => { const label = e.target.value; const updates: Partial<FormField> = { label }; if (field.key.startsWith("field_")) { updates.key = generateKey(label); } updateField(index, updates); }} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">字段 key</Label>
                                        <Input placeholder="数据键名" value={field.key} onChange={(e) => updateField(index, { key: e.target.value.replace(/[^a-z0-9_]/g, "") })} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">类型</Label>
                                        <Select value={field.type} onValueChange={(v) => updateField(index, { type: v as FormField["type"] })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="text">单行文本</SelectItem>
                                                <SelectItem value="textarea">多行文本</SelectItem>
                                                <SelectItem value="number">数字</SelectItem>
                                                <SelectItem value="select">下拉选择</SelectItem>
                                                <SelectItem value="checkbox">复选框</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">占位提示（可选）</Label>
                                        <Input placeholder="placeholder 文本" value={field.placeholder || ""} onChange={(e) => updateField(index, { placeholder: e.target.value })} />
                                    </div>
                                    <div className="flex items-end gap-2 pb-1">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox id={`required-${index}`} checked={field.required} onCheckedChange={(checked) => updateField(index, { required: !!checked })} />
                                            <Label htmlFor={`required-${index}`} className="text-sm">必填</Label>
                                        </div>
                                    </div>
                                </div>
                                {field.type === "select" && (
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">选项（每行一个）</Label>
                                        <Textarea placeholder={"选项一\n选项二\n选项三"} value={(field.options || []).join("\n")} onChange={(e) => updateField(index, { options: e.target.value.split("\n").filter(Boolean) })} rows={3} />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* 保存按钮 */}
            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => router.push("/dashboard/forms")}>取消</Button>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <><Save className="size-4 mr-1.5" />创建表单</>}
                </Button>
            </div>

            {/* 成员选择对话框 */}
            <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>选择成员</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索用户名或邮箱..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto space-y-1">
                            {searching ? (
                                <div className="flex justify-center py-6">
                                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : searchResults.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground py-6">
                                    {searchQuery.trim() ? "未找到匹配的用户" : "输入关键字搜索用户"}
                                </p>
                            ) : (
                                searchResults.map((user) => {
                                    const isSelected = allowedUserIds.includes(user.id);
                                    return (
                                        <button
                                            key={user.id}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                                            onClick={() => isSelected ? removeMember(user.id) : addMember(user)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{user.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                            </div>
                                            {isSelected && (
                                                <Badge variant="secondary" className="shrink-0 text-xs">已选</Badge>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button>完成（已选 {allowedUserIds.length} 人）</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
