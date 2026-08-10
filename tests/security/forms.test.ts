import { describe, expect, test } from "bun:test";
import {
    validateFormVersionPayload,
    validateSubmissionValues,
    type FormField,
} from "@/lib/forms";

function field(overrides: Partial<FormField> = {}): FormField {
    return {
        key: "answer",
        label: "答案",
        type: "text",
        required: true,
        enabled: true,
        validation: {},
        ...overrides,
    };
}

function versionWith(testField: FormField) {
    return {
        title: "安全测试表单",
        description: null,
        fields: [testField],
        settings: {
            submitLabel: "提交",
            successMessage: "成功",
            introText: "",
        },
    };
}

describe("表单发布边界", () => {
    test("拒绝灾难性回溯正则", () => {
        const result = validateFormVersionPayload(versionWith(field({
            validation: { pattern: "(a+)+$" },
        })));

        expect(result.ok).toBeFalse();
        if (!result.ok) expect(result.error).toContain("性能风险");
    });

    test("拒绝超过字段硬上限的规则", () => {
        const result = validateFormVersionPayload(versionWith(field({
            type: "email",
            validation: { maxLength: 500 },
        })));

        expect(result.ok).toBeFalse();
    });
});

describe("表单提交边界", () => {
    test("执行数字最小值和最大值", () => {
        const numberField = field({ type: "number", validation: { min: 1, max: 10 } });
        const tooSmall = validateSubmissionValues([numberField], { answer: 0 });
        const valid = validateSubmissionValues([numberField], { answer: 5 });

        expect(tooSmall).toMatchObject({ ok: false, fieldKey: "answer", code: "number_too_small" });
        expect(valid).toMatchObject({ ok: true, value: { answer: 5 } });
    });

    test("执行长度、正则与稳定错误码", () => {
        const textField = field({ validation: { minLength: 3, maxLength: 5, pattern: "^[a-z]+$" } });

        expect(validateSubmissionValues([textField], { answer: "ab" }))
            .toMatchObject({ ok: false, fieldKey: "answer", code: "value_too_short" });
        expect(validateSubmissionValues([textField], { answer: "ABC" }))
            .toMatchObject({ ok: false, fieldKey: "answer", code: "pattern_mismatch" });
        expect(validateSubmissionValues([textField], { answer: "abcd" })).toMatchObject({ ok: true });
    });

    test("拒绝伪造类型和危险历史正则", () => {
        const textField = field();
        const unsafeField = field({ validation: { pattern: "(a+)+$" } });

        expect(validateSubmissionValues([textField], { answer: { value: "x" } }))
            .toMatchObject({ ok: false, code: "invalid_string" });
        expect(validateSubmissionValues([unsafeField], { answer: "aaaa" }))
            .toMatchObject({ ok: false, code: "unsafe_pattern" });
    });

    test("校验 email、QQ、MCID 和日期格式", () => {
        const cases: Array<[FormField, string, string]> = [
            [field({ type: "email" }), "not-an-email", "invalid_email"],
            [field({ type: "qq" }), "01234", "invalid_qq"],
            [field({ type: "mcid" }), "包含中文", "invalid_mcid"],
            [field({ type: "date" }), "2026-02-30", "invalid_date"],
        ];

        for (const [testField, value, code] of cases) {
            expect(validateSubmissionValues([testField], { answer: value }))
                .toMatchObject({ ok: false, code });
        }
    });

    test("执行多选题选择数量边界", () => {
        const checkboxField = field({
            type: "checkbox",
            options: [
                { label: "A", value: "a" },
                { label: "B", value: "b" },
                { label: "C", value: "c" },
            ],
            validation: { minLength: 2, maxLength: 2 },
        });

        expect(validateSubmissionValues([checkboxField], { answer: ["a"] }))
            .toMatchObject({ ok: false, code: "selection_too_small" });
        expect(validateSubmissionValues([checkboxField], { answer: ["a", "b", "c"] }))
            .toMatchObject({ ok: false, code: "selection_too_large" });
        expect(validateSubmissionValues([checkboxField], { answer: ["a", "b"] }))
            .toMatchObject({ ok: true });
    });
});
