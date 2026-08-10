import { describe, expect, test } from "bun:test";
import { buildPasswordResetEmail, buildVerificationEmail } from "@/lib/email";

describe("认证邮件转义", () => {
    test("验证邮件转义姓名和链接", () => {
        const content = buildVerificationEmail({
            userName: `<img src=x onerror=alert(1)>`,
            verifyUrl: `https://example.com/verify?x=\" onmouseover=\"alert(1)`,
        });

        expect(content.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
        expect(content.html).toContain("&quot; onmouseover=&quot;");
        expect(content.html).not.toContain("<img src=x");
    });

    test("密码重置邮件使用同一转义边界", () => {
        const content = buildPasswordResetEmail({
            userName: `用户<script>alert(1)</script>`,
            resetUrl: `https://example.com/reset?a=1&b=2`,
        });

        expect(content.html).toContain("用户&lt;script&gt;alert(1)&lt;/script&gt;");
        expect(content.html).toContain("a=1&amp;b=2");
        expect(content.html).not.toContain("<script>");
    });
});
