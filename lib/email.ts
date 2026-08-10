import { Resend } from "resend";
import type { ResultNotificationTemplate } from "@/lib/forms";

let _resend: Resend | null = null;
function getResend() {
    if (!_resend) {
        _resend = new Resend(process.env.RESEND_API_KEY);
    }
    return _resend;
}

{/* 现在绑上了 hami.su 的域名, 在将来某个日子买了 radicalsmp.org 的域名后, 将它绑上resend, 然后改掉这个发件邮箱w */}
const FROM = "BotamiDragen <botamidragen@hami.su>";

export type FormEmailContent = {
    subject: string;
    html: string;
    text: string;
};

export type GradingEmailItem = {
    label: string;
    score: string | number | null;
    maxScore: string | number;
    comment?: string | null;
    correctAnswer?: unknown;
};

export function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function buildRevisionRequestedEmail(params: {
    formTitle: string;
    reason: string;
    editableFieldLabels: string[];
    expiresAt: Date | null;
    accessUrl: string;
}): FormEmailContent {
    const safeTitle = escapeHtml(params.formTitle);
    const safeReason = escapeHtml(params.reason);
    const safeAccessUrl = escapeHtml(params.accessUrl);
    const fieldSummary = params.editableFieldLabels.length > 0
        ? params.editableFieldLabels.join("、")
        : "全部可填写字段";
    const safeFieldSummary = escapeHtml(fieldSummary);
    const expiresText = params.expiresAt
        ? params.expiresAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
        : "未设置截止时间";
    const safeExpiresText = escapeHtml(expiresText);

    return {
        subject: `请补充表单内容 - ${params.formTitle.replace(/[\r\n]+/g, " ")}`,
        html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #18181b;">
                <h2 style="margin-bottom: 16px;">${safeTitle}</h2>
                <p>管理员需要你补充或修正本次提交。</p>
                <div style="background: #f4f4f5; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
                    <p style="margin: 0 0 6px;"><strong>原因：</strong>${safeReason}</p>
                    <p style="margin: 0 0 6px;"><strong>可修改内容：</strong>${safeFieldSummary}</p>
                    <p style="margin: 0;"><strong>截止时间：</strong>${safeExpiresText}</p>
                </div>
                <a href="${safeAccessUrl}" style="display: inline-block; padding: 12px 20px; background: #171717; color: #fff; text-decoration: none; border-radius: 6px; margin: 8px 0 16px;">
                    查看并补交
                </a>
                <p style="color: #666; font-size: 14px;">该链接仅用于访问你的提交，请勿转发给他人。</p>
            </div>
        `,
        text: [
            params.formTitle,
            "管理员需要你补充或修正本次提交。",
            `原因：${params.reason}`,
            `可修改内容：${fieldSummary}`,
            `截止时间：${expiresText}`,
            `查看并补交：${params.accessUrl}`,
            "该链接仅用于访问你的提交，请勿转发给他人。",
        ].join("\n"),
    };
}

export async function sendFormEmail(params: {
    to: string;
    content: FormEmailContent;
    idempotencyKey?: string;
}) {
    const result = await getResend().emails.send({
        from: FROM,
        to: params.to,
        subject: params.content.subject,
        html: params.content.html,
        text: params.content.text,
    }, params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined);
    if (result.error) {
        throw new Error(result.error.message || "邮件提供商返回失败");
    }
    if (!result.data?.id) {
        throw new Error("邮件提供商未返回消息 ID");
    }
    return { providerMessageId: result.data.id };
}

function sanitizeSubject(value: string) {
    return value.replace(/[\r\n]+/g, " ").trim();
}

function formatEmailValue(value: unknown) {
    if (value === null || value === undefined || value === "") return "未设置";
    if (Array.isArray(value)) return value.map((item) => String(item)).join("、");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function getResultSubject(template: Exclude<ResultNotificationTemplate, null>, formTitle: string) {
    if (template === "join_application_result") return "入服申请结果通知 - RadicalSMP";
    if (template === "score_result") return `表单成绩通知 - ${sanitizeSubject(formTitle)}`;
    return `表单结果通知 - ${sanitizeSubject(formTitle)}`;
}

export function buildGradingCompletedEmail(params: {
    template: Exclude<ResultNotificationTemplate, null>;
    formTitle: string;
    recipientName?: string | null;
    totalScore: string | number | null;
    maxScore: string | number | null;
    items: GradingEmailItem[];
    includeQuestionScores: boolean;
    includeComments: boolean;
    includeCorrectAnswers: boolean;
    resultUrl: string;
}): FormEmailContent {
    const safeTitle = escapeHtml(params.formTitle);
    const safeName = escapeHtml(params.recipientName?.trim() || "你好");
    const safeResultUrl = escapeHtml(params.resultUrl);
    const scoreText = params.totalScore !== null && params.maxScore !== null
        ? `${formatEmailValue(params.totalScore)} / ${formatEmailValue(params.maxScore)}`
        : "暂无总分";
    const safeScoreText = escapeHtml(scoreText);
    const visibleItems = params.items.filter((item) => (
        params.includeQuestionScores ||
        (params.includeComments && Boolean(item.comment)) ||
        (params.includeCorrectAnswers && item.correctAnswer !== undefined)
    ));
    const itemHtml = visibleItems.map((item) => {
        const score = `${formatEmailValue(item.score)} / ${formatEmailValue(item.maxScore)}`;
        return `
            <li style="margin-bottom: 12px;">
                <strong>${escapeHtml(item.label)}</strong>
                ${params.includeQuestionScores ? `<div>得分：${escapeHtml(score)}</div>` : ""}
                ${params.includeComments && item.comment ? `<div>评语：${escapeHtml(item.comment)}</div>` : ""}
                ${params.includeCorrectAnswers && item.correctAnswer !== undefined
                    ? `<div>正确答案：${escapeHtml(formatEmailValue(item.correctAnswer))}</div>`
                    : ""}
            </li>
        `;
    }).join("");
    const itemText = visibleItems.flatMap((item) => {
        const lines = [item.label];
        if (params.includeQuestionScores) {
            lines.push(`得分：${formatEmailValue(item.score)} / ${formatEmailValue(item.maxScore)}`);
        }
        if (params.includeComments && item.comment) lines.push(`评语：${item.comment}`);
        if (params.includeCorrectAnswers && item.correctAnswer !== undefined) {
            lines.push(`正确答案：${formatEmailValue(item.correctAnswer)}`);
        }
        return lines;
    });

    return {
        subject: getResultSubject(params.template, params.formTitle),
        html: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #18181b;">
                <h2 style="margin-bottom: 16px;">${safeTitle}</h2>
                <p>${safeName}，你的表单已完成批改。</p>
                <div style="background: #f4f4f5; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
                    <strong>总分：${safeScoreText}</strong>
                </div>
                ${itemHtml ? `<ul style="padding-left: 20px;">${itemHtml}</ul>` : ""}
                <a href="${safeResultUrl}" style="display: inline-block; padding: 12px 20px; background: #171717; color: #fff; text-decoration: none; border-radius: 6px; margin: 8px 0 16px;">查看结果</a>
                <p style="color: #666; font-size: 14px;">如果你对结果有疑问，请联系管理员。</p>
            </div>
        `,
        text: [
            params.formTitle,
            `${params.recipientName?.trim() || "你好"}，你的表单已完成批改。`,
            `总分：${scoreText}`,
            ...itemText,
            `查看结果：${params.resultUrl}`,
            "如果你对结果有疑问，请联系管理员。",
        ].join("\n"),
    };
}

export function buildProcessingResultEmail(params: {
    template: Exclude<ResultNotificationTemplate, null>;
    formTitle: string;
    recipientName?: string | null;
    processingStatus: "approved" | "rejected";
    note?: string | null;
    resultUrl: string;
}): FormEmailContent {
    const statusLabel = params.processingStatus === "approved" ? "已通过" : "已拒绝";
    const safeTitle = escapeHtml(params.formTitle);
    const safeName = escapeHtml(params.recipientName?.trim() || "你好");
    const safeStatus = escapeHtml(statusLabel);
    const safeNote = params.note ? escapeHtml(params.note) : "";
    const safeResultUrl = escapeHtml(params.resultUrl);

    return {
        subject: getResultSubject(params.template, params.formTitle),
        html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #18181b;">
                <h2 style="margin-bottom: 16px;">${safeTitle}</h2>
                <p>${safeName}，你的表单处理结果已更新。</p>
                <p><strong>处理结果：${safeStatus}</strong></p>
                ${safeNote ? `<div style="background: #f4f4f5; padding: 12px 16px; border-radius: 6px; margin: 16px 0;"><p style="margin: 0 0 4px; color: #666; font-size: 14px;">管理员备注</p><p style="margin: 0;">${safeNote}</p></div>` : ""}
                <a href="${safeResultUrl}" style="display: inline-block; padding: 12px 20px; background: #171717; color: #fff; text-decoration: none; border-radius: 6px; margin: 8px 0 16px;">查看结果</a>
                <p style="color: #666; font-size: 14px;">如果你对结果有疑问，请联系管理员。</p>
            </div>
        `,
        text: [
            params.formTitle,
            `${params.recipientName?.trim() || "你好"}，你的表单处理结果已更新。`,
            `处理结果：${statusLabel}`,
            ...(params.note ? [`管理员备注：${params.note}`] : []),
            `查看结果：${params.resultUrl}`,
            "如果你对结果有疑问，请联系管理员。",
        ].join("\n"),
    };
}

export async function sendPasswordResetEmail(params: {
    to: string;
    resetUrl: string;
    userName?: string;
}) {
    const { to } = params;
    const content = buildPasswordResetEmail(params);

    await getResend().emails.send({
        from: FROM,
        to,
        ...content,
    });
}

export function buildPasswordResetEmail(params: {
    resetUrl: string;
    userName?: string;
}) {
    const greeting = params.userName ? `${escapeHtml(params.userName)}，你好！` : "你好！";
    const safeUrl = escapeHtml(params.resetUrl);
    return {
        subject: "重置您的密码 - RadicalSMP",
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>重置密码</h2>
                <p>${greeting}</p>
                <p>我们收到了重置您账户密码的请求。请点击下方按钮重置密码：</p>
                <a href="${safeUrl}" style="display: inline-block; padding: 12px 24px; background: #171717; color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                    重置密码
                </a>
                <p style="color: #666; font-size: 14px;">如果您没有请求重置密码，请忽略此邮件。</p>
                <p style="color: #666; font-size: 14px;">此链接将在 1 小时后过期。</p>
            </div>
        `,
    };
}

export async function sendVerificationEmail(params: {
    to: string;
    verifyUrl: string;
    userName?: string;
}) {
    const { to } = params;
    const content = buildVerificationEmail(params);

    await getResend().emails.send({
        from: FROM,
        to,
        ...content,
    });
}

export function buildVerificationEmail(params: {
    verifyUrl: string;
    userName?: string;
}) {
    const greeting = params.userName ? `${escapeHtml(params.userName)}，你好！` : "你好！";
    const safeUrl = escapeHtml(params.verifyUrl);
    return {
        subject: "验证您的邮箱 - RadicalSMP",
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>验证邮箱</h2>
                <p>${greeting}</p>
                <p>感谢您注册 RadicalSMP！请点击下方按钮验证您的邮箱地址：</p>
                <a href="${safeUrl}" style="display: inline-block; padding: 12px 24px; background: #171717; color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                    验证邮箱
                </a>
                <p style="color: #666; font-size: 14px;">如果您没有注册 RadicalSMP，请忽略此邮件。</p>
                <p style="color: #666; font-size: 14px;">此链接将在 1 小时后过期。</p>
            </div>
        `,
    };
}
