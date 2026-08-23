import type { Metadata } from "next";
import "@/app/globals.css";

import { Footer } from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { Toaster } from "sonner";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: {
    default: "RadicalSMP | 根号的离谱服务器",
    template: "%s | RadicalSMP",
  },
  description: "RadicalSMP 是围绕公平、长期协作与社区共创建设的 Minecraft 生存多人服务器社区。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-cn" suppressHydrationWarning>
      <body
        className="font-sans antialiased"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
            <a href="#main-content" className="sr-only z-[60] rounded-md bg-background px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:ring-2 focus:ring-ring">
              跳到主要内容
            </a>
            <Suspense fallback={<div className="h-16 border-b" aria-hidden="true" />}>
              <Navbar />
            </Suspense>

            {/* 主要内容区域 */}
            <div className="min-h-screen flex flex-col">
              <main id="main-content" className="flex-1">
                {children}
              </main>
            </div>

            {/* 页脚 */}
            <Suspense>
              <Footer />
            </Suspense>
            

            {/* Toast 通知 */}
            <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
