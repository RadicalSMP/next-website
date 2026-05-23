import { getActiveForms } from "@/lib/cache";
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
        <div className="container mx-auto max-w-3xl px-4 py-12">
            <div className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight">表单</h1>
                <p className="mt-2 text-muted-foreground">查看和填写已发布表单</p>
            </div>

            {forms.length === 0 ? (
                <div className="py-20 text-center">
                    <FileText className="mx-auto mb-4 size-16 text-muted-foreground" />
                    <p className="text-muted-foreground">暂无可用表单</p>
                </div>
            ) : (
                <div className="divide-y rounded-lg border">
                    {forms.map((form) => (
                        <Link
                            key={form.id}
                            href={`/forms/${form.slug}`}
                            className="block px-5 py-5 transition-colors hover:bg-muted/40"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-semibold">{form.title}</h2>
                                    {form.description && (
                                        <p className="mt-1 text-sm text-muted-foreground">{form.description}</p>
                                    )}
                                </div>
                                {visibilityText(form.visibility) && (
                                    <Badge variant="outline" className="gap-1">
                                        {visibilityIcon(form.visibility)}
                                        {visibilityText(form.visibility)}
                                    </Badge>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
