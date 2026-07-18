import { getAdminForms } from "@/lib/cache";
import { FormsManageClient } from "./forms-manage-client";
import type { FormItem } from "./forms-manage-client";

function toFormItem(row: Record<string, unknown>): FormItem {
    return {
        id: String(row.id),
        title: typeof row.title === "string" && row.title.trim() ? row.title : "未命名表单",
        description: typeof row.description === "string" ? row.description : null,
        slug: typeof row.slug === "string" ? row.slug : "",
        visibility: typeof row.visibility === "string" ? row.visibility : "public",
        status: row.status === "published" || row.status === "archived" ? row.status : "draft",
        created_by_name: typeof row.created_by_name === "string" ? row.created_by_name : null,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ""),
        updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ""),
        submission_count: typeof row.submission_count === "number" ? row.submission_count : Number(row.submission_count ?? 0),
        current_version: row.current_version === null || row.current_version === undefined ? null : Number(row.current_version),
        last_submitted_at: row.last_submitted_at instanceof Date ? row.last_submitted_at.toISOString() : row.last_submitted_at ? String(row.last_submitted_at) : null,
    };
}

export default async function FormsManagePage() {
    const forms = await getAdminForms();

    return <FormsManageClient initialForms={forms.map(toFormItem)} />;
}
