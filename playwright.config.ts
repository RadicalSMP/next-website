import { defineConfig } from "@playwright/test";

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
    testDir: "./e2e",
    testMatch: "**/*.e2e.ts",
    outputDir: "./output/playwright/test-results",
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: [["list"], ["html", { outputFolder: "./output/playwright/report", open: "never" }]],
    use: {
        baseURL: "http://127.0.0.1:3100",
        locale: "zh-CN",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        launchOptions: chromiumExecutable ? { executablePath: chromiumExecutable } : undefined,
    },
    webServer: {
        command: "bun run dev -- --port 3100",
        url: "http://127.0.0.1:3100",
        timeout: 120_000,
        reuseExistingServer: false,
        env: {
            NEXT_PUBLIC_CAPTCHA_DISABLED: "true",
            NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
            BETTER_AUTH_BASE_URL: "http://127.0.0.1:3100",
        },
    },
    projects: [
        {
            name: "chromium",
            use: { browserName: "chromium" },
        },
    ],
});
