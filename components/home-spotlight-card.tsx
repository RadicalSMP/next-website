"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type HomeSpotlightCardProps = React.ComponentProps<"div"> & {
    highlight?: string;
};

export function HomeSpotlightCard({
    className,
    highlight = "rgba(132, 204, 22, 0.18)",
    onMouseMove,
    onMouseLeave,
    style,
    ...props
}: HomeSpotlightCardProps) {
    const cardRef = React.useRef<HTMLDivElement>(null);

    return (
        <div
            ref={cardRef}
            className={cn(
                "group relative overflow-hidden rounded-lg border bg-card p-5 text-card-foreground shadow-sm transition-colors",
                "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-300",
                "before:bg-[radial-gradient(360px_circle_at_var(--spotlight-x)_var(--spotlight-y),var(--spotlight-color),transparent_58%)]",
                "hover:border-foreground/20 hover:before:opacity-100",
                className,
            )}
            style={{
                "--spotlight-x": "50%",
                "--spotlight-y": "50%",
                "--spotlight-color": highlight,
                ...style,
            } as React.CSSProperties}
            onMouseMove={(event) => {
                const rect = cardRef.current?.getBoundingClientRect();
                if (rect) {
                    cardRef.current?.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
                    cardRef.current?.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
                }
                onMouseMove?.(event);
            }}
            onMouseLeave={(event) => {
                cardRef.current?.style.setProperty("--spotlight-x", "50%");
                cardRef.current?.style.setProperty("--spotlight-y", "50%");
                onMouseLeave?.(event);
            }}
            {...props}
        />
    );
}
