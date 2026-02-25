import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
    if (!_resend) {
        _resend = new Resend(process.env.RESEND_API_KEY);
    }
    return _resend;
}

{/* 现在绑上了 hami.su 的域名, 在将来某个日子买了 radicalsmp.org 的域名后, 将它绑上resend, 然后改掉这个发件邮箱w */}
const FROM = "BotamiDragen <botamidragen@hami.su>";

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

/**
 * 发送入服申请审核结果邮件
 */
export async function sendReviewResultEmail(params: {
    to: string;
    playerName?: string;
    approved: boolean;
    note?: string;
}) {
    const { to, playerName, approved, note } = params;
    const greeting = playerName ? `${playerName}，你好！` : "你好！";

    if (approved) {
        await getResend().emails.send({
            from: FROM,
            to,
            subject: "入服申请已通过 - RadicalSMP",
            html: `
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                    <h2 style="color: #16a34a;">🎉 恭喜，入服申请已通过！</h2>
                    <p>${greeting}</p>
                    <p>你的入服申请已经通过审核，欢迎加入 RadicalSMP！</p>
                    ${note ? `<div style="background: #f4f4f5; padding: 12px 16px; border-radius: 6px; margin: 16px 0;"><p style="margin: 0; color: #666; font-size: 14px;">管理员备注：</p><p style="margin: 4px 0 0 0;">${note}</p></div>` : ""}
                    <p>接下来请：</p>
                    <ol style="color: #444;">
                        <li>加入我们的 QQ 群，与其他成员交流</li>
                        <li>在群内联系管理员获取服务器地址</li>
                    </ol>
                    <p style="color: #666; font-size: 14px;">期待在游戏中见到你！</p>
                </div>
            `,
        });
    } else {
        await getResend().emails.send({
            from: FROM,
            to,
            subject: "入服申请结果通知 - RadicalSMP",
            html: `
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                    <h2>入服申请结果</h2>
                    <p>${greeting}</p>
                    <p>感谢你对 RadicalSMP 的关注！经过审核，我们很遗憾地通知你，本次入服申请未能通过。</p>
                    ${note ? `<div style="background: #f4f4f5; padding: 12px 16px; border-radius: 6px; margin: 16px 0;"><p style="margin: 0; color: #666; font-size: 14px;">原因说明：</p><p style="margin: 4px 0 0 0;">${note}</p></div>` : ""}
                    <p style="color: #666; font-size: 14px;">你可以在完善申请内容后重新提交。如有疑问，请联系管理员。</p>
                </div>
            `,
        });
    }
}


