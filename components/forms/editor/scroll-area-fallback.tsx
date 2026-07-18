import { cn } from "@/lib/utils";

export function ScrollAreaFallback({
    className,
    children,
}: {
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={cn("overflow-auto", className)}>
            {children}
        </div>
    );
}
