"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import { ArrowLeft, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { org } from "@/app/resource/content";
import { cn } from "@/lib/utils";

type AuthShellProps = {
    children: ReactNode;
    eyebrow?: string;
    title?: string;
    description?: string;
    className?: string;
};

export function AuthShell({
    children,
    eyebrow = "RadicalSMP 账户",
    title = "进入社区系统",
    description = "管理入服申请、邮箱验证和社区身份信息。",
    className,
}: AuthShellProps) {
    return (
        <main className="relative isolate min-h-screen overflow-x-hidden bg-background text-foreground">
            <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_18%_8%,rgba(132,204,22,0.18),transparent_30%),radial-gradient(circle_at_88%_14%,rgba(14,165,233,0.16),transparent_28%),linear-gradient(180deg,transparent,rgba(0,0,0,0.03))] dark:bg-[radial-gradient(circle_at_16%_8%,rgba(132,204,22,0.18),transparent_28%),radial-gradient(circle_at_84%_12%,rgba(14,165,233,0.16),transparent_30%),linear-gradient(180deg,transparent,rgba(255,255,255,0.04))]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[72vh] overflow-hidden">
                <div className="absolute -left-24 top-12 h-64 w-[42rem] rotate-[-12deg] animate-[pulse_7s_ease-in-out_infinite] rounded-full bg-lime-300/35 blur-3xl dark:bg-lime-400/20" />
                <div className="absolute left-1/3 top-4 h-72 w-[36rem] rotate-[10deg] animate-[pulse_9s_ease-in-out_infinite] rounded-full bg-sky-300/35 blur-3xl dark:bg-sky-400/20" />
                <div className="absolute right-[-12rem] top-24 h-72 w-[34rem] rotate-[-18deg] animate-[pulse_8s_ease-in-out_infinite] rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-400/18" />
            </div>
            <div className="pointer-events-none absolute inset-0 z-[2] opacity-[0.18] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:42px_42px] text-foreground/30 [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
            <div className="pointer-events-none absolute left-0 right-0 top-24 z-[3] h-px animate-[pulse_4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-lime-400/70 to-transparent" />
            <div className="pointer-events-none absolute right-8 top-24 z-[3] hidden grid-cols-6 gap-1 opacity-60 sm:grid">
                {Array.from({ length: 24 }).map((_, index) => (
                    <span
                        key={index}
                        className="size-1.5 rounded-[1px] bg-foreground/45 shadow-[0_0_10px_rgba(132,204,22,0.45)]"
                    />
                ))}
            </div>

            <div className={cn("relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8", className)}>
                <section className="hidden lg:block">
                    <Link href="/" className="mb-12 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1.5 text-sm text-muted-foreground backdrop-blur transition-colors hover:text-foreground">
                        <ArrowLeft className="size-4" />
                        返回首页
                    </Link>

                    <div className="max-w-xl">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-sm text-muted-foreground backdrop-blur">
                            <Sparkles className="size-4 text-lime-500" />
                            {eyebrow}
                        </div>
                        <h1 className="text-5xl font-semibold leading-tight tracking-normal">
                            {title}
                        </h1>
                        <p className="mt-5 text-lg leading-8 text-muted-foreground">
                            {description}
                        </p>
                    </div>

                    <div className="mt-10 grid max-w-xl gap-3">
                        <div className="rounded-lg border bg-background/70 p-4 backdrop-blur">
                            <ShieldCheck className="size-5 text-lime-600 dark:text-lime-400" />
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                认证流程会连接邮箱验证、邀请码和后台权限，后续可继续扩展成员身份能力。
                            </p>
                        </div>
                        <div className="rounded-lg border bg-background/70 p-4 backdrop-blur">
                            <UsersRound className="size-5 text-sky-600 dark:text-sky-400" />
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                所有账户入口保持同一视觉系统，减少登录、注册和验证流程之间的割裂感。
                            </p>
                        </div>
                    </div>
                </section>

                <section className="flex min-h-screen items-center justify-center py-8 lg:min-h-0">
                    <div className="w-full max-w-md">
                        <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
                            <Image
                                src={org.avatar}
                                alt="RadicalSMP"
                                width={36}
                                height={36}
                                className="rounded-md"
                            />
                            <div>
                                <p className="text-sm font-medium">{org.name}</p>
                                <p className="text-xs text-muted-foreground">{org.name_cn}</p>
                            </div>
                        </div>
                        {children}
                    </div>
                </section>
            </div>
        </main>
    );
}
