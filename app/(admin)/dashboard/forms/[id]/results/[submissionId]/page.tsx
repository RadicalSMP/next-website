import { notFound } from "next/navigation";
import { getResultDetail } from "@/lib/cache";
import {
    ResultDetailClient,
    type ResultDetailPayload,
} from "@/components/forms/results/result-detail-client";

function toClientPayload(data: unknown): ResultDetailPayload {
    return JSON.parse(JSON.stringify(data)) as ResultDetailPayload;
}

export default async function ResultDetailPage({
    params,
}: {
    params: Promise<{ id: string; submissionId: string }>;
}) {
    const { id, submissionId } = await params;
    const detail = await getResultDetail(id, submissionId);

    if (!detail) {
        notFound();
    }

    return <ResultDetailClient initialDetail={toClientPayload(detail)} />;
}
