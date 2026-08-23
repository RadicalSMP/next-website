import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const screenshotDirectory = "output/playwright/screenshots";

async function expectNoHorizontalOverflow(page: Page) {
    const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function waitForReactHydration(locator: Locator) {
    await expect.poll(() => locator.evaluate((element) => (
        Object.keys(element).some((key) => key.startsWith("__reactProps$"))
    ))).toBe(true);
}

test.describe("响应式公开页面", () => {
    for (const viewport of [
        { name: "mobile", width: 360, height: 800 },
        { name: "tablet", width: 768, height: 1024 },
        { name: "desktop", width: 1440, height: 900 },
    ]) {
        test(`${viewport.width}px 下无横向溢出`, async ({ page }) => {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.goto("/");
            await expect(page.getByRole("heading", { level: 1, name: "RadicalSMP" })).toBeVisible();
            await expectNoHorizontalOverflow(page);

            mkdirSync(screenshotDirectory, { recursive: true });
            await page.screenshot({
                path: `${screenshotDirectory}/home-${viewport.name}-${viewport.width}.png`,
                fullPage: true,
            });
        });
    }

    test("移动菜单支持键盘并在关闭后恢复焦点", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 800 });
        await page.goto("/");
        const trigger = page.getByRole("button", { name: "打开导航菜单" });
        await waitForReactHydration(trigger);
        await trigger.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.getByRole("navigation", { name: "移动端主导航" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toBeHidden();
        await expect(trigger).toBeFocused();
    });

    test("减少动态效果偏好会停止装饰动画", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("/");
        const duration = await page.locator('[class*="animate-"]').first().evaluate((element) => (
            Number.parseFloat(getComputedStyle(element).animationDuration) || 0
        ));
        expect(duration).toBeLessThanOrEqual(0.001);
    });
});

test("登录表单可通过回车提交", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/api/auth/**", async (route) => {
        if (route.request().method() === "POST") requestCount += 1;
        await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ message: "Invalid email or password" }),
        });
    });
    await page.goto("/sign-in");
    await page.getByLabel("电子邮箱").fill("test@example.com");
    await page.getByLabel("密码").fill("StrongPassword1!");
    const submitButton = page.getByRole("button", { name: "登录" });
    await waitForReactHydration(submitButton);
    await expect(submitButton).toBeEnabled();
    await page.getByLabel("密码").press("Enter");
    await expect.poll(() => requestCount).toBe(1);
});

test("动态表单错误与字段关联并聚焦首个错误", async ({ page }) => {
    await page.goto("/forms");
    const links = await page.locator('a[href^="/forms/"]').evaluateAll((elements) => (
        elements
            .map((element) => element.getAttribute("href"))
            .filter((href): href is string => Boolean(href && !href.includes("my-submissions")))
    ));

    let formFound = false;
    for (const href of [...new Set(links)]) {
        await page.goto(href);
        if (await page.getByRole("button", { name: /提交/ }).count()) {
            formFound = true;
            break;
        }
    }
    test.skip(!formFound, "隔离开发数据库中没有可访问的已发布表单");

    const firstControl = page.locator("form [name]").first();
    const fieldKey = await firstControl.getAttribute("name");
    expect(fieldKey).toBeTruthy();
    await page.route("**/api/forms/*/submissions", (route) => route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "测试字段格式不正确", fieldKey, code: "test_error" }),
    }));

    const submitButton = page.getByRole("button", { name: /提交/ });
    await waitForReactHydration(submitButton);
    await submitButton.click();
    const invalidControl = page.locator('[aria-invalid="true"]').first();
    await expect(invalidControl).toBeVisible();
    const describedBy = await invalidControl.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy?.split(" ").at(-1)}`)).toBeVisible();
    await expect(invalidControl).toBeFocused();
});

for (const path of ["/", "/about", "/blogs", "/forms"]) {
    test(`${path} 无 serious/critical axe 问题`, async ({ page }) => {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).analyze();
        const violations = results.violations.filter((violation) => (
            violation.impact === "serious" || violation.impact === "critical"
        ));
        expect(violations).toEqual([]);
    });
}
