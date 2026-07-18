import type { Metadata } from "next";
import { Suspense } from "react";
import { UserSubmissionDetailClient } from "@/components/forms/user-submission-detail-client";
import { Skeleton } from "@/components/ui/skeleton";

type SubmissionRevisionPageProps = {
    params: Promise<{ submissionId: string }>;
};

export const metadata: Metadata = {
    title: "补交回答 - RadicalSMP",
    description: "按管理员开放的字段范围补充表单回答",
};

async function SubmissionRevisionContent({ params }: SubmissionRevisionPageProps) {
    const { submissionId } = await params;
    return <UserSubmissionDetailClient submissionId={submissionId} mode="revise" />;
}

export default function SubmissionRevisionPage({ params }: SubmissionRevisionPageProps) {
    return (
        <Suspense fallback={<SubmissionRevisionFallback />}>
            <SubmissionRevisionContent params={params} />
        </Suspense>
    );
}

function SubmissionRevisionFallback() {
    return (
        <div className="container mx-auto max-w-3xl space-y-6 px-4 py-10 sm:py-14" aria-label="正在加载补交页面">
            <Skeleton className="h-9 w-32" />
            <div className="space-y-3 border-b pb-7">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-72 max-w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-72 w-full" />
        </div>
    );
}
