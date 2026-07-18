import {
    CalendarDays,
    CheckSquare,
    ChevronDownSquare,
    Hash,
    Mail,
    MessageSquareText,
    MousePointerClick,
    Pilcrow,
    SlidersHorizontal,
    TextCursorInput,
    ToggleRight,
    UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormFieldType } from "@/lib/forms";

export const fieldTypeLabels: Record<FormFieldType, string> = {
    text: "单行文本",
    textarea: "多行文本",
    number: "数字",
    radio: "单选",
    checkbox: "多选",
    select: "下拉",
    toggle: "开关",
    date: "日期",
    email: "邮箱",
    qq: "QQ",
    mcid: "Minecraft ID",
};

export const fieldTypeDescriptions: Record<FormFieldType, string> = {
    text: "适合短回答、姓名、标题等内容",
    textarea: "适合长文本、说明和自我介绍",
    number: "适合年龄、数量、评分等数字输入",
    radio: "从多个选项中选择一个",
    checkbox: "从多个选项中选择多个",
    select: "收起的单选菜单",
    toggle: "适合是/否类确认",
    date: "选择日期",
    email: "带邮箱语义的文本字段",
    qq: "QQ 账号字段",
    mcid: "Minecraft ID 字段",
};

export const commonFieldTypes: FormFieldType[] = [
    "text",
    "textarea",
    "number",
    "radio",
    "checkbox",
    "select",
    "toggle",
    "date",
];

export const advancedFieldTypes: FormFieldType[] = ["email", "qq", "mcid"];

export const fieldTypeIcons: Record<FormFieldType, LucideIcon> = {
    text: TextCursorInput,
    textarea: Pilcrow,
    number: Hash,
    radio: MousePointerClick,
    checkbox: CheckSquare,
    select: ChevronDownSquare,
    toggle: ToggleRight,
    date: CalendarDays,
    email: Mail,
    qq: MessageSquareText,
    mcid: UserRound,
};

export function fieldHasOptions(type: FormFieldType) {
    return type === "radio" || type === "checkbox" || type === "select";
}

export function getDefaultValueForFieldType(type: FormFieldType) {
    if (type === "checkbox") return [];
    if (type === "toggle") return false;
    return "";
}

export function getDefaultOptionsForFieldType(type: FormFieldType) {
    if (!fieldHasOptions(type)) return [];
    return [
        { label: "选项 1", value: "选项 1" },
        { label: "选项 2", value: "选项 2" },
    ];
}

export const saveStateLabels = {
    idle: "尚未修改",
    local_saved: "已保存到本地",
    syncing: "正在同步",
    synced: "已同步",
    validation_blocked: "已保存到本地，补全后同步",
    error: "同步失败",
} as const;

export const panelLabels = {
    field: "字段",
    form: "表单",
    result: "结果",
    publish: "发布",
} as const;

export const settingsIcon = SlidersHorizontal;
