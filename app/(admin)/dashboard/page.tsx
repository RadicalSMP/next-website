import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { RiUserLine, RiBloggerLine, RiArrowRightLine } from "react-icons/ri";

export default async function DashboardHome() {
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
                    <Link href="/dashboard/user/manage" className="block">
                        <Card className="transition-colors hover:bg-muted/50">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-base font-medium">
                                    <span className="flex items-center gap-2">
                                        <RiUserLine className="size-5" />
                                        用户管理
                                    </span>
                                </CardTitle>
                                <RiArrowRightLine className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    查看、搜索和管理所有注册用户
                                </CardDescription>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href="/dashboard/blog/manage" className="block">
                        <Card className="transition-colors hover:bg-muted/50">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-base font-medium">
                                    <span className="flex items-center gap-2">
                                        <RiBloggerLine className="size-5" />
                                        文章管理
                                    </span>
                                </CardTitle>
                                <RiArrowRightLine className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    管理博客文章
                                </CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </div>
        </div>
    );
}