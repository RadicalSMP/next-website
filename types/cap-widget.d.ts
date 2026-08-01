import type { DetailedHTMLProps, HTMLAttributes, Ref } from "react";

type CapWidgetElement = HTMLElement & {
    reset: () => void;
    solve: () => Promise<{ success: boolean; token: string }>;
    token: string | null;
};

type CapWidgetAttributes = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
    ref?: Ref<CapWidgetElement>;
    "data-cap-api-endpoint": string;
    "data-cap-i18n-initial-state"?: string;
    "data-cap-i18n-verifying-label"?: string;
    "data-cap-i18n-solved-label"?: string;
    "data-cap-i18n-error-label"?: string;
};

declare module "react" {
    namespace JSX {
        interface IntrinsicElements {
            "cap-widget": CapWidgetAttributes;
        }
    }
}

export {};
