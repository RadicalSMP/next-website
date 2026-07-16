import { Pool } from "pg";
import {
    authorizeSubmissionAccess,
    createSubmissionAccessToken,
    exchangeSubmissionAccessToken,
    SubmissionAccessTokenError,
} from "../lib/form-submission-access";
import {
    cancelRevisionRequest,
    compareRevisions,
    createRevisionRequest,
    FormRevisionError,
    getRevisionHistory,
    submitRevision,
} from "../lib/form-revisions";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

async function verifyRevisionTransactions(pool: Pool) {
    const fixtureResult = await pool.query<{
        form_id: string;
        submission_id: string;
        user_id: string;
    }>(
        `SELECT fs.form_id, fs.id AS submission_id, fs.user_id
         FROM form_submissions fs
         INNER JOIN forms f ON f.id = fs.form_id
         WHERE f.slug = 'test-form-resubmission'
           AND fs.fingerprint = 'test-resubmission-account'`,
    );
    const anonymousResult = await pool.query<{
        form_id: string;
        submission_id: string;
    }>(
        `SELECT fs.form_id, fs.id AS submission_id
         FROM form_submissions fs
         INNER JOIN forms f ON f.id = fs.form_id
         WHERE f.slug = 'test-form-resubmission'
           AND fs.fingerprint = 'test-resubmission-anonymous'`,
    );
    const account = fixtureResult.rows[0];
    const anonymous = anonymousResult.rows[0];
    assert(account?.user_id && anonymous, "请先运行 bun run seed:test-form-resubmission");

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const request = await createRevisionRequest(client, {
            submissionId: account.submission_id,
            formId: account.form_id,
            editScope: "selected",
            editableFieldKeys: ["objective"],
            reason: "请修正客观题",
            requestedBy: account.user_id,
        });

        let forbidden = false;
        try {
            await submitRevision(client, {
                submissionId: account.submission_id,
                requestId: request.id,
                formId: account.form_id,
                data: { subjective: "尝试越权修改主观题" },
                submittedBy: account.user_id,
                submittedVia: "account",
            });
        } catch (error) {
            forbidden = error instanceof FormRevisionError && error.status === 403;
        }
        assert(forbidden, "指定字段模式未阻止越权修改");

        const submitted = await submitRevision(client, {
            submissionId: account.submission_id,
            requestId: request.id,
            formId: account.form_id,
            data: { objective: "a" },
            submittedBy: account.user_id,
            submittedVia: "account",
            fingerprint: "test-domain-revision",
        });
        assert(submitted.revision.revisionNumber === 2, "补交未生成 revision 2");
        assert(submitted.gradingStatus === "manual_required", "主观题未恢复待批改状态");
        assert(Number(submitted.totalScore) === 0, "客观题未按新答案重新评分");
        assert(submitted.processingStatus === "pending", "补交后处理状态未恢复 pending");

        let conflict = false;
        try {
            await submitRevision(client, {
                submissionId: account.submission_id,
                requestId: request.id,
                data: { objective: "b" },
                submittedBy: account.user_id,
                submittedVia: "account",
            });
        } catch (error) {
            conflict = error instanceof FormRevisionError && error.status === 409;
        }
        assert(conflict, "同一补交请求被重复消费");

        const history = await getRevisionHistory(client, account.submission_id);
        assert(history.length === 2, "修订历史数量不正确");
        const diff = compareRevisions(history[1], history[0]);
        assert(diff.some((item) => item.fieldKey === "objective" && item.changed), "修订差异未识别客观题变化");
        const gradeResult = await client.query<{
            revision_number: number;
            objective_score: string | number | null;
            subjective_score: string | number | null;
        }>(
            `SELECT r.revision_number,
                    MAX(g.score) FILTER (WHERE g.field_key = 'objective') AS objective_score,
                    MAX(g.score) FILTER (WHERE g.field_key = 'subjective') AS subjective_score
             FROM form_submission_revisions r
             LEFT JOIN submission_grades g ON g.revision_id = r.id
             WHERE r.submission_id = $1
             GROUP BY r.revision_number
             ORDER BY r.revision_number`,
            [account.submission_id],
        );
        assert(gradeResult.rows.length === 2, "旧修订评分未保留");
        assert(Number(gradeResult.rows[0].objective_score) === 5, "旧修订客观题评分被污染");
        assert(Number(gradeResult.rows[1].objective_score) === 0, "新修订客观题评分错误");
        assert(gradeResult.rows[1].subjective_score === null, "新修订主观题分数未清空");

        const allFieldsRequest = await createRevisionRequest(client, {
            submissionId: anonymous.submission_id,
            formId: anonymous.form_id,
            editScope: "all",
            reason: "测试全部字段补交",
            requestedBy: account.user_id,
        });
        const allFieldsToken = await createSubmissionAccessToken(client, {
            submissionId: anonymous.submission_id,
            revisionRequestId: allFieldsRequest.id,
            scopes: ["view", "revise"],
            expiresAt: new Date(Date.now() + 60_000),
        });
        const allFieldsRevision = await submitRevision(client, {
            submissionId: anonymous.submission_id,
            requestId: allFieldsRequest.id,
            formId: anonymous.form_id,
            data: { subjective: "匿名用户已补充主观题内容" },
            submittedBy: null,
            submittedVia: "token",
        });
        assert(
            allFieldsRevision.changedFieldKeys.includes("subjective"),
            "全部字段模式未允许修改启用字段",
        );
        const consumedTokenResult = await client.query<{
            scopes: string[];
            consumed_at: Date | null;
            revoked_at: Date | null;
        }>(
            `SELECT scopes, consumed_at, revoked_at
             FROM submission_access_tokens
             WHERE id = $1`,
            [allFieldsToken.id],
        );
        const consumedToken = consumedTokenResult.rows[0];
        assert(
            consumedToken.scopes.length === 1 &&
            consumedToken.scopes[0] === "view" &&
            consumedToken.consumed_at &&
            !consumedToken.revoked_at,
            "补交成功后未保留 view scope 或未消费 revise scope",
        );

        const cancellable = await createRevisionRequest(client, {
            submissionId: anonymous.submission_id,
            formId: anonymous.form_id,
            editScope: "selected",
            editableFieldKeys: ["subjective"],
            reason: "测试取消请求",
            requestedBy: account.user_id,
        });
        const cancelled = await cancelRevisionRequest(client, {
            submissionId: anonymous.submission_id,
            requestId: cancellable.id,
            formId: anonymous.form_id,
            cancelledBy: account.user_id,
        });
        assert(cancelled.status === "cancelled", "补交请求取消失败");

        const tokenRequest = await createRevisionRequest(client, {
            submissionId: anonymous.submission_id,
            formId: anonymous.form_id,
            editScope: "selected",
            editableFieldKeys: ["objective"],
            reason: "测试匿名令牌",
            requestedBy: account.user_id,
        });
        const accessToken = await createSubmissionAccessToken(client, {
            submissionId: anonymous.submission_id,
            revisionRequestId: tokenRequest.id,
            scopes: ["view", "revise"],
            expiresAt: new Date(Date.now() + 60_000),
        });
        const exchanged = await exchangeSubmissionAccessToken(client, accessToken.token);
        assert(exchanged.submissionId === anonymous.submission_id, "匿名令牌绑定了错误提交");
        assert(exchanged.cookieToken !== accessToken.token, "匿名 URL 令牌兑换后未轮换");

        let replayBlocked = false;
        try {
            await exchangeSubmissionAccessToken(client, accessToken.token);
        } catch (error) {
            replayBlocked = error instanceof SubmissionAccessTokenError && error.code === "token_invalid";
        }
        assert(replayBlocked, "匿名 URL 令牌可被重复兑换");

        await cancelRevisionRequest(client, {
            submissionId: anonymous.submission_id,
            requestId: tokenRequest.id,
            formId: anonymous.form_id,
            cancelledBy: account.user_id,
        });
        const cancelledTokenResult = await client.query<{ scopes: string[]; revoked_at: Date | null }>(
            `SELECT scopes, revoked_at FROM submission_access_tokens WHERE id = $1`,
            [exchanged.tokenId],
        );
        const cancelledToken = cancelledTokenResult.rows[0];
        assert(
            cancelledToken.scopes.length === 1 &&
            cancelledToken.scopes[0] === "view" &&
            !cancelledToken.revoked_at,
            "取消补交请求时错误撤销了 view scope",
        );
    } finally {
        await client.query("ROLLBACK").catch(() => undefined);
        client.release();
    }

    return { account, anonymous };
}

async function verifyAccessDecisions(
    pool: Pool,
    fixtures: {
        account: { submission_id: string; user_id: string };
        anonymous: { submission_id: string };
    },
) {
    const owner = await authorizeSubmissionAccess({
        submissionId: fixtures.account.submission_id,
        actor: { userId: fixtures.account.user_id, role: "admin" },
    });
    assert(owner.canView && owner.source === "account", "账号所有者无法查看自己的提交");

    const admin = await authorizeSubmissionAccess({
        submissionId: fixtures.anonymous.submission_id,
        actor: { userId: fixtures.account.user_id, role: "admin" },
    });
    assert(admin.canView && !admin.canRevise && admin.source === "admin", "管理员只读授权错误");

    const anonymousWithoutToken = await authorizeSubmissionAccess({
        submissionId: fixtures.anonymous.submission_id,
    });
    assert(!anonymousWithoutToken.canView, "匿名提交在没有令牌时可被访问");

    const stranger = await authorizeSubmissionAccess({
        submissionId: fixtures.account.submission_id,
        actor: { userId: "not-the-owner", role: "user" },
    });
    assert(!stranger.canView && !stranger.canRevise, "非所有者获得了提交访问权限");

    const client = await pool.connect();
    let tokenId: string | null = null;
    let rawToken: string | null = null;
    try {
        await client.query("BEGIN");
        const token = await createSubmissionAccessToken(client, {
            submissionId: fixtures.anonymous.submission_id,
            revisionRequestId: null,
            scopes: ["view"],
            expiresAt: new Date(Date.now() + 60_000),
        });
        tokenId = token.id;
        rawToken = token.token;
        await client.query("COMMIT");

        const tokenAccess = await authorizeSubmissionAccess({
            submissionId: fixtures.anonymous.submission_id,
            accessToken: rawToken,
        });
        assert(tokenAccess.canView && !tokenAccess.canRevise && tokenAccess.source === "token", "匿名 view scope 授权错误");

        const tamperedAccess = await authorizeSubmissionAccess({
            submissionId: fixtures.anonymous.submission_id,
            accessToken: `${rawToken}tampered`,
        });
        assert(!tamperedAccess.canView && tamperedAccess.reason === "token_invalid", "篡改令牌未被拒绝");

        await client.query(
            `UPDATE submission_access_tokens SET expires_at = $1 WHERE id = $2`,
            [new Date(Date.now() - 60_000), tokenId],
        );
        const expiredAccess = await authorizeSubmissionAccess({
            submissionId: fixtures.anonymous.submission_id,
            accessToken: rawToken,
        });
        assert(!expiredAccess.canView && expiredAccess.reason === "token_expired", "过期令牌未被拒绝");

        await client.query(
            `UPDATE submission_access_tokens
             SET expires_at = $1, revoked_at = $2
             WHERE id = $3`,
            [new Date(Date.now() + 60_000), new Date(), tokenId],
        );
        const revokedAccess = await authorizeSubmissionAccess({
            submissionId: fixtures.anonymous.submission_id,
            accessToken: rawToken,
        });
        assert(!revokedAccess.canView && revokedAccess.reason === "token_invalid", "撤销令牌未被拒绝");
    } finally {
        await client.query("ROLLBACK").catch(() => undefined);
        if (tokenId) {
            await client.query(`DELETE FROM submission_access_tokens WHERE id = $1`, [tokenId]);
        }
        client.release();
    }
}

async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error("缺少 DATABASE_URL 环境变量");
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const fixtures = await verifyRevisionTransactions(pool);
        await verifyAccessDecisions(pool, fixtures);
        console.log("表单修订领域服务验证通过");
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error("表单修订领域服务验证失败:", error);
    process.exit(1);
});
