import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormFillClient } from "@/components/forms/form-fill-client";
import { getAdminFormById } from "@/lib/cache";
import {
    DEFAULT_FORM_SETTINGS,
    UNTITLED_FORM_TITLE,
    isRecord,
    normalizeFormFields,
} from "@/lib/forms";

type FormPreviewPageProps = {
    params: Promise<{ id: string }>;
};

export default async function FormPreviewPage({ params }: FormPreviewPageProps) {
    const { id } = await params;
    const form = await getAdminFormById(id);

    if (!form) {
        notFound();
    }

    const draftPayload = isRecord(form.draft_payload) ? form.draft_payload : {};
    const fields = normalizeFormFields(draftPayload.fields);
    const settings = isRecord(draftPayload.settings)
        ? { ...DEFAULT_FORM_SETTINGS, ...draftPayload.settings }
        : { ...DEFAULT_FORM_SETTINGS };

    return (
        <main className="min-h-screen bg-background">
            <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/dashboard/forms">
                            <ArrowLeft className="size-4" />
                            返回列表
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/forms/${id}/edit`}>
                            <Pencil className="size-4" />
                            编辑
                        </Link>
                    </Button>
                </div>
            </header>
            <FormFillClient
                mode="preview"
                previewLabel="预览模式"
                initialForm={{
                    id: form.id,
                    title: typeof form.title === "string" && form.title.trim() ? form.title : UNTITLED_FORM_TITLE,
                    description: typeof form.description === "string" ? form.description : null,
                    slug: typeof form.slug === "string" ? form.slug : "",
                    visibility: typeof form.visibility === "string" ? form.visibility : "public",
                    versionId: typeof form.current_version_id === "string" ? form.current_version_id : "draft",
                    version: typeof form.current_version === "number" ? form.current_version : 0,
                    fields,
                    settings,
                }}
            />
        </main>
    );
}
