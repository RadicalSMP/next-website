"use client";

import Script from "next/script";
import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import {
    CAPTCHA_DEVELOPMENT_TOKEN,
    CAPTCHA_DISABLED,
} from "@/lib/cap-config";

const DEFAULT_CAP_URL = "https://cap.hami.im/";

type CapElement = HTMLElement & {
    reset: () => void;
    solve: () => Promise<{ success: boolean; token: string }>;
    token: string | null;
};

type CapSolveEvent = CustomEvent<{ token: string }>;

export type CapWidgetHandle = {
    reset: () => void;
};

type CapWidgetProps = {
    onTokenChange: (token: string | null) => void;
};

function getCapUrls() {
    const baseUrl = new URL(process.env.NEXT_PUBLIC_CAP_API_URL || DEFAULT_CAP_URL);
    const pathname = baseUrl.pathname.replace(/\/+$/, "");
    const apiUrl = new URL(baseUrl);

    apiUrl.pathname = pathname.endsWith("/api") ? `${pathname}/` : `${pathname}/api/`;
    apiUrl.search = "";
    apiUrl.hash = "";

    const scriptUrl = new URL(baseUrl);
    scriptUrl.pathname = pathname.endsWith("/api")
        ? `${pathname.slice(0, -4)}/cap.min.js`
        : `${pathname}/cap.min.js`;
    scriptUrl.search = "";
    scriptUrl.hash = "";

    return { apiUrl: apiUrl.toString(), scriptUrl: scriptUrl.toString() };
}

const CAP_URLS = getCapUrls();

export const CapWidget = forwardRef<CapWidgetHandle, CapWidgetProps>(function CapWidget(
    { onTokenChange },
    ref,
) {
    const widgetRef = useRef<CapElement | null>(null);
    const [loadError, setLoadError] = useState(false);

    useImperativeHandle(ref, () => ({
        reset: () => {
            if (CAPTCHA_DISABLED) {
                onTokenChange(CAPTCHA_DEVELOPMENT_TOKEN);
                return;
            }

            widgetRef.current?.reset?.();
            onTokenChange(null);
        },
    }), [onTokenChange]);

    useEffect(() => {
        if (CAPTCHA_DISABLED) {
            onTokenChange(CAPTCHA_DEVELOPMENT_TOKEN);
            return;
        }

        const widget = widgetRef.current;
        if (!widget) return;

        const handleSolve = (event: Event) => {
            const token = (event as CapSolveEvent).detail?.token;
            onTokenChange(typeof token === "string" && token ? token : null);
        };
        const handleReset = () => onTokenChange(null);
        const handleError = () => onTokenChange(null);

        widget.addEventListener("solve", handleSolve);
        widget.addEventListener("reset", handleReset);
        widget.addEventListener("error", handleError);

        return () => {
            widget.removeEventListener("solve", handleSolve);
            widget.removeEventListener("reset", handleReset);
            widget.removeEventListener("error", handleError);
        };
    }, [onTokenChange]);

    if (CAPTCHA_DISABLED) {
        return null;
    }

    return (
        <div className="grid gap-2">
            <Script
                id="cap-widget-script"
                src={CAP_URLS.scriptUrl}
                strategy="afterInteractive"
                onError={() => {
                    setLoadError(true);
                    onTokenChange(null);
                }}
            />
            {loadError ? (
                <p role="alert" className="text-sm text-destructive">
                    安全验证组件加载失败，请刷新页面后重试
                </p>
            ) : (
                <cap-widget
                    ref={widgetRef}
                    data-cap-api-endpoint={CAP_URLS.apiUrl}
                    data-cap-i18n-initial-state="点击开始验证"
                    data-cap-i18n-verifying-label="正在验证..."
                    data-cap-i18n-solved-label="验证已通过"
                    data-cap-i18n-error-label="验证失败，请重试"
                />
            )}
        </div>
    );
});
