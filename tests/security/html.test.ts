import { describe, expect, test } from "bun:test";
import { sanitizeBlogHtml } from "@/lib/security/html";

describe("博客 HTML 清洗", () => {
    test("保留 Tiptap 常用标记并移除脚本和事件属性", () => {
        const html = sanitizeBlogHtml(`
            <h2 id="intro" onclick="alert(1)">标题</h2>
            <script>alert(document.cookie)</script>
            <p><strong>正文</strong><img src="https://example.com/a.png" onerror="alert(1)"></p>
            <pre><code class="language-typescript hljs-keyword">const x = 1</code></pre>
        `);

        expect(html).toContain("<h2 id=\"intro\">标题</h2>");
        expect(html).toContain("<strong>正文</strong>");
        expect(html).toContain("language-typescript");
        expect(html).not.toContain("<script");
        expect(html).not.toContain("onclick");
        expect(html).not.toContain("onerror");
    });

    test("移除危险协议并固定链接 rel", () => {
        const html = sanitizeBlogHtml(
            `<a href="javascript:alert(1)" rel="opener">危险</a><img src="data:image/svg+xml,evil">`,
        );

        expect(html).toContain("rel=\"noopener noreferrer\"");
        expect(html).not.toContain("javascript:");
        expect(html).not.toContain("data:image");
    });
});
