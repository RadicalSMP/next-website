import { FormBuilder } from "@/components/form-builder";

type FormEditPageProps = {
    params: Promise<{ id: string }>;
};

export default async function FormEditPage({ params }: FormEditPageProps) {
    const { id } = await params;
    return <FormBuilder mode="edit" formId={id} />;
}
