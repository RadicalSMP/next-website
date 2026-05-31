"use client";

import { FormEditorShell } from "@/components/forms/editor/form-editor-shell";
import { FormBuilderProps } from "@/components/forms/editor/types";

export function FormBuilder(props: FormBuilderProps) {
    return <FormEditorShell {...props} />;
}
