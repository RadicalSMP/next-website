import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getFormBySlug } from "@/lib/cache";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const form = await getFormBySlug(slug);

    if (!form) {
        return NextResponse.json({ error: "表单不存在、未发布或已归档" }, { status: 404 });
    }

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

    return NextResponse.json({
        form: {
            id: form.id,
            title: form.published_title,
            description: form.published_description,
            slug: form.slug,
            visibility: form.visibility,
            versionId: form.version_id,
            version: form.version,
            fields: form.fields,
            settings: form.settings,
        },
    });
}
