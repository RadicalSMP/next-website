"use client";

import { famous } from "@/app/resource/content";
import { HomeSpotlightCard } from "@/components/home-spotlight-card";
import { Input } from "@/components/ui/input";
import { Search, Sparkles } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

export default function FameWall() {
    const [query, setQuery] = useState("");

    const stats = useMemo(() => {
        const total = famous.length;
        const roles = new Set(famous.map((item) => item.role.split(" / ")[0]));
        const tags = new Set(famous.flatMap((item) => item.tags));

        return [
            { label: "人物条目", value: total.toString(), desc: "当前名人堂收录成员" },
            { label: "角色类别", value: roles.size.toString(), desc: "覆盖的主要职责分组" },
            { label: "标签数量", value: tags.size.toString(), desc: "用于快速识别的身份标签" },
        ];
    }, []);

    const filteredFamous = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        if (!keyword) return famous;

        return famous.filter((person) => {
            return (
                person.name.toLowerCase().includes(keyword) ||
                person.desc.toLowerCase().includes(keyword)
            );
        });
    }, [query]);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <section className="relative isolate overflow-hidden border-b px-4 py-12 sm:px-6 lg:px-8">
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,rgba(132,204,22,0.16),transparent_28%),radial-gradient(circle_at_78%_12%,rgba(14,165,233,0.14),transparent_25%),linear-gradient(180deg,transparent,rgba(0,0,0,0.03))] dark:bg-[radial-gradient(circle_at_12%_18%,rgba(132,204,22,0.18),transparent_28%),radial-gradient(circle_at_78%_12%,rgba(14,165,233,0.14),transparent_25%),linear-gradient(180deg,transparent,rgba(255,255,255,0.03))]" />
                <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:44px_44px] text-foreground/30 [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />

                <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
                    <div className="max-w-3xl">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-sm text-muted-foreground backdrop-blur">
                            <Sparkles className="size-4 text-lime-500" />
                            服内人物档案
                        </div>
                        <h1 className="text-4xl font-semibold tracking-normal sm:text-5xl">
                            冥人唐
                        </h1>
                        <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                            收录在 RadicalSMP 中承担管理、建设、维护与协作职责的成员。当前内容保持占位结构，后续可继续补充正式介绍、贡献记录和人物故事。
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                        {stats.map((item) => (
                            <div key={item.label} className="rounded-lg border bg-background/80 p-4 shadow-sm backdrop-blur">
                                <p className="text-xs text-muted-foreground">{item.label}</p>
                                <p className="mt-2 text-3xl font-semibold">{item.value}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="px-4 py-10 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl">
                    <HomeSpotlightCard highlight="rgba(14, 165, 233, 0.18)">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-2xl font-semibold">名人堂检索</h2>
                                <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                                    仅支持按用户名和简介搜索，方便快速定位成员。
                                </p>
                            </div>
                            <div className="w-full md:max-w-sm">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="搜索用户名或简介"
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                        </div>
                    </HomeSpotlightCard>
                </div>
            </section>

            <section className="px-4 pb-16 sm:px-6 lg:px-8">
                <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredFamous.map((person) => {
                        const preview =
                            person.desc.length > 72 ? `${person.desc.slice(0, 72)}...` : person.desc;

                        return (
                            <HomeSpotlightCard
                                key={person.mcid}
                                highlight="rgba(132, 204, 22, 0.14)"
                                className="min-h-[18rem]"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex min-w-0 items-center gap-4">
                                        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border bg-muted shadow-sm">
                                            <Image
                                                src={`https://mc-heads.net/avatar/${person.mcid}/64`}
                                                alt={`${person.name} 的头像`}
                                                width={64}
                                                height={64}
                                                className="size-full object-cover"
                                                unoptimized
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="truncate text-lg font-semibold text-card-foreground">
                                                {person.name}
                                            </h3>
                                            <p className="truncate text-sm text-muted-foreground">
                                                {person.mcid}
                                            </p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {person.role}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 flex flex-wrap gap-2">
                                    {person.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                <div className="mt-5 rounded-lg border bg-background/60 p-4">
                                    <p className="text-sm leading-7 text-muted-foreground">{preview}</p>
                                </div>
                            </HomeSpotlightCard>
                        );
                    })}

                    {filteredFamous.length === 0 && (
                        <div className="rounded-lg border bg-background p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                            没有找到匹配的成员。
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
