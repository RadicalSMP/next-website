import { headers } from "next/headers";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { getFormBySlug } from "@/lib/cache";
import { normalizeFormFields } from "@/lib/forms";
import { FormFillClient } from "@/components/forms/form-fill-client";

type FormFillPageProps = {
    params: Promise<{ slug: string }>;
};

async function FormFillPageContent({ params }: FormFillPageProps) {
    const { slug } = await params;
    const form = await getFormBySlug(slug);

    if (!form) {
        return <FormFillClient initialForm={null} initialError="表单不存在、未发布或已归档" />;
    }

    if (form.visibility === "authenticated" || form.visibility === "members") {
        const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);

        if (!session?.user) {
            return <FormFillClient initialForm={null} initialError="需要登录后才能查看此表单" />;
        }

        if (form.visibility === "members") {
            const allowedIds: string[] = form.allowed_user_ids || [];
            if (allowedIds.length > 0 && !allowedIds.includes(session.user.id)) {
                return <FormFillClient initialForm={null} initialError="您没有权限查看此表单" />;
            }
        }
    }

    return (
        <FormFillClient
            initialForm={{
                id: form.id,
                title: form.published_title,
                description: form.published_description,
                slug: form.slug,
                visibility: form.visibility,
                versionId: form.version_id,
                version: form.version,
                fields: normalizeFormFields(form.fields),
                settings: form.settings,
            }}
        />
    );
}

function FormFillPageFallback() {
    return (
        <div className="flex justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
    );
}

export default function FormFillPage({ params }: FormFillPageProps) {
    return (
        <Suspense fallback={<FormFillPageFallback />}>
            <FormFillPageContent params={params} />
        </Suspense>
    );
}
