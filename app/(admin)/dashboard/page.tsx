import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { RiArrowRightLine } from "react-icons/ri";
import { dashboard_items } from "@/app/resource/content";
import { Suspense } from "react";

// ─── 动态内容：需要鉴权获取用户名 ─────────────────────────
async function DashboardContent() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    const userName = session?.user?.name || "管理员";

    return (
        <div className="space-y-8">
            {/* 欢迎信息 */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    欢迎回来，{userName}
                </h1>
                <p className="text-muted-foreground mt-1">
                    RadicalSMP 管理后台
                </p>
            </div>

            {/* 快捷入口 */}
            <div>
                <h2 className="text-lg font-semibold mb-4">快捷入口</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.values(dashboard_items).flatMap(section => section.items).map((item) => {
                        if (item.href === "/dashboard") return null;
                        const Icon = item.icon;
                        return (
                            <Link key={item.href} href={item.href} className="block">
                                <Card className="transition-colors hover:bg-muted/50 h-full">
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <CardTitle className="text-base font-medium">
                                            <span className="flex items-center gap-2">
                                                <Icon className="size-5" />
                                                {item.title}
                                            </span>
                                        </CardTitle>
                                        <RiArrowRightLine className="size-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <CardDescription>
                                            {item.desc}
                                        </CardDescription>
                                    </CardContent>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}

export default function DashboardHome() {
    return (
        <Suspense fallback={
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">加载中...</h1>
                    <p className="text-muted-foreground mt-1">RadicalSMP 管理后台</p>
                </div>
            </div>
        }>
            <DashboardContent />
        </Suspense>
    );
}
