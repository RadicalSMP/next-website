import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
    getAdminInvitationCodes,
    invalidateInvitationCodeCache,
} from "@/lib/cache";
import { pool } from "@/lib/db";

/** 校验管理员身份 */
async function requireAdmin() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    if (!session || session.user.role !== "admin") {
        return null;
    }
    return session;
}

/** GET — 获取所有邀请码（含使用记录） */
export async function GET() {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const codes = await getAdminInvitationCodes();

    return NextResponse.json({ codes });
}

/** POST — 创建新邀请码 */
export async function POST(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const body = await request.json();
    const {
        code,
        maxUses = 1,
        expiresAt = null,
        allowedEmails = null,
    } = body as {
        code?: string;
        maxUses?: number;
        expiresAt?: string | null;
        allowedEmails?: string[] | null;
    };

    // 随机生成或使用自定义码
    const finalCode = code?.trim() || generateCode();

    if (finalCode.length < 4 || finalCode.length > 32) {
        return NextResponse.json(
            { error: "邀请码长度应在 4-32 个字符之间" },
            { status: 400 },
        );
    }

    // 检查是否重复
    const existing = await pool.query(
        `SELECT 1 FROM "invitation_code" WHERE "code" = $1`,
        [finalCode],
    );
    if (existing.rows.length > 0) {
        return NextResponse.json(
            { error: "该邀请码已存在" },
            { status: 409 },
        );
    }

    const id = crypto.randomUUID();
    await pool.query(
        `INSERT INTO "invitation_code" ("id", "code", "maxUses", "allowedEmails", "expiresAt")
         VALUES ($1, $2, $3, $4, $5)`,
        [id, finalCode, maxUses, allowedEmails, expiresAt],
    );

    const result = await pool.query(
        `SELECT * FROM "invitation_code" WHERE "id" = $1`,
        [id],
    );

    invalidateInvitationCodeCache();

    return NextResponse.json({ code: result.rows[0] }, { status: 201 });
}

/** DELETE — 删除邀请码 */
export async function DELETE(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "缺少 id 参数" }, { status: 400 });
    }

    await pool.query(`DELETE FROM "invitation_code" WHERE "id" = $1`, [id]);
    invalidateInvitationCodeCache();

    return NextResponse.json({ success: true });
}

/** 生成随机邀请码 */
function generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}
