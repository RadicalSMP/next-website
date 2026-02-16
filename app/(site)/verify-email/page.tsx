"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useState, useEffect, useCallback, Suspense } from "react";
import { Loader2, MailCheck, RefreshCw } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { translateErrorMessage } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";

const COOLDOWN_KEY = "verify-email-cooldown-until";
const COOLDOWN_SECONDS = 60;

/** 从 localStorage 读取剩余冷却秒数 */
function getRemaining(): number {
    try {
        const until = localStorage.getItem(COOLDOWN_KEY);
        if (!until) return 0;
        const remaining = Math.ceil((Number(until) - Date.now()) / 1000);
        return remaining > 0 ? remaining : 0;
    } catch {
        return 0;
    }
}

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const email = searchParams.get("email");
    const router = useRouter();
    const [resending, setResending] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // 页面挂载时从 localStorage 恢复倒计时
    useEffect(() => {
        setCountdown(getRemaining());
    }, []);

    // 每秒更新倒计时
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setTimeout(() => setCountdown(getRemaining()), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    const startCooldown = useCallback(() => {
        const until = Date.now() + COOLDOWN_SECONDS * 1000;
        try { localStorage.setItem(COOLDOWN_KEY, String(until)); } catch {}
        setCountdown(COOLDOWN_SECONDS);
    }, []);

    const handleResend = async () => {
        if (!email) {
            toast.error("缺少邮箱信息，请重新注册");
            return;
        }
        setResending(true);
        const { error } = await authClient.sendVerificationEmail({
            email,
            callbackURL: "/dashboard",
        });
        setResending(false);

        if (error) {
            toast.error(translateErrorMessage(error.message ?? "发送失败"));
        } else {
            toast.success("验证邮件已重新发送，请查看收件箱");
            startCooldown();
        }
    };

    return (
        <Card className="z-50 rounded-md rounded-t-none max-w-md flex flex-1">
            <CardHeader className="text-center">
                <div className="flex justify-center mb-2">
                    <MailCheck className="size-12 text-muted-foreground" />
                </div>
                <CardTitle className="text-lg md:text-xl">验证您的邮箱</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                    我们已向{" "}
                    {email ? (
                        <span className="font-medium text-foreground">{email}</span>
                    ) : (
                        "您的邮箱"
                    )}{" "}
                    发送了一封验证邮件
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4">
                    <div className="text-sm text-muted-foreground space-y-2">
                        <p>请前往您的邮箱，点击邮件中的验证链接以完成注册。</p>
                        <p>如果没有收到邮件，请检查垃圾邮件文件夹。</p>
                    </div>

                    <Button
                        variant="outline"
                        className="w-full"
                        disabled={resending || countdown > 0}
                        onClick={handleResend}
                    >
                        {resending ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <>
                                <RefreshCw className="size-4 mr-1.5" />
                                {countdown > 0
                                    ? `重新发送 (${countdown}s)`
                                    : "重新发送验证邮件"}
                            </>
                        )}
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => router.push("/sign-in")}
                    >
                        返回登录
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                        验证链接将在 1 小时后过期
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

export default function VerifyEmail() {
    return (
        <div className="flex justify-center items-center h-screen">
            <Suspense>
                <VerifyEmailContent />
            </Suspense>
        </div>
    );
}
