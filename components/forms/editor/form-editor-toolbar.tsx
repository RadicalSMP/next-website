"use client";

import Link from "next/link";
import {
    ArrowLeft,
    CheckCircle2,
    Cloud,
    CloudOff,
    Eye,
    Loader2,
    PanelLeft,
    PanelRight,
    Rocket,
    Save,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { saveStateLabels } from "./constants";
import { SaveState } from "./types";
import { formatRelativeSaveTime } from "./utils";

type FormEditorToolbarProps = {
    mode: "create" | "edit";
    title: string;
    slug: string;
    status: "draft" | "published" | "archived";
    currentVersion: number | null;
    saveState: SaveState;
    saveMessage: string;
    lastSyncedAt: number | null;
    saving: boolean;
    publishing: boolean;
    canPreview: boolean;
    onSave: () => void;
    onPublish: () => void;
    onToggleOutline: () => void;
    onToggleProperties: () => void;
};

function statusLabel(status: FormEditorToolbarProps["status"]) {
    if (status === "published") return "已发布";
    if (status === "archived") return "已归档";
    return "草稿";
}

function SaveIcon({ state }: { state: SaveState }) {
    if (state === "syncing") return <Loader2 className="size-4 animate-spin" />;
    if (state === "synced") return <CheckCircle2 className="size-4 text-emerald-600" />;
    if (state === "error") return <CloudOff className="size-4 text-destructive" />;
    return <Cloud className="size-4 text-muted-foreground" />;
}

export function FormEditorToolbar({
    mode,
    title,
    slug,
    status,
    currentVersion,
    saveState,
    saveMessage,
    lastSyncedAt,
    saving,
    publishing,
    canPreview,
    onSave,
    onPublish,
    onToggleOutline,
    onToggleProperties,
}: FormEditorToolbarProps) {
    return (
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
            <div className="flex h-14 items-center gap-2 px-3 lg:px-4">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 lg:hidden"
                                onClick={onToggleOutline}
                                aria-label="打开题目大纲"
                                title="打开题目大纲"
                            >
                                <PanelLeft className="size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>题目大纲</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <Button variant="ghost" size="icon" className="size-9" asChild>
                    <Link href="/dashboard/forms" aria-label="返回表单列表">
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>

                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-medium">
                            {title.trim() || (mode === "create" ? "新建表单" : "未命名表单")}
                        </p>
                        <Badge
                            variant={status === "published" ? "default" : status === "archived" ? "secondary" : "outline"}
                            className="hidden shrink-0 sm:inline-flex"
                        >
                            {statusLabel(status)}
                        </Badge>
                        {currentVersion && (
                            <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                                v{currentVersion}
                            </Badge>
                        )}
                    </div>
                    <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        <SaveIcon state={saveState} />
                        <span className={cn("truncate", saveState === "error" && "text-destructive")}>
                            {saveMessage || saveStateLabels[saveState]}
                        </span>
                        {lastSyncedAt && saveState === "synced" && (
                            <span className="hidden shrink-0 sm:inline">
                                · {formatRelativeSaveTime(lastSyncedAt)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {canPreview && slug && (
                        <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                            <Link href={`/forms/${slug}`} target="_blank">
                                <Eye className="size-4" />
                                预览
                            </Link>
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onSave}
                        disabled={saving || publishing}
                        aria-label="保存表单"
                        title="保存表单"
                    >
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        <span className="hidden sm:inline">保存</span>
                    </Button>
                    <Button
                        size="sm"
                        onClick={onPublish}
                        disabled={saving || publishing}
                        aria-label="发布表单"
                        title="发布表单"
                    >
                        {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                        <span className="hidden sm:inline">发布</span>
                    </Button>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-9 xl:hidden"
                                    onClick={onToggleProperties}
                                    aria-label="打开属性面板"
                                    title="打开属性面板"
                                >
                                    <PanelRight className="size-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>属性面板</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </header>
    );
}
