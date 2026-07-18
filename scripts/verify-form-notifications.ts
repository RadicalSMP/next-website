import {
    buildGradingCompletedEmail,
    buildProcessingResultEmail,
    buildRevisionRequestedEmail,
} from "../lib/email";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function verifyRevisionTemplate() {
    const content = buildRevisionRequestedEmail({
        formTitle: "测试 <表单>",
        reason: "请补充 <script>alert('x')</script>",
        editableFieldLabels: ["邮箱 & 昵称"],
        expiresAt: new Date("2026-07-20T12:00:00.000Z"),
        accessUrl: "https://example.com/result?token=a&next=b",
    });
    assert(!content.html.includes("<script>"), "补交邮件未转义 HTML 标签");
    assert(content.html.includes("&lt;script&gt;"), "补交邮件缺少已转义的用户内容");
    assert(content.html.includes("a&amp;next=b"), "补交邮件未转义链接属性");
    assert(content.text.includes("请补充 <script>"), "补交邮件纯文本缺少原始内容");
}

function verifyGradingTemplate() {
    const hiddenAnswer = buildGradingCompletedEmail({
        template: "score_result",
        formTitle: "安全测试",
        recipientName: "测试用户",
        totalScore: 8,
        maxScore: 10,
        items: [{
            label: "题目 <一>",
            score: 8,
            maxScore: 10,
            comment: "评语 & 建议",
            correctAnswer: "绝密答案",
        }],
        includeQuestionScores: true,
        includeComments: true,
        includeCorrectAnswers: false,
        resultUrl: "https://example.com/result",
    });
    assert(hiddenAnswer.html.includes("题目 &lt;一&gt;"), "成绩邮件未转义题目标题");
    assert(hiddenAnswer.html.includes("评语 &amp; 建议"), "成绩邮件未转义评语");
    assert(!hiddenAnswer.html.includes("绝密答案"), "关闭正确答案后 HTML 仍发生泄露");
    assert(!hiddenAnswer.text.includes("绝密答案"), "关闭正确答案后纯文本仍发生泄露");

    const visibleAnswer = buildGradingCompletedEmail({
        template: "generic_result",
        formTitle: "答案测试",
        totalScore: 1,
        maxScore: 1,
        items: [{ label: "客观题", score: 1, maxScore: 1, correctAnswer: "A&B" }],
        includeQuestionScores: false,
        includeComments: false,
        includeCorrectAnswers: true,
        resultUrl: "https://example.com/result",
    });
    assert(visibleAnswer.html.includes("A&amp;B"), "显式启用正确答案后未安全渲染");
    assert(visibleAnswer.text.includes("正确答案：A&B"), "成绩邮件纯文本缺少正确答案");
}

function verifyProcessingTemplate() {
    const content = buildProcessingResultEmail({
        template: "join_application_result",
        formTitle: "入服申请",
        recipientName: "玩家 <甲>",
        processingStatus: "approved",
        note: "欢迎加入 & 请阅读规则",
        resultUrl: "https://example.com/result",
    });
    assert(content.subject.includes("入服申请结果通知"), "入服申请模板主题错误");
    assert(content.html.includes("玩家 &lt;甲&gt;"), "处理邮件未转义收件人名称");
    assert(content.html.includes("欢迎加入 &amp; 请阅读规则"), "处理邮件未转义管理员备注");
    assert(content.text.includes("处理结果：已通过"), "处理邮件纯文本缺少处理结论");
}

verifyRevisionTemplate();
verifyGradingTemplate();
verifyProcessingTemplate();
console.log("表单通知模板验证通过");
