import type { Metadata } from "next";
import { Suspense } from "react";
import { UserSubmissionDetailClient } from "@/components/forms/user-submission-detail-client";
import { Skeleton } from "@/components/ui/skeleton";

type SubmissionDetailPageProps = {
    params: Promise<{ submissionId: string }>;
};

export const metadata: Metadata = {
    title: "提交结果 - RadicalSMP",
    description: "查看表单回答、批改结果与处理进度",
};

async function SubmissionDetailContent({ params }: SubmissionDetailPageProps) {
    const { submissionId } = await params;
    return <UserSubmissionDetailClient submissionId={submissionId} />;
}

export default function SubmissionDetailPage({ params }: SubmissionDetailPageProps) {
    return (
        <Suspense fallback={<SubmissionPageFallback />}>
            <SubmissionDetailContent params={params} />
        </Suspense>
    );
}

function SubmissionPageFallback() {
    return (
        <div className="container mx-auto max-w-5xl space-y-6 px-4 py-10 sm:py-14" aria-label="正在加载提交结果">
            <Skeleton className="h-9 w-32" />
            <div className="space-y-3 border-b pb-7">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-9 w-72 max-w-full" />
                <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
        </div>
    );
}
