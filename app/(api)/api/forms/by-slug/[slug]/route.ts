import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getFormBySlug } from "@/lib/cache";

// ─── GET /api/forms/by-slug/[slug] — 按 slug 获取表单 ─────
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;

    const form = await getFormBySlug(slug);

    if (!form) {
        return NextResponse.json({ error: "表单不存在或已关闭" }, { status: 404 });
    }

    // 权限校验
    if (form.visibility === "authenticated" || form.visibility === "members") {
        const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);

        if (!session?.user) {
            return NextResponse.json({ error: "需要登录后才能查看此表单" }, { status: 401 });
        }

        if (form.visibility === "members") {
            const allowedIds: string[] = form.allowed_user_ids || [];
            if (allowedIds.length > 0 && !allowedIds.includes(session.user.id)) {
                return NextResponse.json({ error: "您没有权限查看此表单" }, { status: 403 });
            }
        }
    }

    // 返回前端渲染所需数据（不返回 allowed_user_ids 等敏感信息）
    return NextResponse.json({
        form: {
            id: form.id,
            title: form.title,
            description: form.description,
            slug: form.slug,
            fields: form.fields,
            visibility: form.visibility,
        },
    });
}
