"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlogEditor } from "@/components/blog-editor";
import { RiArrowLeftLine, RiSaveLine, RiSendPlaneLine } from "react-icons/ri";

export default function BlogNewPage() {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [excerpt, setExcerpt] = useState("");
    const [coverImage, setCoverImage] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSave = async (status: "draft" | "published") => {
        if (!title.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("/api/blog", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    content,
                    excerpt: excerpt.trim() || null,
                    cover_image: coverImage.trim() || null,
                    status,
                }),
            });
            if (res.ok) {
                router.push("/dashboard/blog/manage");
            } else {
                const data = await res.json();
                console.error("保存失败:", data.error);
            }
        } catch (err) {
            console.error("保存失败:", err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 页头 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/blog/manage")}>
                        <RiArrowLeftLine className="size-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">新建文章</h1>
                        <p className="text-muted-foreground mt-1">撰写并发布新的博客文章</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving || !title.trim()}>
                        <RiSaveLine className="size-4 mr-2" />
                        保存草稿
                    </Button>
                    <Button onClick={() => handleSave("published")} disabled={saving || !title.trim()}>
                        <RiSendPlaneLine className="size-4 mr-2" />
                        发布
                    </Button>
                </div>
            </div>

            {/* 表单 */}
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="title">标题</Label>
                    <Input
                        id="title"
                        placeholder="输入文章标题..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="text-lg"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="excerpt">摘要（可选）</Label>
                    <Input
                        id="excerpt"
                        placeholder="简短描述文章内容..."
                        value={excerpt}
                        onChange={(e) => setExcerpt(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="cover">封面图片 URL（可选）</Label>
                    <Input
                        id="cover"
                        placeholder="https://example.com/image.jpg"
                        value={coverImage}
                        onChange={(e) => setCoverImage(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label>正文</Label>
                    <BlogEditor onChange={setContent} />
                </div>
            </div>
        </div>
    );
}
