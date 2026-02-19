import { getPublishedPosts } from "@/lib/blog-cache";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "博客 - RadicalSMP",
    description: "RadicalSMP 社区博客",
};

export default async function BlogsPage() {
    const posts = await getPublishedPosts();

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    return (
        <div className="container max-w-4xl mx-auto py-10 px-4">
            <div className="mb-8">
                <h1 className="text-4xl font-bold tracking-tight">博客</h1>
                <p className="text-muted-foreground mt-2">来自 RadicalSMP 社区的最新动态</p>
            </div>

            {posts.length === 0 ? (
                <Card>
                    <CardContent className="text-center py-12">
                        <p className="text-muted-foreground">暂无文章</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {posts.map((post) => (
                        <Link key={post.id} href={`/blogs/${post.slug}`} className="block group">
                            <Card className="transition-colors hover:bg-muted/50">
                                <CardHeader>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                        <span>{post.author_name || "佚名"}</span>
                                        <span>·</span>
                                        <time dateTime={new Date(post.published_at).toISOString()}>
                                            {formatDate(post.published_at)}
                                        </time>
                                    </div>
                                    <CardTitle className="text-xl group-hover:text-primary transition-colors">
                                        {post.title}
                                    </CardTitle>
                                </CardHeader>
                                {post.excerpt && (
                                    <CardContent className="pt-0">
                                        <p className="text-muted-foreground line-clamp-2">
                                            {post.excerpt}
                                        </p>
                                    </CardContent>
                                )}
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
