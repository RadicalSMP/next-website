import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { csvEscape, normalizeFormFields } from "@/lib/forms";
import { headers } from "next/headers";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
        return null;
    }
    return session;
}

function formatValue(value: unknown) {
    if (Array.isArray(value)) {
        return value.join("；");
    }
    if (typeof value === "boolean") {
        return value ? "是" : "否";
    }
    return value ?? "";
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    const { id } = await params;
    const formResult = await pool.query(
        `SELECT f.title, f.slug, fv.fields
         FROM forms f
         LEFT JOIN form_versions fv ON fv.id = f.current_version_id
         WHERE f.id = $1`,
        [id],
    );
    if (formResult.rows.length === 0) {
        return NextResponse.json({ error: "表单不存在" }, { status: 404 });
    }

    const fields = normalizeFormFields(formResult.rows[0].fields);
    const submissions = await pool.query(
        `SELECT fs.*, u.name AS user_name
         FROM form_submissions fs
         LEFT JOIN "user" u ON fs.user_id = u.id
         WHERE fs.form_id = $1
         ORDER BY fs.created_at DESC`,
        [id],
    );

    const headersRow = [
        "提交 ID",
        "提交者",
        "邮箱",
        "收集状态",
        "批改状态",
        "分数",
        "满分",
        "处理状态",
        "处理备注",
        "处理时间",
        "提交时间",
        "填写用时",
        ...fields.map((field) => field.label),
    ];

    const rows = submissions.rows.map((submission) => {
        const data = submission.data || {};
        return [
            submission.id,
            submission.user_name || "匿名用户",
            submission.user_email || "",
            submission.status,
            submission.grading_status || "not_required",
            submission.total_score ?? "",
            submission.max_score ?? "",
            submission.processing_status || "not_required",
            submission.processing_note || "",
            submission.processed_at ? new Date(submission.processed_at).toLocaleString("zh-CN") : "",
            new Date(submission.created_at).toLocaleString("zh-CN"),
            submission.duration ?? "",
            ...fields.map((field) => formatValue(data[field.key])),
        ];
    });

    const csv = [headersRow, ...rows]
        .map((row) => row.map(csvEscape).join(","))
        .join("\n");

    const filename = `${formResult.rows[0].slug}-submissions.csv`;

    return new NextResponse(`\uFEFF${csv}`, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    });
}
