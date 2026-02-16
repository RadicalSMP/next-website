"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    RiBold, RiItalic, RiUnderline, RiStrikethrough,
    RiH1, RiH2, RiH3,
    RiListUnordered, RiListOrdered, RiCodeBoxLine, RiCodeLine,
    RiDoubleQuotesL, RiSeparator, RiImageAddLine, RiLinkM,
    RiArrowGoBackLine, RiArrowGoForwardLine,
} from "react-icons/ri";
import { useCallback } from "react";

const lowlight = createLowlight(common);

interface BlogEditorProps {
    content?: string;
    onChange?: (html: string) => void;
    editable?: boolean;
}

export function BlogEditor({ content = "", onChange, editable = true }: BlogEditorProps) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                codeBlock: false, // 使用 CodeBlockLowlight 替代
            }),
            Underline,
            Image.configure({
                HTMLAttributes: { class: "rounded-lg max-w-full" },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { class: "text-primary underline" },
            }),
            Placeholder.configure({
                placeholder: "开始撰写文章...",
            }),
            CodeBlockLowlight.configure({ lowlight }),
        ],
        content,
        editable,
        onUpdate: ({ editor }) => {
            onChange?.(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: "prose prose-neutral dark:prose-invert max-w-none min-h-[400px] px-4 py-3 focus:outline-none",
            },
        },
    });

    const addImage = useCallback(() => {
        if (!editor) return;
        const url = window.prompt("输入图片 URL");
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    }, [editor]);

    const addLink = useCallback(() => {
        if (!editor) return;
        const previousUrl = editor.getAttributes("link").href;
        const url = window.prompt("输入链接 URL", previousUrl);
        if (url === null) return;
        if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
        } else {
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }
    }, [editor]);

    if (!editor) return null;

    return (
        <div className="border rounded-lg overflow-hidden">
            {/* 工具栏 */}
            {editable && (
                <div className="flex flex-wrap items-center gap-0.5 border-b p-1 bg-muted/30">
                    {/* 撤销/重做 */}
                    <ToolbarButton
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        title="撤销"
                    >
                        <RiArrowGoBackLine className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        title="重做"
                    >
                        <RiArrowGoForwardLine className="size-4" />
                    </ToolbarButton>

                    <Separator orientation="vertical" className="mx-1 h-6" />

                    {/* 文本格式 */}
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        active={editor.isActive("bold")}
                        title="粗体"
                    >
                        <RiBold className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        active={editor.isActive("italic")}
                        title="斜体"
                    >
                        <RiItalic className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        active={editor.isActive("underline")}
                        title="下划线"
                    >
                        <RiUnderline className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        active={editor.isActive("strike")}
                        title="删除线"
                    >
                        <RiStrikethrough className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleCode().run()}
                        active={editor.isActive("code")}
                        title="行内代码"
                    >
                        <RiCodeLine className="size-4" />
                    </ToolbarButton>

                    <Separator orientation="vertical" className="mx-1 h-6" />

                    {/* 标题 */}
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        active={editor.isActive("heading", { level: 1 })}
                        title="标题 1"
                    >
                        <RiH1 className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        active={editor.isActive("heading", { level: 2 })}
                        title="标题 2"
                    >
                        <RiH2 className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        active={editor.isActive("heading", { level: 3 })}
                        title="标题 3"
                    >
                        <RiH3 className="size-4" />
                    </ToolbarButton>

                    <Separator orientation="vertical" className="mx-1 h-6" />

                    {/* 列表 & 引用 */}
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        active={editor.isActive("bulletList")}
                        title="无序列表"
                    >
                        <RiListUnordered className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        active={editor.isActive("orderedList")}
                        title="有序列表"
                    >
                        <RiListOrdered className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        active={editor.isActive("blockquote")}
                        title="引用"
                    >
                        <RiDoubleQuotesL className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        active={editor.isActive("codeBlock")}
                        title="代码块"
                    >
                        <RiCodeBoxLine className="size-4" />
                    </ToolbarButton>

                    <Separator orientation="vertical" className="mx-1 h-6" />

                    {/* 插入 */}
                    <ToolbarButton onClick={addImage} title="插入图片">
                        <RiImageAddLine className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton onClick={addLink} active={editor.isActive("link")} title="插入链接">
                        <RiLinkM className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        title="分割线"
                    >
                        <RiSeparator className="size-4" />
                    </ToolbarButton>
                </div>
            )}

            {/* 编辑器内容区 */}
            <EditorContent editor={editor} />
        </div>
    );
}

// ─── 工具栏按钮 ──────────────────────────────────────────
function ToolbarButton({
    onClick,
    active,
    disabled,
    title,
    children,
}: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <Button
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="icon"
            className="size-8"
            onClick={onClick}
            disabled={disabled}
            title={title}
        >
            {children}
        </Button>
    );
}
