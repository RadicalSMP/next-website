"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, Suspense, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { resetPassword } from "@/lib/auth-client";
import { toast } from "sonner";
import { translateErrorMessage } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export default function ResetPassword() {
    return (
        <Suspense>
            <ResetPasswordContent />
        </Suspense>
    );
}

function ResetPasswordContent() {
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (loading) return;
        if (password !== passwordConfirmation) {
            toast.error("两次输入的密码不一致");
            return;
        }

        if (!token) {
            toast.error("重置链接无效或已过期");
            return;
        }

        await resetPassword({
            newPassword: password,
            token,
            fetchOptions: {
                onRequest: () => setLoading(true),
                onResponse: () => setLoading(false),
                onError: (ctx) => {
                    toast.error(translateErrorMessage(ctx.error.message));
                },
                onSuccess: () => {
                    toast.success("密码重置成功");
                    router.push("/sign-in");
                },
            },
        });
    };

    if (!token) {
        return (
            <AuthShell title="重置链接无效" description="请重新申请密码重置邮件，确保使用最新邮件中的链接。">
                <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 rounded-lg border bg-background/82 shadow-2xl backdrop-blur-xl motion-reduce:animate-none">
                    <CardHeader>
                        <CardTitle className="text-lg md:text-xl">链接无效</CardTitle>
                        <CardDescription className="text-xs md:text-sm">
                            重置密码链接无效或已过期，请重新申请
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Link href="/forgot-password" className="underline text-xs">
                            重新申请重置密码
                        </Link>
                    </CardFooter>
                </Card>
            </AuthShell>
        );
    }

    return (
        <AuthShell title="设置新的登录凭据" description="为你的 RadicalSMP 账户设置新密码，完成后即可返回登录。">
            <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 rounded-lg border bg-background/82 shadow-2xl backdrop-blur-xl motion-reduce:animate-none">
                <CardHeader>
                    <CardTitle className="text-lg md:text-xl">重置密码</CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                        输入您的新密码
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="grid gap-4" onSubmit={handleSubmit}>
                        <div className="grid gap-2">
                            <Label htmlFor="password">新密码</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password_confirmation">确认新密码</Label>
                            <Input
                                id="password_confirmation"
                                name="passwordConfirmation"
                                type="password"
                                autoComplete="new-password"
                                required
                                minLength={8}
                                value={passwordConfirmation}
                                onChange={(e) => setPasswordConfirmation(e.target.value)}
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={loading || !password || !passwordConfirmation}
                        >
                            {loading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                "重置密码"
                            )}
                        </Button>
                    </form>
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
