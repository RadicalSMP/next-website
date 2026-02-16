"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { toast } from "sonner";
import { translateErrorMessage } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignIn() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const router = useRouter();

    return (
        <div className="flex justify-center items-center h-screen">
            <Card className="z-50 rounded-md rounded-t-none max-w-md flex flex-1">
                <CardHeader>
                    <CardTitle className="text-lg md:text-xl">登录</CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                        使用电子邮箱与密码以登录到您的账户
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">电子邮箱</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="dk_iw@radicalsmp.org"
                                required
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                }}
                                value={email}
                            />
                        </div>

                        <div className="grid gap-2">
                            <div className="flex items-center">
                                <Label htmlFor="password">密码</Label>
                            </div>

                            <Input
                                id="password"
                                type="password"
                                autoComplete="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="remember"
                                onClick={() => {
                                    setRememberMe(!rememberMe);
                                }}
                            />
                            <Label htmlFor="remember">记住我</Label>
                        </div>
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={loading}
                            onClick={async () => {
                                await signIn.email({
                                    email,
                                    password,
                                    rememberMe,
                                    fetchOptions: {
                                        onRequest: () => {
                                            setLoading(true);
                                        },
                                        onResponse: () => {
                                            setLoading(false);
                                        },
                                        onError: (ctx) => {
                                            if (ctx.error.message === "Email not verified") {
                                                toast.error("邮箱未验证", {
                                                    description: "请查看邮箱中的验证链接",
                                                    action: {
                                                        label: "前往验证",
                                                        onClick: () => {
                                                            router.push(`/verify-email?email=${encodeURIComponent(email)}`);
                                                        },
                                                    },
                                                });
                                            } else {
                                                toast.error(translateErrorMessage(ctx.error.message));
                                            }
                                        },
                                        onSuccess: () => {
                                            router.push("/");
                                        },
                                    },
                                });
                            }}
                        >
                            {loading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <p>登录</p>
                            )}
                        </Button>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <p className="text-xs">
                        <Link href="/forgot-password" className="underline">
                            忘记密码?
                        </Link>
                    </p>
                    <p className="text-xs">
                        没有账号? {" "}
                        <Link href="/sign-up" className="underline">
                            前往注册
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}