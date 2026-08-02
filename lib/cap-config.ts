export const CAPTCHA_DISABLED =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_CAPTCHA_DISABLED === "true";

export const CAPTCHA_DEVELOPMENT_TOKEN = "development-captcha-disabled";
