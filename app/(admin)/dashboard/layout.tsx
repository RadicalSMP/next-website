import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { Footer } from "@/components/ui/footer";
import { ModeToggle } from "@/components/ui/theme-toggle";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import "@/app/globals.css";
import { redirect } from "next/navigation";

export default async function DashboardRootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // 获取用户的 Session
    const session = await auth.api.getSession({
        headers: await headers() // you need to pass the headers object.
    })

    // 若未登录 跳转到 /sign-in
    // TODO: 增加 若 role 并非 admin, 跳转回主页

    if (!session) {
        return redirect("/sign-in")
    }

    return (

        
        <html lang="zh-cn" suppressHydrationWarning>
            <body>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange>

                    <SidebarProvider>
                        <DashboardSidebar />

                        {/* 主要内容区域 - 不会被 Sidebar 遮挡 */}
                        <SidebarInset>
                            <div className="fixed top-5 right-5 z-50">
                                <ModeToggle />
                            </div>

                            {/* 页面内容 */}
                            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                                <div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
                                    <div className="p-6">
                                        {children}
                                    </div>
                                </div>
                            </div>

                            {/* 页脚 */}
                            <Footer />
                        </SidebarInset>
                    </SidebarProvider>

                </ThemeProvider>
            </body>
        </html>
    )
}