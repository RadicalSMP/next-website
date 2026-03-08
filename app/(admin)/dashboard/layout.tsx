import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { Footer } from "@/components/ui/footer";
import { ModeToggle } from "@/components/ui/theme-toggle";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ─── 鉴权守卫（动态组件，需在 Suspense 内） ──────────────
async function AuthGuard({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return redirect("/sign-in");
    }

    if (session.user.role !== "admin") {
        return redirect("/");
    }

    return <>{children}</>;
}

export default function DashboardRootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-cn" suppressHydrationWarning>
            <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange>

                    <Suspense fallback={
                        <div className="flex items-center justify-center min-h-screen">
                            <p className="text-muted-foreground">加载中...</p>
                        </div>
                    }>
                        <AuthGuard>
                            <SidebarProvider>
                                <DashboardSidebar />

                                {/* 主要内容区域 */}
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
                        </AuthGuard>
                    </Suspense>

                </ThemeProvider>
                <Toaster richColors position="top-right" />
            </body>
        </html>
    );
}
