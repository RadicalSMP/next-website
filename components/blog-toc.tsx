"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface TocHeading {
    id: string;
    text: string;
    level: number; // 1, 2, 3
}

/**
 * 博客文章目录导航组件
 * 从正文容器中提取 h1/h2/h3 标题，生成可点击的段落导航。
 * 支持滚动高亮当前阅读位置。
 */
export function BlogTableOfContents({
    contentSelector = ".prose",
}: {
    /** 文章正文容器的 CSS 选择器 */
    contentSelector?: string;
}) {
    const [headings, setHeadings] = useState<TocHeading[]>([]);
    const [activeId, setActiveId] = useState<string>("");

    // 用户点击导航时临时锁定，防止 scroll 事件覆盖 activeId
    const isClickScrolling = useRef(false);
    const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── 提取标题并注入 id ─────────────────────────────────
    useEffect(() => {
        const container = document.querySelector(contentSelector);
        if (!container) return;

        const elements = container.querySelectorAll("h1, h2, h3");
        const items: TocHeading[] = [];

        elements.forEach((el, index) => {
            // 如果标题没有 id，自动生成一个
            if (!el.id) {
                el.id = `heading-${index}`;
            }
            items.push({
                id: el.id,
                text: el.textContent?.trim() || "",
                level: parseInt(el.tagName[1]),
            });
        });

        // 使用 requestAnimationFrame 避免在 effect 中同步调用 setState
        requestAnimationFrame(() => {
            setHeadings(items);
        });
    }, [contentSelector]);

    // ─── scroll 事件跟踪当前阅读位置 ─────────────────────
    // 策略：找到最后一个已经滚过视口顶部（含偏移量）的标题。
    // 这种方式在文章尾部内容较短时也能正确高亮。
    useEffect(() => {
        if (headings.length === 0) return;

        const OFFSET = 100; // 视口顶部偏移量（px），与导航栏高度相关

        const onScroll = () => {
            if (isClickScrolling.current) return;

            let current = "";
            for (const { id } of headings) {
                const el = document.getElementById(id);
                if (!el) continue;
                // 标题顶部已经滚过视口上方偏移线
                if (el.getBoundingClientRect().top <= OFFSET) {
                    current = id;
                }
            }

            // 如果还没滚到任何标题，高亮第一个
            if (!current && headings.length > 0) {
                current = headings[0].id;
            }

            setActiveId(current);
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        // 初始化
        onScroll();

        return () => window.removeEventListener("scroll", onScroll);
    }, [headings]);

    // ─── 平滑滚动到指定标题 ─────────────────────────────
    const scrollTo = useCallback((id: string) => {
        const el = document.getElementById(id);
        if (!el) return;

        // 立即设置高亮，并锁定，防止滚动过程中被覆盖
        setActiveId(id);
        isClickScrolling.current = true;

        // 清除之前的定时器
        if (clickTimer.current) {
            clearTimeout(clickTimer.current);
        }

        el.scrollIntoView({ behavior: "smooth", block: "start" });

        // 滚动动画结束后解锁（smooth scroll 一般 300-800ms）
        clickTimer.current = setTimeout(() => {
            isClickScrolling.current = false;
        }, 900);
    }, []);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (clickTimer.current) {
                clearTimeout(clickTimer.current);
            }
        };
    }, []);

    if (headings.length === 0) return null;

    // 计算最小层级，用于缩进计算
    const minLevel = Math.min(...headings.map((h) => h.level));

    return (
        <nav className="blog-toc" aria-label="文章目录">
            <h2 className="text-sm font-semibold text-foreground mb-3">
                目录
            </h2>
            <ul className="border-l-2 border-border text-[13px] leading-relaxed">
                {headings.map((heading, index) => {
                    const isActive = activeId === heading.id;
                    const indent = (heading.level - minLevel) * 12;
                    // 判断是否是新的顶级层级段落（用于添加上方间距）
                    const prevHeading = index > 0 ? headings[index - 1] : null;
                    const isNewSection =
                        prevHeading !== null &&
                        heading.level <= minLevel &&
                        prevHeading.level > heading.level;

                    return (
                        <li
                            key={heading.id}
                            className={cn(isNewSection && "mt-3")}
                        >
                            <button
                                onClick={() => scrollTo(heading.id)}
                                className={cn(
                                    "text-left w-full py-1.5 pr-2",
                                    // 左侧高亮指示条（覆盖在 ul 的 border 上）
                                    "-ml-[2px] border-l-2",
                                    // 过渡动画
                                    "transition-all duration-300 ease-in-out",
                                    "origin-left",
                                    isActive
                                        ? "border-foreground text-foreground font-medium scale-[1.04]"
                                        : "border-transparent text-muted-foreground hover:text-foreground/70 scale-100",
                                )}
                                style={{ paddingLeft: `${indent + 14}px` }}
                                title={heading.text}
                            >
                                <span className="line-clamp-2">{heading.text}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
