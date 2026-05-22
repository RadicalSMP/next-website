"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useState, useMemo, useSyncExternalStore } from "react";
import Image from "next/image";
import { Loader2, X, Check, Circle, TicketCheck } from "lucide-react";
import { signUp } from "@/lib/auth-client";
import { toast } from "sonner";
import { translateErrorMessage } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { RiArrowRightUpBoxLine } from "react-icons/ri";

/** 密码强度规则 */
const PASSWORD_RULES = [
    { key: "length", label: "至少 8 个字符", test: (pw: string) => pw.length >= 8 },
    { key: "uppercase", label: "包含大写字母", test: (pw: string) => /[A-Z]/.test(pw) },
    { key: "lowercase", label: "包含小写字母", test: (pw: string) => /[a-z]/.test(pw) },
    { key: "number", label: "包含数字", test: (pw: string) => /\d/.test(pw) },
    { key: "symbol", label: "包含符号", test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
] as const;

/** 计算密码强度（长度合格 + 字符类型满足 ≥2 种） */
function evaluatePassword(password: string) {
    const passed = PASSWORD_RULES.map((rule) => ({
        ...rule,
        met: rule.test(password),
    }));

    const lengthOk = passed[0].met;
    // 大写、小写、数字、符号中满足的种类数
    const categoryCount = passed.slice(1).filter((r) => r.met).length;
    const categoryOk = categoryCount >= 2;
    const isValid = lengthOk && categoryOk;

    // 强度百分比：长度占 40%，每种字符类型占 15%
    let strength = 0;
    if (lengthOk) strength += 40;
    strength += Math.min(categoryCount, 4) * 15;

    return { passed, isValid, strength };
}

/** 强度等级文案 & 颜色 */
function getStrengthMeta(strength: number) {
    if (strength <= 0) return { text: "", color: "" };
    if (strength <= 40) return { text: "弱", color: "text-red-500" };
    if (strength <= 70) return { text: "中", color: "text-yellow-500" };
    return { text: "强", color: "text-green-500" };
}

/** Progress 条颜色类名 */
function getProgressColor(strength: number) {
    if (strength <= 40) return "[&>[data-slot=progress-indicator]]:bg-red-500";
    if (strength <= 70) return "[&>[data-slot=progress-indicator]]:bg-yellow-500";
    return "[&>[data-slot=progress-indicator]]:bg-green-500";
}

function subscribeToLocationChange() {
    return () => {};
}

function getLocationSearch() {
    if (typeof window === "undefined") {
        return "";
    }

    return window.location.search;
}

export default function SignUp() {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [invitationCode, setInvitationCode] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const locationSearch = useSyncExternalStore(
        subscribeToLocationChange,
        getLocationSearch,
        () => "",
    );
    const lockedFields = useMemo(() => {
        const params = new URLSearchParams(locationSearch);

        return {
            email: params.get("e")?.trim() || "",
            invitationCode: params.get("i")?.trim() || "",
        };
    }, [locationSearch]);
    const effectiveEmail = lockedFields.email || email;
    const effectiveInvitationCode = lockedFields.invitationCode || invitationCode;

    // 密码强度评估
    const { passed: passwordChecks, isValid: isPasswordValid, strength: passwordStrength } =
        useMemo(() => evaluatePassword(password), [password]);
    const strengthMeta = useMemo(() => getStrengthMeta(passwordStrength), [passwordStrength]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex justify-center items-center h-screen">
            <Card className="z-50 rounded-md rounded-t-none max-w-md flex flex-1">
                <CardHeader>
                    <CardTitle className="text-lg md:text-xl">注册</CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                        填写信息以注册您的账户
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4">
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="username">用户名</Label>
                                <Input
                                    id="first-name"
                                    placeholder="Dk_Iw"
                                    required
                                    onChange={(e) => {
                                        setUsername(e.target.value);
                                    }}
                                    value={username}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="dk_iw@radicalsmp.org"
                                required
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                }}
                                value={effectiveEmail}
                                disabled={Boolean(lockedFields.email)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">密码</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                            {/* 密码强度指示器 */}
                            {password.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Progress
                                            value={passwordStrength}
                                            className={`h-1.5 flex-1 ${getProgressColor(passwordStrength)}`}
                                        />
                                        <span className={`text-xs font-medium ${strengthMeta.color}`}>
                                            {strengthMeta.text}
                                        </span>
                                    </div>
                                    <ul className="space-y-1">
                                        {passwordChecks.map((rule) => (
                                            <li
                                                key={rule.key}
                                                className={`flex items-center gap-1.5 text-xs ${rule.met
                                                        ? "text-green-500"
                                                        : "text-muted-foreground"
                                                    }`}
                                            >
                                                {rule.met ? (
                                                    <Check className="size-3" />
                                                ) : (
                                                    <Circle className="size-3" />
                                                )}
                                                {rule.label}
                                            </li>
                                        ))}
                                        <li
                                            className={`flex items-center gap-1.5 text-xs ${passwordChecks.slice(1).filter((r) => r.met).length >= 2
                                                    ? "text-green-500"
                                                    : "text-muted-foreground"
                                                }`}
                                        >
                                            {passwordChecks.slice(1).filter((r) => r.met).length >= 2 ? (
                                                <Check className="size-3" />
                                            ) : (
                                                <Circle className="size-3" />
                                            )}
                                            以上字符类型至少满足 2 种
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password_confirmation">确认密码</Label>
                            <Input
                                id="password_confirmation"
                                type="password"
                                value={passwordConfirmation}
                                onChange={(e) => setPasswordConfirmation(e.target.value)}
                                autoComplete="new-password"
                            />
                            {/* 密码不一致提示 */}
                            {passwordConfirmation.length > 0 && password !== passwordConfirmation && (
                                <p className="text-xs text-red-500">两次输入的密码不一致</p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="image">头像 (可选)</Label>
                            <div className="flex items-end gap-4">
                                {imagePreview && (
                                    <div className="relative w-16 h-16 rounded-sm overflow-hidden">
                                        <Image
                                            src={imagePreview}
                                            alt="Profile preview"
                                            layout="fill"
                                            objectFit="cover"
                                        />
                                    </div>
                                )}
                                <div className="flex items-center gap-2 w-full">
                                    <Input
                                        id="image"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="w-full"
                                    />
                                    {imagePreview && (
                                        <X
                                            className="cursor-pointer"
                                            onClick={() => {
                                                setImage(null);
                                                setImagePreview(null);
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="invitationCode">
                                <span className="flex items-center gap-1.5">
                                    <TicketCheck className="size-4" />
                                    邀请码
                                </span>
                            </Label>
                            <Input
                                id="invitationCode"
                                placeholder="请输入邀请码"
                                required
                                value={effectiveInvitationCode}
                                onChange={(e) => setInvitationCode(e.target.value)}
                                disabled={Boolean(lockedFields.invitationCode)}
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={loading || !isPasswordValid || password !== passwordConfirmation || !effectiveInvitationCode.trim()}
                            onClick={async () => {
                                if (!isPasswordValid) {
                                    toast.error("密码不满足强度要求");
                                    return;
                                }
                                if (password !== passwordConfirmation) {
                                    toast.error("两次输入的密码不一致");
                                    return;
                                }
                                await signUp.email({
                                    email: effectiveEmail,
                                    password,
                                    name: `${username}`,
                                    image: image ? await convertImageToBase64(image) : "",
                                    callbackURL: "/dashboard",
                                    fetchOptions: {
                                        body: {
                                            invitationCode: effectiveInvitationCode.trim(),
                                        },
                                        onResponse: () => {
                                            setLoading(false);
                                        },
                                        onRequest: () => {
                                            setLoading(true);
                                        },
                                        onError: (ctx) => {
                                            toast.error(translateErrorMessage(ctx.error.message));
                                        },
                                        onSuccess: () => {
                                            toast.success("注册成功！请查看邮箱完成验证");
                                            router.push(`/verify-email?email=${encodeURIComponent(effectiveEmail)}`);
                                        },
                                    },
                                });
                            }}
                        >
                            {loading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                "创建账户"
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                router.push("/sign-in");
                            }}
                        >
                            返回登录 <RiArrowRightUpBoxLine />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

async function convertImageToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
