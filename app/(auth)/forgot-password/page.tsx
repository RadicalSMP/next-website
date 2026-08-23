"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth-client";
import { toast } from "sonner";
import { translateErrorMessage } from "@/lib/utils";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (loading) return;
        await requestPasswordReset({
            email,
            redirectTo: "/reset-password",
            fetchOptions: {
                onRequest: () => setLoading(true),
                onResponse: () => setLoading(false),
                onError: (ctx) => {
                    toast.error(translateErrorMessage(ctx.error.message));
                },
                onSuccess: () => {
                    setSent(true);
                    toast.success("重置密码邮件已发送，请查收邮箱");
                },
            },
        });
    };

    return (
        <AuthShell title="找回账户访问权" description="输入注册邮箱，我们会发送重置链接，帮助你重新设置登录密码。">
            <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 rounded-lg border bg-background/82 shadow-2xl backdrop-blur-xl motion-reduce:animate-none">
                <CardHeader>
                    <CardTitle className="text-lg md:text-xl">忘记密码</CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                        输入您的邮箱地址，我们将发送重置密码链接
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {sent ? (
                        <div className="text-center py-4">
                            <p className="text-sm text-muted-foreground">
                                重置密码邮件已发送至 <span className="font-medium text-foreground">{email}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                                请检查您的收件箱（包括垃圾邮件文件夹）
                            </p>
                        </div>
                    ) : (
                        <form className="grid gap-4" onSubmit={handleSubmit}>
                            <div className="grid gap-2">
                                <Label htmlFor="email">电子邮箱</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="例如：name@example.com"
                                    autoComplete="email"
                                    spellCheck={false}
                                    required
                                    onChange={(e) => setEmail(e.target.value)}
                                    value={email}
                                />
                            </div>
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={loading || !email}
                            >
                                {loading ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    "发送重置链接"
                                )}
                            </Button>
                        </form>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <p className="text-xs">
                        <Link href="/sign-in" className="underline">
                            返回登录
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </AuthShell>
    );
}
