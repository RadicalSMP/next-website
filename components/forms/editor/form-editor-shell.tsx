"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { FormBuilderProps, PublishIssue } from "./types";
import { useFormEditorState } from "./use-form-editor-state";
import { FormEditorToolbar } from "./form-editor-toolbar";
import { FormFieldOutline } from "./form-field-outline";
import { FormCanvas } from "./form-canvas";
import { FormPropertiesPanel } from "./form-properties-panel";
import { formatDateTime } from "./utils";

export function FormEditorShell(props: FormBuilderProps) {
    const { state, actions } = useFormEditorState(props);
    const [outlineOpen, setOutlineOpen] = useState(false);
    const [propertiesOpen, setPropertiesOpen] = useState(false);

    const handleSelectIssue = (issue: PublishIssue) => {
        if (issue.fieldIndex !== undefined) {
            actions.setSelectedIndex(issue.fieldIndex);
            actions.setPanel("field");
        }
        setPropertiesOpen(false);
    };

    if (state.loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-muted/40">
                <div className="flex items-center gap-3 rounded-md border bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
                    <Loader2 className="size-4 animate-spin" />
                    正在加载表单编辑器...
                </div>
            </div>
        );
    }

    const propertiesPanel = (
        <FormPropertiesPanel
            panel={state.panel}
            onPanelChange={actions.setPanel}
            selectedField={state.selectedField}
            selectedIndex={state.selectedIndex}
            fieldsLength={state.fields.length}
            slug={state.slug}
            visibility={state.visibility}
            settings={state.settings}
            allowedUserIds={state.allowedUserIds}
            allowedUsers={state.allowedUsers}
            memberSearchQuery={state.memberSearchQuery}
            memberSearchResults={state.memberSearchResults}
            memberSearching={state.memberSearching}
            publishIssues={state.publishIssues}
            versions={state.versions}
            currentVersion={state.currentVersion}
            publishedAt={state.publishedAt}
            onSlugChange={actions.setSlug}
            onVisibilityChange={actions.setVisibility}
            onSettingsChange={actions.setSettings}
            onFieldUpdate={actions.updateField}
            onMemberQueryChange={actions.setMemberSearchQuery}
            onAddMember={actions.addMember}
            onRemoveMember={actions.removeMember}
            onSelectIssue={handleSelectIssue}
        />
    );

    const outlinePanel = (
        <FormFieldOutline
            fields={state.fields}
            selectedIndex={state.selectedIndex}
            onSelect={(index) => {
                actions.setSelectedIndex(index);
                actions.setPanel("field");
                setOutlineOpen(false);
            }}
            onAdd={(type) => {
                actions.addField(type);
                setOutlineOpen(false);
            }}
            onDuplicate={actions.duplicateField}
            onRemove={actions.removeField}
            onMove={actions.moveField}
        />
    );

    return (
        <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background">
            <FormEditorToolbar
                mode={state.activeMode}
                title={state.title}
                slug={state.slug}
                status={state.status}
                currentVersion={state.currentVersion}
                saveState={state.saveState}
                saveMessage={state.saveMessage}
                lastSyncedAt={state.lastSyncedAt}
                saving={state.manualSaving}
                publishing={state.publishing}
                canPreview={state.status === "published"}
                onSave={() => void actions.saveForm()}
                onPublish={() => void actions.publishForm()}
                onToggleOutline={() => setOutlineOpen(true)}
                onToggleProperties={() => setPropertiesOpen(true)}
            />

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_360px]">
                <div className="hidden min-h-0 lg:block">
                    {outlinePanel}
                </div>

                <FormCanvas
                    title={state.title}
                    description={state.description}
                    fields={state.fields}
                    selectedIndex={state.selectedIndex}
                    onTitleChange={actions.setTitle}
                    onDescriptionChange={actions.setDescription}
                    onSelectField={(index) => {
                        actions.setSelectedIndex(index);
                        actions.setPanel("field");
                    }}
                    onUpdateField={actions.updateField}
                    onDuplicateField={actions.duplicateField}
                    onRemoveField={actions.removeField}
                    onAddField={actions.addField}
                    onAddOption={actions.addOption}
                    onUpdateOption={actions.updateOption}
                    onRemoveOption={actions.removeOption}
                />

                <div className="hidden min-h-0 xl:block">
                    {propertiesPanel}
                </div>
            </div>

            <Sheet open={outlineOpen} onOpenChange={setOutlineOpen}>
                <SheetContent side="left" className="w-[320px] p-0 sm:max-w-[320px]">
                    <SheetHeader className="sr-only">
                        <SheetTitle>题目大纲</SheetTitle>
                        <SheetDescription>选择、添加和排序表单题目。</SheetDescription>
                    </SheetHeader>
                    {outlinePanel}
                </SheetContent>
            </Sheet>

            <Sheet open={propertiesOpen} onOpenChange={setPropertiesOpen}>
                <SheetContent side="right" className="w-[360px] p-0 sm:max-w-[360px]">
                    <SheetHeader className="sr-only">
                        <SheetTitle>属性面板</SheetTitle>
                        <SheetDescription>编辑字段属性、表单设置和发布检查。</SheetDescription>
                    </SheetHeader>
                    {propertiesPanel}
                </SheetContent>
            </Sheet>

            <AlertDialog open={Boolean(state.pendingLocalDraft)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>发现本地草稿</AlertDialogTitle>
                        <AlertDialogDescription>
                            本机有一份未同步或较新的草稿，保存时间为 {formatDateTime(state.pendingLocalDraft?.updatedAt)}。
                            你可以恢复它，或继续使用服务器版本。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={actions.discardLocalDraft}>
                            使用服务器版本
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={actions.restoreLocalDraft}>
                            恢复本地草稿
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
