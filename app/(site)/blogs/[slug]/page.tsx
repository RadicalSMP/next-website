import { getPublishedPostBySlug, getPostMetadataBySlug } from "@/lib/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BlogTableOfContents } from "@/components/blog-toc";

// ─── SEO 元数据 ──────────────────────────────────────────
export async function generateMetadata(
    { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
    const { slug } = await params;
    const post = await getPostMetadataBySlug(slug);

    if (!post) {
        return { title: "文章不存在 - RadicalSMP" };
    }

    return {
        title: `${post.title} - RadicalSMP 博客`,
        description: post.excerpt || post.title,
        openGraph: {
            title: post.title,
            description: post.excerpt || post.title,
            type: "article",
        },
    };
}

// ─── 页面 ────────────────────────────────────────────────
export default async function BlogPostPage(
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const post = await getPublishedPostBySlug(slug);

    if (!post) {
        notFound();
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    return (
        <div className="container mx-auto py-10 px-4 relative">
            <div className="flex gap-8 justify-center">
                {/* 左侧目录导航 — 桌面端固定显示 */}
                <aside className="hidden xl:block w-56 shrink-0">
                    <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-hidden">
                        <BlogTableOfContents />
                    </div>
                </aside>

                {/* 文章主体 */}
                <article className="max-w-3xl w-full min-w-0">
                    {/* 文章头部 */}
                    <header className="mb-8">
                        <h1 className="text-4xl font-bold tracking-tight mb-4">
                            {post.title}
                        </h1>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{post.author_name || "佚名"}</span>
                            <span>·</span>
                            <time dateTime={new Date(post.published_at).toISOString()}>
                                {formatDate(post.published_at)}
                            </time>
                        </div>
                    </header>

                    {/* 封面图 */}
                    {post.cover_image && (
                        <div className="mb-8 rounded-lg overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={post.cover_image}
                                alt={post.title}
                                className="w-full object-cover"
                            />
                        </div>
                    )}

                    {/* 正文 — Tiptap 生成的 HTML */}
                    <div
                        className="prose prose-neutral dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: post.content }}
                    />
                </article>
            </div>
        </div>
    );
}
