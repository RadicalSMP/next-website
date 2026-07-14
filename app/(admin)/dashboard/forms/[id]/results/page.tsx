import { getAdminFormById, getResultList } from "@/lib/cache";
import {
    ResultListClient,
    type ResultFilters,
    type ResultListPayload,
} from "@/components/forms/results/result-list-client";

const PAGE_SIZE = 20;

function parsePage(value: string | string[] | undefined) {
    const raw = Array.isArray(value) ? value[0] : value;
    const parsed = Number(raw ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function readParam(value: string | string[] | undefined, fallback = "all") {
    if (Array.isArray(value)) return value[0] || fallback;
    return value || fallback;
}

function toClientPayload(data: unknown): ResultListPayload {
    return JSON.parse(JSON.stringify(data)) as ResultListPayload;
}

export default async function SingleFormResultsPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ id }, queryParams] = await Promise.all([params, searchParams]);
    const form = await getAdminFormById(id);
    const filters: ResultFilters = {
        page: parsePage(queryParams.page),
        query: readParam(queryParams.query, ""),
        formId: id,
        status: readParam(queryParams.status, "all"),
        gradingStatus: readParam(queryParams.gradingStatus, "all"),
        processingStatus: readParam(queryParams.processingStatus, "all"),
        scoreFilter: readParam(queryParams.scoreFilter, "all"),
        collectionLabel: readParam(queryParams.collectionLabel, "all"),
    };

    const data = await getResultList(
        filters.page,
        PAGE_SIZE,
        filters.query,
        id,
        filters.status,
        filters.gradingStatus,
        filters.processingStatus,
        filters.scoreFilter,
        filters.collectionLabel,
    );

    const title = typeof form?.title === "string" && form.title.trim()
        ? `${form.title} - 结果`
        : "表单结果";

    return (
        <ResultListClient
            initialData={toClientPayload(data)}
            initialFilters={filters}
            fixedFormId={id}
            title={title}
            description="查看该表单的收集结果、批改状态、处理状态和导出数据"
            backHref="/dashboard/forms"
            exportHref={`/api/forms/${id}/submissions/export`}
        />
    );
}
