import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { Footer } from "@/components/footer";
import { ModeToggle } from "@/components/theme-toggle";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import "@/app/globals.css";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";

function DashboardLayoutFallback() {
    return (
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
            正在加载后台...
        </div>
    );
}

async function DashboardAuthenticatedLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return redirect("/sign-in");
    }

    if (session.user.role !== "admin") {
        return redirect("/");
    }

    return (
        <SidebarProvider>
            <DashboardSidebar />

            <SidebarInset>
                <div className="fixed top-5 right-5 z-50">
                    <ModeToggle />
                </div>

                <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                    <div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
                        <div className="p-6">{children}</div>
                    </div>
                </div>

                <Suspense>
                    <Footer />
                </Suspense>
                
            </SidebarInset>
        </SidebarProvider>
    );
}

export default function DashboardRootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-cn" suppressHydrationWarning>
            <body className="font-sans antialiased">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange>
                    <Suspense fallback={<DashboardLayoutFallback />}>
                        <DashboardAuthenticatedLayout>{children}</DashboardAuthenticatedLayout>
                    </Suspense>
                </ThemeProvider>
                <Toaster richColors position="top-right" />
            </body>
        </html>
    );
}
