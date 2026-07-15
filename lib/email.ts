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

function escapeHtml(value: string) {
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
}) {
    const result = await getResend().emails.send({
        from: FROM,
        to: params.to,
        subject: params.content.subject,
        html: params.content.html,
        text: params.content.text,
    });
    if (result.error) {
        throw new Error(result.error.message || "邮件提供商返回失败");
    }
    if (!result.data?.id) {
        throw new Error("邮件提供商未返回消息 ID");
    }
    return { providerMessageId: result.data.id };
}

export async function sendPasswordResetEmail(params: {
    to: string;
    resetUrl: string;
    userName?: string;
}) {
    const { to, resetUrl, userName } = params;
    const greeting = userName ? `${userName}，你好！` : "你好！";

    await getResend().emails.send({
        from: FROM,
        to,
        subject: "重置您的密码 - RadicalSMP",
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>重置密码</h2>
                <p>${greeting}</p>
                <p>我们收到了重置您账户密码的请求。请点击下方按钮重置密码：</p>
                <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #171717; color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                    重置密码
                </a>
                <p style="color: #666; font-size: 14px;">如果您没有请求重置密码，请忽略此邮件。</p>
                <p style="color: #666; font-size: 14px;">此链接将在 1 小时后过期。</p>
            </div>
        `,
    });
}

export async function sendVerificationEmail(params: {
    to: string;
    verifyUrl: string;
    userName?: string;
}) {
    const { to, verifyUrl, userName } = params;
    const greeting = userName ? `${userName}，你好！` : "你好！";

    await getResend().emails.send({
        from: FROM,
        to,
        subject: "验证您的邮箱 - RadicalSMP",
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>验证邮箱</h2>
                <p>${greeting}</p>
                <p>感谢您注册 RadicalSMP！请点击下方按钮验证您的邮箱地址：</p>
                <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #171717; color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                    验证邮箱
                </a>
                <p style="color: #666; font-size: 14px;">如果您没有注册 RadicalSMP，请忽略此邮件。</p>
                <p style="color: #666; font-size: 14px;">此链接将在 1 小时后过期。</p>
            </div>
        `,
    });
}

export async function sendFormResultNotificationEmail(params: {
    to: string;
    template: Exclude<ResultNotificationTemplate, null>;
    formTitle: string;
    recipientName?: string | null;
    processingStatus?: string | null;
    totalScore?: string | number | null;
    maxScore?: string | number | null;
    note?: string | null;
}) {
    const {
        to,
        template,
        formTitle,
        recipientName,
        processingStatus,
        totalScore,
        maxScore,
        note,
    } = params;

    const safeName = recipientName ? escapeHtml(recipientName) : "你好";
    const safeFormTitle = escapeHtml(formTitle);
    const safeNote = note ? escapeHtml(note) : "";
    const scoreText = totalScore !== null && totalScore !== undefined && maxScore !== null && maxScore !== undefined
        ? `${escapeHtml(String(totalScore))} / ${escapeHtml(String(maxScore))}`
        : null;

    const statusLabel: Record<string, string> = {
        pending: "待处理",
        approved: "已通过",
        rejected: "已拒绝",
        needs_changes: "需补充",
        not_required: "无需处理",
    };
    const safeStatus = processingStatus
        ? escapeHtml(statusLabel[processingStatus] ?? processingStatus)
        : null;

    const subject = template === "join_application_result"
        ? `入服申请结果通知 - RadicalSMP`
        : template === "score_result"
            ? `表单成绩通知 - ${safeFormTitle}`
            : `表单结果通知 - ${safeFormTitle}`;

    await getResend().emails.send({
        from: FROM,
        to,
        subject,
        html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #18181b;">
                <h2 style="margin-bottom: 16px;">${safeFormTitle}</h2>
                <p>${safeName}，你好！</p>
                <p>你的表单结果已更新。</p>
                ${safeStatus ? `<p><strong>处理状态：</strong>${safeStatus}</p>` : ""}
                ${scoreText ? `<p><strong>成绩：</strong>${scoreText}</p>` : ""}
                ${safeNote ? `<div style="background: #f4f4f5; padding: 12px 16px; border-radius: 6px; margin: 16px 0;"><p style="margin: 0; color: #666; font-size: 14px;">备注</p><p style="margin: 4px 0 0 0;">${safeNote}</p></div>` : ""}
                <p style="color: #666; font-size: 14px;">如果你对结果有疑问，请联系管理员。</p>
            </div>
        `,
    });
}
