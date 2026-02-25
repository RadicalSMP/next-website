import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { headers } from "next/headers";
import { sendReviewResultEmail } from "@/lib/email";
import { invalidateReviewCache } from "@/lib/review-cache";

// ─── 管理员鉴权 ──────────────────────────────────────────
async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

// ─── POST /api/forms/review/decide — 审核决定 ───────────
export async function POST(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const body = await request.json();
    const { submission_id, status, note } = body as {
        submission_id: string;
        status: "approved" | "rejected";
        note?: string;
    };

    if (!submission_id) {
        return NextResponse.json({ error: "缺少 submission_id" }, { status: 400 });
    }
    if (status !== "approved" && status !== "rejected") {
        return NextResponse.json(
            { error: "status 必须为 approved 或 rejected" },
            { status: 400 },
        );
    }

    // 检查提交是否存在
    const subResult = await pool.query(
        `SELECT fs.user_email, u.name AS user_name
         FROM form_submissions fs
         LEFT JOIN "user" u ON fs.user_id = u.id
         WHERE fs.id = $1`,
        [submission_id],
    );
    if (subResult.rows.length === 0) {
        return NextResponse.json({ error: "提交不存在" }, { status: 404 });
    }

    const { user_email, user_name } = subResult.rows[0];

    // 写入审核记录（upsert）
    await pool.query(
        `INSERT INTO submission_reviews (submission_id, reviewer_id, status, note)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (submission_id) DO UPDATE SET
            reviewer_id = $2,
            status = $3,
            note = $4,
            created_at = NOW()`,
        [submission_id, session.user.id, status, note || null],
    );

    invalidateReviewCache();

    // 发送邮件通知
    if (user_email) {
        try {
            await sendReviewResultEmail({
                to: user_email,
                playerName: user_name || undefined,
                approved: status === "approved",
                note: note || undefined,
            });
        } catch (err) {
            console.error("发送审核结果邮件失败:", err);
            // 不阻断审核流程
        }
    }

    return NextResponse.json({ success: true });
}
