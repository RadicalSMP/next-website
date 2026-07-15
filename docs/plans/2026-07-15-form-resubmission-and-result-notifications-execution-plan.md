# 表单补交闭环与批改结果通知执行计划

## 内部执行级别

XL 级，按波次顺序执行。该功能同时涉及数据库修订链、身份授权、匿名令牌、评分重算、邮件幂等、用户端页面和管理员端页面，属于安全敏感的跨模块改动。

波次之间严格串行；只有在 API 契约冻结后，用户端 UI 和管理员端 UI 才允许有限并行。根执行通道负责数据库模型、公共类型、最终集成和完成声明。

## 需求来源

- `docs/requirements/2026-07-15-form-resubmission-and-result-notifications.md`
- 既有结果系统：`docs/requirements/2026-06-06-form-results-grading.md`

## 所有权边界

| 边界 | 主要目录 | 职责 |
|---|---|---|
| 数据与领域模型 | `scripts/`, `lib/forms.ts`, `lib/form-revisions.ts` | 修订、请求、令牌、评分投影 |
| 授权与访问 | `lib/form-submission-access.ts`, 用户 API | 账号所有权、令牌兑换、Cookie |
| 通知 | `lib/email.ts`, `lib/form-notifications.ts`, 通知 API | 模板、幂等、投递、重试 |
| 管理端 | `app/(admin)/dashboard/forms`, `components/forms/results` | 请求补交、修订对比、通知状态 |
| 用户端 | `app/(site)/forms`, `components/forms` | 我的提交、结果、补交编辑器 |
| 缓存与导出 | `lib/cache`, export API | 当前投影、用户列表、修订缓存 |

## 波次 0：基线与测试夹具

### W0-T1 冻结基线

- 确认分支为 `refactor/form`。
- 确认任务外 `.serena/project.yml` 和 `.opencode/package-lock.json` 不纳入修改。
- 记录当前 `bun run lint`、`bunx tsc --noEmit`、`bun run build` 结果。
- 记录当前表单迁移和入服表单种子结果。

### W0-T2 建立回归夹具

- 扩展或新增测试 seed：
  - 登录用户提交。
  - 带邮箱字段的匿名提交。
  - 混合客观题和主观题表单。
  - 启用处理和通知的表单。
- 测试数据使用明确的 `test-` slug，不依赖 `join-application` 特殊逻辑。

### W0 验证

- `bun run lint`
- `bunx tsc --noEmit`
- `bun run build`
- `bun run migrate:forms`
- `bun run seed:join-form`

### W0 提交建议

- 不单独提交；与波次 1 数据模型一起提交。

## 波次 1：数据模型与公共类型

### W1-T1 扩展破坏性迁移

修改 `scripts/migrate-forms.ts`：

- 新增 `form_submission_revisions`。
- 新增 `submission_revision_requests`。
- 新增 `submission_access_tokens`。
- 新增 `submission_notifications`。
- 扩展 `form_submissions` 当前修订投影字段。
- 为 `submission_grades` 增加 `revision_id`，调整唯一约束。
- 为 `submission_events` 增加修订、请求、通知关联字段和 `revision` 事件类型。
- 增加外键、部分唯一索引、令牌哈希索引、通知幂等索引和时间索引。
- 所有 DDL 保持单连接事务。

### W1-T2 定义 TypeScript 类型

修改 `lib/forms.ts`，新增：

- `SubmissionRevisionStatus`
- `RevisionRequestStatus`
- `RevisionEditScope`
- `SubmissionAccessScope`
- `SubmissionNotificationStatus`
- `SubmissionNotificationEvent`
- `FormSubmissionRevision`
- `SubmissionRevisionRequest`
- `SubmissionNotificationConfig.events`
- `SubmissionNotificationConfig.content`

### W1-T3 配置归一化与发布校验

- 扩展 `DEFAULT_RESULT_CONFIG`。
- 旧配置缺少事件和内容设置时安全补默认值。
- 发布时校验通知收件人来源和内容开关。
- `includeCorrectAnswers` 默认固定为 `false`。
- 入服申请预设启用补交请求和处理结果通知。

### W1-T4 初始提交写入修订 1

修改提交 API：

- 主提交、revision 1、当前评分和创建事件在同一事务写入。
- 回填 `current_revision_id` 和 `revision_count = 1`。
- 修订保存本次客户端元数据。

### W1 验证

- 新库可从零迁移。
- 初始提交同时生成主提交和 revision 1。
- 当前投影与 revision 1 数据一致。
- 数据库阻止重复 revision number、重复开放请求和重复通知幂等键。
- `submission_grades` 只能绑定具体 revision。

### W1 回滚

- 如果循环外键导致迁移复杂，保留 nullable 关联并在建表后统一 `ALTER TABLE`。
- 不退回覆盖式答案模型。

### W1 提交建议

- `feat(forms): 增加提交修订与通知数据模型`

## 波次 2：访问授权与领域服务

### W2-T1 提交访问授权服务

新增 `lib/form-submission-access.ts`：

- 校验管理员、账号所有者和匿名授权 Cookie。
- 统一返回 `canView`、`canRevise`、`source` 和拒绝原因。
- 所有用户 API 复用同一授权入口。

### W2-T2 匿名令牌服务

- 使用 Node `crypto.randomBytes(32)` 生成原始令牌。
- 使用 SHA-256 保存令牌哈希。
- 支持 `view`、`revise` scope、过期、撤销和消费。
- 兑换成功后设置 HttpOnly Cookie 并重定向到无 token URL。
- Cookie 仅能授权令牌绑定的 submission。

### W2-T3 修订领域服务

新增 `lib/form-revisions.ts`：

- `createRevisionRequest()`
- `cancelRevisionRequest()`
- `submitRevision()`
- `getCurrentRevision()`
- `getRevisionHistory()`
- `compareRevisions()`
- 所有写操作使用传入的事务 client，禁止领域服务内部直接使用 pool。

### W2-T4 字段变更校验

- 计算客户端提交字段与当前修订的差异。
- `all` 模式允许原版本全部启用字段。
- `selected` 模式要求差异字段是允许字段子集。
- 未授权字段即使提交相同值也可以忽略，但提交不同值必须返回 403/400。
- 合并后重新执行完整字段验证。

### W2-T5 并发与幂等

- 创建请求、取消请求和补交均锁定 submission。
- 补交锁定 active request，防止重复消费。
- 已完成请求再次提交返回 409。
- 同一提交只允许一个 open 请求。

### W2 验证

- 账号 A 不能查看账号 B 的提交。
- 匿名用户没有令牌不能访问。
- 过期、撤销、篡改令牌被拒绝。
- 全部字段和指定字段模式服务端校验正确。
- 并发重复补交只有一个成功。

### W2 回滚

- 若 Cookie 兑换路径受 Route Group 限制，可使用一次性 POST 兑换端点，但不能直接长期使用 URL token。

### W2 提交建议

- `feat(forms): 实现补交访问授权与修订领域服务`

## 波次 3：管理员补交请求 API 与界面

### W3-T1 补交请求 API

新增：

- `POST /api/forms/[id]/results/[submissionId]/revision-requests`
- `POST /api/forms/[id]/results/[submissionId]/revision-requests/[requestId]/cancel`
- `POST /api/forms/[id]/results/[submissionId]/revision-requests/[requestId]/resend`
- `GET /api/forms/[id]/results/[submissionId]/revisions`

### W3-T2 收敛 process API

- 从通用 process API 中移除直接 `request_changes` 写状态逻辑。
- `needs_changes` 只能由 revision request 服务建立。
- `approve`、`reject`、`comment` 保持现有行为。
- 如果需要兼容旧客户端，`request_changes` 返回明确迁移错误，不创建状态。

### W3-T3 扩展结果详情查询

返回：

- 当前 revision。
- revision history。
- active request。
- editable field labels。
- notification delivery history。
- current revision grades。

### W3-T4 “需补充”对话框

扩展 `result-detail-client.tsx`：

- 原因必填。
- 截止时间可选。
- 使用分段控件选择全部字段/指定字段。
- 指定字段模式使用字段复选列表。
- 显示收件人解析结果和匿名用户无法补交的错误。
- 提交前显示范围摘要。

### W3-T5 修订时间线和对比

- 详情页增加“修订”区域。
- 展示 revision number、来源、时间、处理状态和得分。
- 支持选择两个 revision 查看字段级 diff。
- 旧 revision 的评分只读。

### W3-T6 请求管理

- 显示 open/fulfilled/cancelled/expired。
- open 请求支持取消和重发邮件。
- 通知失败显示错误摘要和重试按钮。

### W3 验证

- 全部字段/指定字段 UI 与 API payload 一致。
- 未选择字段时不能提交 selected 请求。
- 匿名无邮箱时 UI 和 API 都拒绝请求。
- 取消请求后补交入口立即失效。
- 修订 diff 正确显示数组、布尔和长文本变化。

### W3 提交建议

- `feat(forms): 增加管理员补交请求与修订历史`

## 波次 4：用户结果与补交页面

该波次可在 W3 API 契约冻结后与 W3 UI 实现有限并行，但不得并行修改公共授权和修订服务。

### W4-T1 用户 API

新增：

- `GET /api/forms/submissions/mine`
- `GET /api/forms/submissions/[submissionId]`
- `POST /api/forms/submissions/[submissionId]/access`
- `POST /api/forms/submissions/[submissionId]/revisions`

### W4-T2 我的提交

新增 `/forms/my-submissions`：

- 仅登录用户访问。
- 分页展示表单、时间、状态、分数、revision count 和补交状态。
- 支持按状态筛选。
- 公开表单页面增加“我的提交”入口。

### W4-T3 用户结果页

新增 `/forms/submissions/[submissionId]`：

- 账号所有者或匿名 Cookie 授权。
- 展示当前答案、成绩、评语、处理备注和补交请求。
- 不返回正确答案、评分规则、IP、指纹或管理员内部事件元数据。
- 显示只包含用户可见内容的修订时间线。

### W4-T4 匿名令牌兑换页

新增 `/forms/submissions/access`：

- 读取 token 后调用兑换 API。
- 成功后立即 replace 到无 token URL。
- 失败显示过期、已使用或无效状态，不回显 token。

### W4-T5 补交编辑器

新增 `/forms/submissions/[submissionId]/revise`：

- 复用填写字段渲染能力，抽取共享 `FormResponseFields`。
- 预填当前 revision。
- 非授权字段显示只读态和锁图标。
- 显示补交原因、字段范围、截止时间。
- 提交前显示变更摘要和确认 Dialog。
- 成功后进入结果页并显示“已补交，等待处理”。

### W4-T6 页面状态

- 登录失效。
- 令牌过期。
- 请求取消。
- 已完成补交。
- 截止时间已过。
- 无字段可修改。
- 提交冲突 409。

### W4 验证

- 登录用户完整闭环。
- 匿名邮件链接完整闭环。
- 只读字段无法通过 UI 修改。
- 移动端字段、状态和确认 Dialog 不重叠。
- 浏览器刷新后授权 Cookie 仍有效，过期后立即失效。

### W4 提交建议

- `feat(forms): 增加用户结果查看与补交页面`

## 波次 5：重新评分与结果投影

### W5-T1 新 revision 自动批改

- 使用原发布版本 `result_config`。
- 为新 revision 创建独立 grade rows。
- 客观题立即评分。
- 主观题 score/comment/graded_by 为空。
- 计算当前 revision 的 total/max。

### W5-T2 当前投影切换

- 在同一事务更新：
  - `current_revision_id`
  - `data`
  - `field_snapshot`
  - `grading_status`
  - `total_score`
  - `max_score`
  - `processing_status = pending`
  - `revision_status = resubmitted`
  - `revision_count`
  - `last_resubmitted_at`
- 关闭 active request。

### W5-T3 人工批改 API 限制

- 仅允许更新 current revision 的 manual grades。
- 请求体 revision 不匹配时返回 409。
- 旧页面加载后发生新补交时，旧批改保存不得覆盖新 revision。
- grading event 关联 revision ID。

### W5-T4 统计、筛选和导出

- 结果列表继续只显示主提交当前投影。
- 增加 revision status 和 revision count 筛选/列。
- CSV 默认导出当前 revision。
- 增加“修订次数”“最近补交时间”。
- 历史 revision 导出本轮不做独立 CSV，保留后续扩展。

### W5 验证

- 原 revision 和评分不变化。
- 新 revision 客观题得分正确。
- 新 revision 主观题进入待批改。
- 旧批改页面提交得到 409。
- 统计不会把 revisions 计为多条结果。

### W5 提交建议

- `feat(forms): 支持补交后的重新评分与当前结果投影`

## 波次 6：邮件通知、幂等和重试

### W6-T1 重构 `lib/email.ts`

保留 Resend 初始化，新增纯模板构建器和发送函数：

- `buildRevisionRequestedEmail()`
- `buildGradingCompletedEmail()`
- `buildProcessingResultEmail()`
- `sendFormEmail()`
- 每个模板同时生成 subject、HTML 和纯文本。
- 所有用户输入统一 HTML 转义。

### W6-T2 通知领域服务

新增 `lib/form-notifications.ts`：

- 解析账号邮箱或映射邮箱。
- 创建 `submission_notifications` 记录。
- 生成稳定 idempotency key。
- 状态流转 pending -> sending -> sent/failed。
- 保存 Resend message ID 和错误摘要。
- 业务事务提交后发送，不回滚业务状态。

### W6-T3 自动触发

- 创建补交请求后发送 `revision_requested`。
- 当前 revision 首次进入 graded 后发送 `grading_completed`。
- processing 进入 approved/rejected 后发送 `processing_changed`。
- `needs_changes` 只通过 revision request 发送，避免双邮件。
- 根据发布版本 notification events 和 autoSend 决定是否触发。

### W6-T4 邮件内容

补交邮件：

- 表单标题。
- 补交原因。
- 可修改字段名称。
- 截止时间。
- 安全访问链接。

成绩邮件：

- 总分/满分。
- 逐题得分。
- 人工评语。
- 结果链接。
- 默认不显示正确答案。

处理邮件：

- 已通过/已拒绝状态。
- 管理员备注。
- 结果链接。

### W6-T5 手动发送和重试

- 现有 notify route 改为调用通知领域服务。
- 手动重发创建新的 attempt，但保留原通知记录。
- 失败通知可重试。
- 成功通知重复点击需要确认，避免误发。

### W6-T6 邮件配置 UI

扩展编辑器结果设置：

- 自动发送总开关。
- 补交请求、批改完成、处理变化事件开关。
- 逐题得分、评语、正确答案内容开关。
- 正确答案开关默认关闭并显示风险提示。

### W6 验证

- 相同 revision 的 grading completed 自动邮件只发送一次。
- 批改重复保存不重复发送。
- 邮件失败不回滚评分或状态。
- 重试后状态和 attempts 正确。
- 匿名邮件链接可兑换且不在重定向 URL 中保留。
- HTML 特殊字符不会破坏邮件。
- 邮件默认不包含正确答案。

### W6 回滚

- 如果自动发送不稳定，关闭 autoSend，保留手动发送和投递记录。
- 不删除 notification 表和事件历史。

### W6 提交建议

- `feat(forms): 增加补交与批改结果邮件通知`

## 波次 7：缓存、安全和完整回归

### W7-T1 缓存

- 增加 submission、user submissions、revision history tags。
- 请求补交、取消、补交、批改、处理和通知后精确失效。
- 保留全局结果缓存失效作为兜底。

### W7-T2 安全检查

- 账号横向越权。
- 匿名 token 猜测、篡改、重放、过期和撤销。
- URL token 清理和 Referrer 风险。
- selected fields 请求篡改。
- revision ID 竞态。
- 邮件 HTML 注入。
- 正确答案泄露。
- 错误响应不包含令牌、数据库错误或邮箱以外隐私。

### W7-T3 数据库回归

- 停止 Next 服务。
- 运行破坏性迁移。
- 运行 seed。
- 验证无 idle in transaction 和 DDL 锁残留。

### W7-T4 浏览器 E2E

1. 登录用户提交 -> 管理员全部字段补交 -> 用户补交 -> 重新批改 -> 自动成绩邮件记录。
2. 登录用户指定字段补交，未授权字段服务端拒绝。
3. 匿名提交 -> 补交邮件 token -> Cookie 兑换 -> 补交。
4. 令牌过期、撤销和重复提交。
5. 多轮补交和 revision diff。
6. 邮件失败、重试和幂等。
7. 结果列表筛选、统计、CSV。
8. 桌面 1440x900、移动端 390x844。
9. 控制台无非预期 error/warn/issue。

### W7-T5 命令验证

- `bun run migrate:forms`
- `bun run seed:join-form`
- `bun run lint`
- `bunx tsc --noEmit`
- `bun run build`
- `git diff --check`

### W7-T6 清理

- 停止开发服务器。
- 关闭浏览器测试页。
- 检查数据库无遗留事务。
- 删除临时 token 输出和测试截图中的敏感信息。
- 生成 `$vibe` phase receipts 和 cleanup receipt。

### W7 提交建议

- `test(forms): 回归补交闭环与结果通知`

## 缓存失效矩阵

| 动作 | 提交详情 | 用户列表 | 管理结果 | 统计 | 修订历史 |
|---|---:|---:|---:|---:|---:|
| 请求补交 | 是 | 是 | 是 | 是 | 是 |
| 取消请求 | 是 | 是 | 是 | 是 | 是 |
| 用户补交 | 是 | 是 | 是 | 是 | 是 |
| 保存批改 | 是 | 是 | 是 | 是 | 是 |
| 处理状态 | 是 | 是 | 是 | 是 | 否 |
| 邮件状态 | 是 | 否 | 是 | 否 | 否 |

## API 错误约定

| 状态码 | 场景 |
|---|---|
| 400 | 字段范围、截止时间、邮箱或 payload 无效 |
| 401 | 需要登录或匿名授权 Cookie 缺失 |
| 403 | 非所有者、令牌 scope 不足、修改未授权字段 |
| 404 | 提交、请求或通知不存在 |
| 409 | 已存在 open 请求、请求已消费、revision 冲突、旧批改页面 |
| 410 | 令牌或补交请求已过期/撤销 |
| 502 | 邮件提供商失败，但业务状态已保存 |

## 生产失败模式自检

### 失败模式 1：匿名链接泄露

- 防护：短期随机令牌、哈希存储、Cookie 兑换、URL 清理、可撤销、scope 限制。
- 不采用长期直接 token URL。

### 失败模式 2：补交与批改并发

- 防护：submission/request `FOR UPDATE`、revision ID 乐观校验、旧批改返回 409。
- 不允许静默覆盖当前结果。

### 失败模式 3：邮件重复或发送失败

- 防护：notification 表、idempotency key、业务事务后发送、失败可重试。
- 不把邮件成功作为业务事务提交条件。

## 回滚总则

1. 数据结构只新增和调整表单域，不改 better-auth 表。
2. UI 出现严重问题时先隐藏补交入口，保留修订和通知记录。
3. 匿名授权出现安全问题时立即禁用 token 兑换，只保留登录用户补交。
4. 自动邮件异常时关闭 autoSend，保留手动发送和重试。
5. 不回滚为覆盖原答案或删除修订历史。

## 完成定义

只有满足以下条件才可声明完成：

1. 所有验收标准通过。
2. 所有命令验证通过。
3. 登录和匿名两条补交路径完成浏览器 E2E。
4. 全部字段和指定字段两种模式均通过服务端越权测试。
5. 自动邮件幂等和失败重试有数据库证据。
6. 无遗留开发服务器、浏览器页或数据库事务。
7. 用户确认后再按阶段提交并推送 `refactor/form`。
