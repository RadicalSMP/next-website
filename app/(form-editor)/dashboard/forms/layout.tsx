import "@/app/globals.css";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { ModeToggle } from "@/components/theme-toggle";
import { ThemeProvider } from "@/components/theme-provider";
import { auth } from "@/lib/auth";

function EditorLayoutFallback() {
    return (
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
            正在加载表单编辑器...
        </div>
    );
}

async function FormEditorAuthenticatedLayout({
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
        <>
            <div className="fixed right-3 bottom-3 z-50">
                <ModeToggle />
            </div>
            {children}
        </>
    );
}

export default function FormEditorRootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-cn" suppressHydrationWarning>
            <body className="h-screen overflow-hidden font-sans antialiased">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange>
                    <Suspense fallback={<EditorLayoutFallback />}>
                        <FormEditorAuthenticatedLayout>{children}</FormEditorAuthenticatedLayout>
                    </Suspense>
                </ThemeProvider>
                <Toaster richColors position="top-right" />
            </body>
        </html>
    );
}
