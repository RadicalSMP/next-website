import { getResultList } from "@/lib/cache";
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

export default async function FormResultsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const filters: ResultFilters = {
        page: parsePage(params.page),
        query: readParam(params.query, ""),
        formId: readParam(params.formId, "all"),
        status: readParam(params.status, "all"),
        gradingStatus: readParam(params.gradingStatus, "all"),
        processingStatus: readParam(params.processingStatus, "all"),
        scoreFilter: readParam(params.scoreFilter, "all"),
        collectionLabel: readParam(params.collectionLabel, "all"),
        revisionStatus: readParam(params.revisionStatus, "all"),
        revisionCountFilter: readParam(params.revisionCountFilter, "all"),
    };

    const data = await getResultList(
        filters.page,
        PAGE_SIZE,
        filters.query,
        filters.formId,
        filters.status,
        filters.gradingStatus,
        filters.processingStatus,
        filters.scoreFilter,
        filters.collectionLabel,
        filters.revisionStatus,
        filters.revisionCountFilter,
    );

    return (
        <ResultListClient
            initialData={toClientPayload(data)}
            initialFilters={filters}
            title="结果中心"
            description="集中查看表单结果、批改进度、处理状态和导出数据"
        />
    );
}
