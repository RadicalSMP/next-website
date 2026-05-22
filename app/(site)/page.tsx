import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronRight, Compass, FileText, Gamepad2, MessageCircle, Pickaxe, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeSpotlightCard } from "@/components/home-spotlight-card";
import { org } from "@/app/resource/content";

const quickStats = [
    { label: "长期世界", value: "SMP", desc: "以生存协作为核心的社区服务器" },
    { label: "审核入服", value: "Invite", desc: "使用表单与邀请码控制成员质量" },
    { label: "社区共创", value: "Build", desc: "建筑、红石、活动与内容一起推进" },
];

const sections = [
    {
        icon: Compass,
        title: "清晰的服务器秩序",
        desc: "围绕公平、真诚与共创建立规则，减少无意义消耗，把精力留给建造、探索和合作。",
    },
    {
        icon: Pickaxe,
        title: "适合长期游玩的节奏",
        desc: "从资源规划到项目协作，鼓励玩家用更稳定的方式参与，而不是短期冲刺后快速流失。",
    },
    {
        icon: ShieldCheck,
        title: "可追踪的管理流程",
        desc: "入服、公告、表单和后台管理逐步收拢到网站中，后续会继续补齐更多自助能力。",
    },
];

const timeline = [
    { title: "提交入服申请", desc: "填写基础信息与游玩偏好，部分字段后续会根据邀请码自动补全。" },
    { title: "等待人工审核", desc: "管理员会结合申请内容和社区状态处理，当前文案可后续替换为正式规则。" },
    { title: "加入社区频道", desc: "通过后进入 QQ 群或其他频道，获取服务器地址、白名单与活动信息。" },
];

const updates = [
    "入服表单与审核后台正在完善中",
    "博客区将用于沉淀公告、活动记录和技术文章",
    "名人堂页面已开放，后续补充更多社区成员资料",
];

export default function Home() {
    return (
        <div className="min-h-screen overflow-hidden bg-background text-foreground">
            <section className="relative min-h-[calc(100vh-5rem)] px-4 pb-12 pt-8 sm:px-6 lg:px-8">
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(34,197,94,0.16),transparent_30%),radial-gradient(circle_at_82%_22%,rgba(14,165,233,0.14),transparent_28%),linear-gradient(180deg,transparent,rgba(0,0,0,0.03))] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(34,197,94,0.18),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(14,165,233,0.16),transparent_30%),linear-gradient(180deg,transparent,rgba(255,255,255,0.04))]" />
                <div className="absolute inset-x-0 top-16 -z-10 h-80 opacity-70 blur-3xl">
                    <div className="mx-auto h-full max-w-5xl animate-[pulse_8s_ease-in-out_infinite] bg-[conic-gradient(from_120deg,rgba(132,204,22,0.18),rgba(14,165,233,0.12),rgba(244,244,245,0.1),rgba(132,204,22,0.18))]" />
                </div>

                <div className="mx-auto grid min-h-[calc(100vh-9rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.06fr_0.94fr]">
                    <div className="max-w-3xl">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-sm text-muted-foreground backdrop-blur">
                            <Sparkles className="size-4 text-lime-500" />
                            Minecraft 社区服务器
                        </div>
                        <h1 className="text-4xl font-semibold leading-tight tracking-normal sm:text-6xl lg:text-7xl">
                            RadicalSMP
                        </h1>
                        <p className="mt-4 text-xl text-muted-foreground sm:text-2xl">
                            {org.name_cn}
                        </p>
                        <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                            一个围绕公平、长期协作和社区共创搭建的 Minecraft SMP。这里会逐步沉淀入服申请、社区公告、活动记录、玩家作品与管理工具。
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Button size="lg" asChild>
                                <Link href="/forms">
                                    查看表单
                                    <ArrowRight className="size-4" />
                                </Link>
                            </Button>
                            <Button size="lg" variant="outline" asChild>
                                <Link href="/about">
                                    了解社区
                                    <ChevronRight className="size-4" />
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="relative mx-auto aspect-square max-w-[460px] overflow-hidden rounded-lg border bg-card shadow-2xl">
                            <Image
                                src="/images/rsmp_logo_web.jpg"
                                alt="RadicalSMP 社区标识"
                                fill
                                priority
                                sizes="(min-width: 1024px) 460px, 88vw"
                                className="object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                                <p className="text-sm text-white/70">当前状态</p>
                                <p className="mt-1 text-2xl font-semibold">社区系统建设中</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-y bg-muted/30 px-4 py-6 sm:px-6 lg:px-8">
                <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
                    {quickStats.map((item) => (
                        <div key={item.label} className="rounded-lg border bg-background p-5">
                            <p className="text-sm text-muted-foreground">{item.label}</p>
                            <p className="mt-2 text-3xl font-semibold">{item.value}</p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="px-4 py-20 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl">
                    <div className="max-w-2xl">
                        <p className="text-sm font-medium text-lime-600 dark:text-lime-400">社区特性</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">把服务器当作长期项目经营</h2>
                        <p className="mt-4 text-muted-foreground">
                            首页先补齐基础内容框架，后续可以把这些占位说明替换为正式规则、活动介绍和服务器历史。
                        </p>
                    </div>

                    <div className="mt-10 grid gap-4 md:grid-cols-3">
                        {sections.map((item) => {
                            const Icon = item.icon;
                            return (
                                <HomeSpotlightCard key={item.title}>
                                    <Icon className="size-6 text-lime-600 dark:text-lime-400" />
                                    <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.desc}</p>
                                </HomeSpotlightCard>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
                <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
                    <div>
                        <p className="text-sm font-medium text-sky-600 dark:text-sky-400">加入流程</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">从申请到入服，流程保持可追踪</h2>
                        <p className="mt-4 text-muted-foreground">
                            当前流程文案是占位版本，后续可以接入真实审核说明、白名单规则和成员手册。
                        </p>
                    </div>
                    <div className="space-y-3">
                        {timeline.map((item, index) => (
                            <div key={item.title} className="grid grid-cols-[2.5rem_1fr] gap-4 rounded-lg border bg-background p-5">
                                <div className="flex size-10 items-center justify-center rounded-md bg-foreground text-sm font-semibold text-background">
                                    {index + 1}
                                </div>
                                <div>
                                    <h3 className="font-semibold">{item.title}</h3>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="px-4 py-20 sm:px-6 lg:px-8">
                <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-3">
                    <HomeSpotlightCard className="lg:col-span-2" highlight="rgba(14, 165, 233, 0.18)">
                        <div className="flex items-center gap-3">
                            <CalendarDays className="size-6 text-sky-600 dark:text-sky-400" />
                            <h2 className="text-2xl font-semibold">近期事项</h2>
                        </div>
                        <div className="mt-6 grid gap-3">
                            {updates.map((item) => (
                                <div key={item} className="flex items-start gap-3 rounded-md border bg-background/70 p-4">
                                    <FileText className="mt-0.5 size-4 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">{item}</p>
                                </div>
                            ))}
                        </div>
                    </HomeSpotlightCard>

                    <HomeSpotlightCard highlight="rgba(132, 204, 22, 0.2)">
                        <UsersRound className="size-6 text-lime-600 dark:text-lime-400" />
                        <h2 className="mt-5 text-2xl font-semibold">社区入口</h2>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">
                            通过公开页面了解服务器，通过表单提交申请，通过社区频道继续参与讨论与建设。
                        </p>
                        <div className="mt-6 grid gap-2">
                            <Button variant="outline" asChild>
                                <Link href="/blogs">
                                    <Gamepad2 className="size-4" />
                                    阅读博客
                                </Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <a href={org.social[1]?.link} target="_blank" rel="noopener noreferrer">
                                    <MessageCircle className="size-4" />
                                    加入 QQ 群
                                </a>
                            </Button>
                        </div>
                    </HomeSpotlightCard>
                </div>
            </section>
        </div>
    );
}
