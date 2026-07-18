import { Pool } from "pg";
import type { FormEmailContent } from "../lib/email";
import { exchangeSubmissionAccessToken } from "../lib/form-submission-access";
import {
    retrySubmissionNotification,
    sendGradingCompletedNotification,
    sendProcessingChangedNotification,
    sendRevisionRequestNotification,
} from "../lib/form-notifications";
import { createRevisionRequest } from "../lib/form-revisions";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

async function main() {
    if (!process.env.DATABASE_URL) throw new Error("缺少 DATABASE_URL 环境变量");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const fixtureResult = await pool.query<{
            form_id: string;
            submission_id: string;
            revision_id: string;
            actor_id: string;
            version_id: string;
        }>(
            `SELECT fs.form_id, fs.id AS submission_id, fs.current_revision_id AS revision_id,
                    fs.user_id AS actor_id, fs.form_version_id AS version_id
             FROM form_submissions fs
             INNER JOIN forms f ON f.id = fs.form_id
             WHERE f.slug = 'test-form-resubmission'
               AND fs.fingerprint = 'test-resubmission-account'`,
        );
        const fixture = fixtureResult.rows[0];
        assert(fixture?.actor_id && fixture.revision_id, "请先运行 bun run seed:test-form-resubmission");
        const anonymousResult = await pool.query<{
            submission_id: string;
            revision_id: string;
        }>(
            `SELECT fs.id AS submission_id, fs.current_revision_id AS revision_id
             FROM form_submissions fs
             INNER JOIN forms f ON f.id = fs.form_id
             WHERE f.slug = 'test-form-resubmission'
               AND fs.fingerprint = 'test-resubmission-anonymous'`,
        );
        const anonymous = anonymousResult.rows[0];
        assert(anonymous?.revision_id, "匿名补交夹具不存在");

        await pool.query(
            `UPDATE form_versions
             SET result_config = JSONB_SET(result_config, '{notifications,autoSend}', 'true'::JSONB)
             WHERE id = $1`,
            [fixture.version_id],
        );
        await pool.query(
            `UPDATE form_submissions SET grading_status = 'graded' WHERE id = $1`,
            [fixture.submission_id],
        );

        let successfulCalls = 0;
        const sentContents: FormEmailContent[] = [];
        const successTransport = async (input: { content: FormEmailContent }) => {
            successfulCalls += 1;
            sentContents.push(input.content);
            return { providerMessageId: `test-provider-${successfulCalls}` };
        };

        const firstGrading = await sendGradingCompletedNotification({
            submissionId: fixture.submission_id,
            formId: fixture.form_id,
            revisionId: fixture.revision_id,
            actorId: fixture.actor_id,
            transport: successTransport,
        });
        const duplicateGrading = await sendGradingCompletedNotification({
            submissionId: fixture.submission_id,
            formId: fixture.form_id,
            revisionId: fixture.revision_id,
            actorId: fixture.actor_id,
            transport: successTransport,
        });
        assert(firstGrading.status === "sent", "批改通知未发送成功");
        assert(duplicateGrading.status === "sent" && duplicateGrading.duplicate, "自动批改通知未命中幂等记录");
        assert(successfulCalls === 1, "重复自动批改通知调用了两次传输器");
        assert(sentContents[0] && !sentContents[0].html.includes("选项 B"), "默认成绩邮件泄露了正确答案");

        const revisionClient = await pool.connect();
        let revisionRequestId: string;
        try {
            await revisionClient.query("BEGIN");
            const request = await createRevisionRequest(revisionClient, {
                submissionId: anonymous.submission_id,
                formId: fixture.form_id,
                editScope: "selected",
                editableFieldKeys: ["subjective"],
                reason: "请补充匿名主观题",
                requestedBy: fixture.actor_id,
            });
            revisionRequestId = request.id;
            await revisionClient.query("COMMIT");
        } catch (error) {
            await revisionClient.query("ROLLBACK");
            throw error;
        } finally {
            revisionClient.release();
        }

        const failedRevision = await sendRevisionRequestNotification({
            submissionId: anonymous.submission_id,
            formId: fixture.form_id,
            revisionRequestId,
            actorId: fixture.actor_id,
            transport: async () => {
                throw new Error("匿名补交通知测试失败");
            },
        });
        assert(failedRevision.status === "failed" && failedRevision.notificationId, "匿名补交通知失败未落库");
        const failedTokenResult = await pool.query<{ revoked_at: Date | null }>(
            `SELECT revoked_at
             FROM submission_access_tokens
             WHERE submission_id = $1 AND revision_request_id = $2
             ORDER BY created_at DESC
             LIMIT 1`,
            [anonymous.submission_id, revisionRequestId],
        );
        assert(failedTokenResult.rows[0]?.revoked_at, "匿名通知失败后新访问令牌未撤销");

        const retriedRevision = await retrySubmissionNotification({
            submissionId: anonymous.submission_id,
            formId: fixture.form_id,
            notificationId: failedRevision.notificationId,
            actorId: fixture.actor_id,
            transport: successTransport,
        });
        assert(retriedRevision.status === "sent", "匿名补交通知重试未成功");
        const revisionEmail = sentContents.at(-1);
        const accessUrlMatch = revisionEmail?.text.match(/查看并补交：(\S+)/);
        assert(accessUrlMatch?.[1], "匿名补交邮件缺少安全访问链接");
        const rawAccessToken = new URL(accessUrlMatch[1]).searchParams.get("token");
        assert(rawAccessToken, "匿名补交邮件访问链接缺少令牌");

        const exchangeClient = await pool.connect();
        try {
            await exchangeClient.query("BEGIN");
            const exchanged = await exchangeSubmissionAccessToken(exchangeClient, rawAccessToken);
            assert(exchanged.submissionId === anonymous.submission_id, "匿名邮件令牌绑定了错误提交");
            assert(exchanged.cookieToken !== rawAccessToken, "匿名邮件令牌兑换后未轮换");
            await exchangeClient.query("ROLLBACK");
        } finally {
            exchangeClient.release();
        }

        await pool.query(
            `UPDATE form_submissions
             SET processing_status = 'approved', processing_note = '数据库状态应独立提交'
             WHERE id = $1`,
            [fixture.submission_id],
        );
        const eventResult = await pool.query<{ id: string }>(
            `INSERT INTO submission_events
                (submission_id, form_id, event_type, action, revision_id,
                 from_status, to_status, note, actor_id, metadata)
             VALUES ($1, $2, 'processing', 'approve', $3, 'pending', 'approved',
                     '数据库状态应独立提交', $4, $5)
             RETURNING id`,
            [fixture.submission_id, fixture.form_id, fixture.revision_id, fixture.actor_id, JSON.stringify({ fixture: true })],
        );
        const failedProcessing = await sendProcessingChangedNotification({
            submissionId: fixture.submission_id,
            formId: fixture.form_id,
            revisionId: fixture.revision_id,
            processingEventId: eventResult.rows[0].id,
            actorId: fixture.actor_id,
            transport: async () => {
                throw new Error("测试传输失败");
            },
        });
        assert(failedProcessing.status === "failed" && failedProcessing.notificationId, "处理通知失败未记录为 failed");
        const stateAfterFailure = await pool.query<{ processing_status: string }>(
            `SELECT processing_status FROM form_submissions WHERE id = $1`,
            [fixture.submission_id],
        );
        assert(stateAfterFailure.rows[0].processing_status === "approved", "邮件失败回滚了业务处理状态");

        const retried = await retrySubmissionNotification({
            submissionId: fixture.submission_id,
            formId: fixture.form_id,
            notificationId: failedProcessing.notificationId,
            actorId: fixture.actor_id,
            transport: successTransport,
        });
        assert(retried.status === "sent", "失败通知重试后未发送成功");
        const notificationResult = await pool.query<{
            status: string;
            attempts: number;
            provider_message_id: string | null;
        }>(
            `SELECT status, attempts, provider_message_id
             FROM submission_notifications
             WHERE id = $1`,
            [failedProcessing.notificationId],
        );
        const notification = notificationResult.rows[0];
        assert(notification.status === "sent", "重试后通知状态不是 sent");
        assert(notification.attempts === 2, "重试后 attempts 未递增到 2");
        assert(Boolean(notification.provider_message_id), "重试后未保存提供商消息 ID");

        const eventsResult = await pool.query<{ action: string }>(
            `SELECT action
             FROM submission_events
             WHERE notification_id = $1
             ORDER BY created_at`,
            [failedProcessing.notificationId],
        );
        assert(eventsResult.rows.some((event) => event.action === "failed"), "通知失败事件未写入");
        assert(eventsResult.rows.some((event) => event.action === "sent"), "通知重试成功事件未写入");
        console.log("表单通知领域服务验证通过");
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error("表单通知领域服务验证失败:", error);
    process.exit(1);
});
