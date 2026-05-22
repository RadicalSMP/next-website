import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { FormFillClient } from "./form-fill-client";

type FormFillPageProps = {
    params: Promise<{ slug: string }>;
};

async function FormFillPageContent({ params }: FormFillPageProps) {
    const { slug } = await params;

    return <FormFillClient slug={slug} />;
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
