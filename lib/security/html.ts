import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
    "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "strike",
    "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote",
    "pre", "code", "a", "img", "span",
];

/** 清洗 Tiptap 生成的文章 HTML，阻止存储型 XSS。 */
export function sanitizeBlogHtml(value: unknown): string {
    if (typeof value !== "string") return "";

    return sanitizeHtml(value, {
        allowedTags: ALLOWED_TAGS,
        allowedAttributes: {
            a: ["href", "title", "target", "rel"],
            img: ["src", "alt", "title", "width", "height", "loading", "class"],
            code: ["class"],
            pre: ["class"],
            span: ["class"],
            h1: ["id"],
            h2: ["id"],
            h3: ["id"],
            h4: ["id"],
            h5: ["id"],
            h6: ["id"],
        },
        allowedClasses: {
            img: ["rounded-lg", "max-w-full"],
            code: [/^language-[a-z0-9_-]+$/i, /^hljs(?:-[a-z0-9_-]+)?$/i],
            pre: [/^language-[a-z0-9_-]+$/i, "hljs"],
            span: [/^hljs-[a-z0-9_-]+$/i],
        },
        allowedSchemes: ["http", "https", "mailto"],
        allowedSchemesByTag: {
            img: ["http", "https"],
        },
        allowProtocolRelative: false,
        transformTags: {
            a: (_tagName, attribs) => ({
                tagName: "a",
                attribs: {
                    ...attribs,
                    rel: "noopener noreferrer",
                },
            }),
            img: (_tagName, attribs) => ({
                tagName: "img",
                attribs: {
                    ...attribs,
                    loading: "lazy",
                },
            }),
        },
    });
}
