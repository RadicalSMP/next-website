import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
    title: "结果访问失败 - RadicalSMP",
    description: "表单结果访问链接无效或已失效",
};

type AccessErrorPageProps = {
    searchParams: Promise<{ reason?: string | string[] }>;
};

const safeErrorMessages: Record<string, { title: string; description: string }> = {
    token_missing: {
        title: "访问链接不完整",
        description: "请重新打开邮件中的完整结果访问链接。",
    },
    token_invalid: {
        title: "访问链接无效",
        description: "该链接无法验证，请登录查看结果或联系管理员。",
    },
    token_expired: {
        title: "访问链接已过期",
        description: "请登录查看结果，或联系管理员获取新的访问链接。",
    },
    token_consumed: {
        title: "访问链接已使用",
        description: "该链接不能再次使用，请登录查看结果或联系管理员。",
    },
    revision_request_inactive: {
        title: "补交请求已失效",
        description: "该补交请求已完成或已取消，请登录查看最新结果。",
    },
    revision_request_expired: {
        title: "补交请求已过期",
        description: "本次补交已超过截止时间，请联系管理员重新开放。",
    },
    scope_missing: {
        title: "访问权限不足",
        description: "该链接不包含查看此结果所需的权限。",
    },
    exchange_failed: {
        title: "暂时无法验证链接",
        description: "服务暂时不可用，请稍后重新打开访问链接。",
    },
};

const fallbackError = {
    title: "无法打开结果链接",
    description: "访问链接无效或已失效，请登录查看结果或联系管理员。",
};

async function SubmissionAccessErrorContent({ searchParams }: AccessErrorPageProps) {
    const { reason } = await searchParams;
    const safeReason = typeof reason === "string" ? reason : "";
    const message = safeErrorMessages[safeReason] ?? fallbackError;

    return (
        <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
            <ShieldAlert className="mx-auto size-14 text-muted-foreground" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold">{message.title}</h1>
            <p className="mx-auto mt-2 max-w-lg text-muted-foreground">{message.description}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button asChild>
                    <Link href="/sign-in">前往登录</Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link href="/forms">返回表单列表</Link>
                </Button>
            </div>
        </div>
    );
}

export default function SubmissionAccessErrorPage({ searchParams }: AccessErrorPageProps) {
    return (
        <Suspense fallback={<SubmissionAccessErrorFallback />}>
            <SubmissionAccessErrorContent searchParams={searchParams} />
        </Suspense>
    );
}

function SubmissionAccessErrorFallback() {
    return (
        <div className="container mx-auto flex max-w-2xl flex-col items-center px-4 py-20" aria-label="正在验证结果访问链接">
            <Skeleton className="size-14 rounded-full" />
            <Skeleton className="mt-4 h-8 w-48 max-w-full" />
            <Skeleton className="mt-3 h-4 w-96 max-w-full" />
            <div className="mt-6 flex gap-3">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-28" />
            </div>
        </div>
    );
}
