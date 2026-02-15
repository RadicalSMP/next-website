import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiBloggerLine } from "react-icons/ri";

export default function BlogManagePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">文章管理</h1>
                <p className="text-muted-foreground mt-1">管理博客文章</p>
            </div>

            <Card>
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                        <RiBloggerLine className="size-8 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-xl">博客功能即将上线</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-muted-foreground">
                        博客编辑与发布功能正在开发中，敬请期待。
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
