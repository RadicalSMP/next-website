import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// 发件人地址（Resend 未验证域名时用 onboarding@resend.dev）
const FROM = "RadicalSMP <onboarding@resend.dev>";

export async function sendPasswordResetEmail(params: {
    to: string;
    resetUrl: string;
    userName?: string;
}) {
    const { to, resetUrl, userName } = params;
    const greeting = userName ? `${userName}，你好！` : "你好！";

    await resend.emails.send({
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

    await resend.emails.send({
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
