import { getActiveForms } from "@/lib/form-cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Lock, Users } from "lucide-react";
import Link from "next/link";

export const metadata = {
    title: "表单 - RadicalSMP",
    description: "查看和填写 RadicalSMP 提供的各类表单",
};

export default async function FormsListPage() {
    const forms = await getActiveForms();

    const visibilityIcon = (v: string) => {
        switch (v) {
            case "authenticated":
                return <Lock className="size-3.5" />;
            case "members":
                return <Users className="size-3.5" />;
            default:
                return null;
        }
    };

    const visibilityText = (v: string) => {
        switch (v) {
            case "authenticated":
                return "需要登录";
            case "members":
                return "仅限指定成员";
            default:
                return null;
        }
    };

    return (
        <div className="container max-w-4xl mx-auto py-12 px-4">
            {/* 页面标题 */}
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold tracking-tight mb-3">表单</h1>
                <p className="text-muted-foreground text-lg">
                    查看和填写各类申请表单
                </p>
            </div>

            {/* 表单列表 */}
            {forms.length === 0 ? (
                <div className="text-center py-20">
                    <FileText className="size-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-lg">暂无可用表单</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {forms.map((form) => (
                        <Link key={form.id} href={`/forms/${form.slug}`}>
                            <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-xl">{form.title}</CardTitle>
                                        {visibilityText(form.visibility) && (
                                            <Badge variant="outline" className="gap-1">
                                                {visibilityIcon(form.visibility)}
                                                {visibilityText(form.visibility)}
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                {form.description && (
                                    <CardContent>
                                        <p className="text-muted-foreground">
                                            {form.description}
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
