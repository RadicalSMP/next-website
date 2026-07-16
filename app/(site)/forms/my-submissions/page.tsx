import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UserSubmissionListClient } from "@/components/forms/user-submission-list-client";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
    title: "我的提交 - RadicalSMP",
    description: "查看我的表单提交与处理进度",
};

async function MySubmissionsContent() {
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);

    if (!session?.user) {
        redirect("/sign-in?callbackURL=%2Fforms%2Fmy-submissions");
    }

    return <UserSubmissionListClient />;
}

function MySubmissionsFallback() {
    return (
        <div className="container mx-auto max-w-4xl px-4 py-12" aria-label="正在加载我的提交">
            <div className="mb-8 space-y-3">
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <div className="divide-y rounded-md border">
                {[0, 1, 2].map((item) => (
                    <div key={item} className="space-y-4 px-4 py-5 sm:px-5">
                        <div className="flex items-center justify-between gap-4">
                            <Skeleton className="h-5 w-44 max-w-[65%]" />
                            <Skeleton className="h-5 w-16" />
                        </div>
                        <Skeleton className="h-4 w-56 max-w-[80%]" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function MySubmissionsPage() {
    return (
        <Suspense fallback={<MySubmissionsFallback />}>
            <MySubmissionsContent />
        </Suspense>
    );
}
