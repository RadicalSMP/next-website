"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Save, Eye, EyeOff, ArrowLeft } from "lucide-react";
import Link from "next/link";

/* ─── 主组件 ─────────────────────────────────────────────── */

export default function SystemSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);

    // AI 配置
    const [aiApiKey, setAiApiKey] = useState("");
    const [aiBaseUrl, setAiBaseUrl] = useState("");
    const [aiModel, setAiModel] = useState("");

    // 标记是否是从数据库读取的脱敏值
    const [apiKeyMasked, setApiKeyMasked] = useState(false);

    // ─── 加载设置 ─────────────────────────────────────────
    const fetchSettings = useCallback(async () => {
        try {
            const res = await fetch("/api/settings?prefix=ai.");
            if (res.ok) {
                const data = await res.json();
                const s = data.settings || {};
                if (s["ai.api_key"]) {
                    setAiApiKey(s["ai.api_key"]);
                    setApiKeyMasked(true);
                }
                if (s["ai.base_url"]) setAiBaseUrl(s["ai.base_url"]);
                if (s["ai.model"]) setAiModel(s["ai.model"]);
            }
        } catch {
            toast.error("加载设置失败");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // ─── 保存 ─────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            const settings: Record<string, { value: string; encrypted?: boolean }> = {};

            // API Key: 只有用户修改了才提交（非脱敏值）
            if (aiApiKey && !apiKeyMasked) {
                settings["ai.api_key"] = { value: aiApiKey, encrypted: true };
            }
            if (aiBaseUrl) {
                settings["ai.base_url"] = { value: aiBaseUrl };
            }
            if (aiModel) {
                settings["ai.model"] = { value: aiModel };
            }

            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ settings }),
            });

            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "保存失败");
                return;
            }

            toast.success("设置已保存");
            // 重新加载脱敏值
            fetchSettings();
        } catch {
            toast.error("保存失败");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl">
            {/* 页面标题 */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <Button variant="ghost" size="icon" className="size-8" asChild>
                        <Link href="/dashboard">
                            <ArrowLeft className="size-4" />
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">系统设置</h1>
                </div>
                <p className="text-muted-foreground ml-10">
                    管理 AI 连接配置等全局设置
                </p>
            </div>

            <Separator />

            {/* AI 连接配置 */}
            <Card>
                <CardHeader>
                    <CardTitle>AI 连接配置</CardTitle>
                    <CardDescription>
                        配置 OpenAI 兼容 API 的连接信息，用于入服申请的 AI 评分功能。
                        支持 OpenAI、Azure OpenAI、第三方兼容 API 等。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* API Base URL */}
                    <div className="grid gap-2">
                        <Label htmlFor="ai-base-url">API Base URL</Label>
                        <Input
                            id="ai-base-url"
                            placeholder="https://api.openai.com/v1"
                            value={aiBaseUrl}
                            onChange={(e) => setAiBaseUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            OpenAI 默认为 https://api.openai.com/v1，使用第三方服务时请填写对应地址
                        </p>
                    </div>

                    {/* API Key */}
                    <div className="grid gap-2">
                        <Label htmlFor="ai-api-key">API Key</Label>
                        <div className="relative">
                            <Input
                                id="ai-api-key"
                                type={showApiKey ? "text" : "password"}
                                placeholder="sk-..."
                                value={aiApiKey}
                                onChange={(e) => {
                                    setAiApiKey(e.target.value);
                                    setApiKeyMasked(false);
                                }}
                                onFocus={() => {
                                    if (apiKeyMasked) {
                                        setAiApiKey("");
                                        setApiKeyMasked(false);
                                    }
                                }}
                                className="pr-10"
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setShowApiKey(!showApiKey)}
                            >
                                {showApiKey ? (
                                    <EyeOff className="size-4" />
                                ) : (
                                    <Eye className="size-4" />
                                )}
                            </button>
                        </div>
                        {apiKeyMasked && (
                            <p className="text-xs text-muted-foreground">
                                已配置（显示为脱敏值）。点击输入框可重新输入
                            </p>
                        )}
                    </div>

                    {/* Model */}
                    <div className="grid gap-2">
                        <Label htmlFor="ai-model">模型名称</Label>
                        <Input
                            id="ai-model"
                            placeholder="gpt-4o-mini"
                            value={aiModel}
                            onChange={(e) => setAiModel(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            例如: gpt-4o-mini, gpt-4o, gpt-3.5-turbo 等
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* 保存按钮 */}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <>
                            <Save className="size-4 mr-1.5" />
                            保存设置
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
