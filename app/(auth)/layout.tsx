import "@/app/globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export default function AuthRootLayout({
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
                    {children}
                </ThemeProvider>
                <Toaster richColors position="top-right" />
            </body>
        </html>
    );
}
