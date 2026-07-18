# 表单补交闭环与批改结果通知需求

## 背景

当前表单系统已经支持版本化发布、结果收集、客观题自动批改、主观题人工批改、可选处理状态和管理员手动发送结果邮件，但 `needs_changes` 仍然只是一个处理状态。管理员无法指定用户补交范围，用户没有查看自己结果或修改提交的入口，历史答案也没有修订链。

本阶段需要补齐两个闭环：

1. 管理员要求补充资料后，登录用户或匿名用户能够安全地查看请求、修改允许的字段并重新提交。
2. 补交请求、批改完成和处理结论能够按表单配置发送邮件，并保留投递、失败和重试记录。

## 已确认决策

1. 登录用户通过账号身份访问自己的提交。
2. 匿名用户仅在能够解析收件邮箱时支持补交，通过有有效期的签名链接访问。
3. 补交不覆盖原答案，使用同一提交下的不可变修订版本。
4. 管理员发起补交时可以选择：
   - 用户可修改全部启用字段。
   - 用户只可修改管理员选定的字段。
5. 补交始终基于原提交绑定的发布版本和字段快照，不切换到表单当前最新版本。
6. 补交后重新执行客观题批改，当前修订的主观题分数清空并重新进入人工批改，旧修订评分完整保留。
7. 补交后处理状态恢复为 `pending`。
8. 补交请求、批改完成和处理状态变化支持自动邮件通知，并保留管理员手动发送或重发能力。
9. 成绩邮件默认不展示客观题正确答案。

## 目标

1. 建立可重复执行的“请求补交 -> 用户修改 -> 重新评分 -> 管理员处理”闭环。
2. 保证每次答案、评分、处理和通知都可回放、可审计。
3. 为登录用户和匿名用户提供安全且一致的补交体验。
4. 将邮件发送从单次直接调用升级为有幂等、状态和重试记录的通知能力。
5. 保持现有结果列表只展示一条主提交，不因多次补交产生重复结果。
6. 保持普通问卷不被迫启用补交、处理或通知能力。

## 非目标

1. 不做多级审批、会签或工作流编排。
2. 不做填写者之间的协作修改。
3. 不做管理员代替用户编辑答案。
4. 不做短信、QQ、站内信等其他通知渠道。
5. 不在邮件中默认公开客观题正确答案。
6. 不做附件上传和附件版本管理。
7. 不做 AI 批改或 AI 补交建议。

## 角色与权限

### 管理员

- 查看所有提交及完整修订历史。
- 发起补交请求，选择全部字段或指定字段。
- 设置补交原因和可选截止时间。
- 取消未完成的补交请求。
- 重发补交邮件或结果邮件。
- 查看邮件投递状态和失败原因。
- 在用户补交后重新批改并继续处理。

### 登录填写者

- 在“我的提交”中查看本人提交。
- 查看处理状态、补交原因、截止时间、当前成绩和人工评语。
- 在存在有效补交请求时修改允许的字段。
- 查看自己的修订时间线，但不能查看评分规则、正确答案或管理员内部元数据。

### 匿名填写者

- 不能通过提交 ID 直接访问结果。
- 只能通过发送到提交邮箱的有效访问链接进入。
- 访问链接先兑换为 HttpOnly、SameSite Cookie，再跳转到不含令牌的结果 URL。
- 只能访问令牌绑定的提交和令牌允许的操作。

## 核心流程

### 管理员请求补交

1. 管理员在结果详情页点击“需补充”。
2. 对话框要求填写补交原因。
3. 管理员选择“全部字段”或“指定字段”。
4. 选择指定字段时，至少选择一个当前发布版本中存在且启用的字段。
5. 管理员可选设置截止时间。
6. 服务端锁定目标提交，确认处理功能已启用且不存在另一个有效补交请求。
7. 创建补交请求，将处理状态更新为 `needs_changes`，写入事件历史。
8. 登录提交者使用账号访问；匿名提交者生成随机访问令牌并发送补交邮件。
9. 邮件失败不回滚补交请求，但后台必须显示失败状态并允许重试。

### 用户补交

1. 用户进入提交结果页，看到补交原因、范围、截止时间和当前答案。
2. 补交页面使用原提交绑定版本的字段快照。
3. 全部字段模式允许修改所有启用字段。
4. 指定字段模式只启用管理员选定字段，其他字段只读显示。
5. 服务端拒绝修改未授权字段，即使客户端请求被篡改。
6. 提交时锁定主提交和补交请求，验证身份、令牌、状态和截止时间。
7. 将允许修改的值合并到当前修订，生成新的不可变修订。
8. 为新修订重新生成客观题和主观题批改记录。
9. 更新主提交的当前答案投影、分数摘要、修订计数和当前修订 ID。
10. 将补交请求标记为已完成，处理状态恢复为 `pending`。
11. 撤销该补交请求的修改权限令牌并写入事件历史。

### 批改完成通知

1. 当前修订从 `manual_required` 转为 `graded` 时触发通知判断。
2. 只有发布版本启用了通知且配置允许自动发送时才自动发送。
3. 邮件包含表单标题、总分、满分、逐题得分、人工评语和结果链接。
4. 邮件默认不包含正确答案。
5. 重复保存已完成批改不得重复触发同一修订的自动邮件。

### 处理结果通知

1. 处理状态变为 `approved`、`rejected` 或 `needs_changes` 时触发对应通知判断。
2. `needs_changes` 使用专用补交请求邮件，包含原因、可修改字段和截止时间。
3. `approved`、`rejected` 使用结果通知模板。
4. 管理员可以在详情页手动重发。

## 数据模型

### `form_submissions` 扩展

继续作为结果列表和统计查询的当前投影，新增：

- `current_revision_id UUID`
- `active_revision_request_id UUID`
- `revision_count INTEGER NOT NULL DEFAULT 1`
- `revision_status TEXT NOT NULL DEFAULT 'none'`
  - `none`
  - `requested`
  - `resubmitted`
- `last_resubmitted_at TIMESTAMPTZ`

现有 `data`、`field_snapshot`、`grading_status`、`total_score` 和 `max_score` 始终表示当前修订，避免重写结果列表和统计查询。

### `form_submission_revisions`

保存不可变答案版本：

- `id UUID PRIMARY KEY`
- `submission_id UUID NOT NULL`
- `revision_number INTEGER NOT NULL`
- `source_request_id UUID`
- `data JSONB NOT NULL`
- `field_snapshot JSONB NOT NULL`
- `submitted_by TEXT`
- `submitted_via TEXT`：`initial`、`account`、`token`
- `ip_address TEXT`
- `user_agent TEXT`
- `fingerprint TEXT`
- `duration INTEGER`
- `created_at TIMESTAMPTZ`
- 唯一约束：`submission_id + revision_number`

### `submission_revision_requests`

保存每次补交要求：

- `id UUID PRIMARY KEY`
- `submission_id UUID NOT NULL`
- `base_revision_id UUID NOT NULL`
- `edit_scope TEXT NOT NULL`：`all` 或 `selected`
- `editable_field_keys TEXT[] NOT NULL`
- `reason TEXT NOT NULL`
- `status TEXT NOT NULL`：`open`、`fulfilled`、`cancelled`、`expired`
- `expires_at TIMESTAMPTZ`
- `requested_by TEXT NOT NULL`
- `fulfilled_revision_id UUID`
- `created_at TIMESTAMPTZ`
- `fulfilled_at TIMESTAMPTZ`
- `cancelled_at TIMESTAMPTZ`

同一提交同一时刻最多存在一个 `open` 请求，使用部分唯一索引保证。

### `submission_access_tokens`

保存匿名访问授权：

- `id UUID PRIMARY KEY`
- `submission_id UUID NOT NULL`
- `revision_request_id UUID`
- `token_hash TEXT UNIQUE NOT NULL`
- `scopes TEXT[] NOT NULL`：`view`、`revise`
- `expires_at TIMESTAMPTZ NOT NULL`
- `last_used_at TIMESTAMPTZ`
- `consumed_at TIMESTAMPTZ`
- `revoked_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ`

原始令牌只发送一次，数据库只保存 SHA-256 哈希。补交成功后撤销 `revise` 权限；查看结果使用独立的 `view` 权限。

### `submission_grades` 调整

- 新增 `revision_id UUID NOT NULL`。
- 唯一约束改为 `revision_id + field_key`。
- 管理员只能修改主提交当前修订的人工评分。
- 旧修订评分保持只读。

### `submission_events` 调整

- `event_type` 增加 `revision`。
- 新增可选 `revision_id`、`revision_request_id`、`notification_id`。
- 记录请求补交、取消请求、匿名访问、提交修订、评分完成、状态变化和通知重试。

### `submission_notifications`

保存邮件投递和重试状态：

- `id UUID PRIMARY KEY`
- `submission_id UUID NOT NULL`
- `revision_id UUID`
- `revision_request_id UUID`
- `event_type TEXT NOT NULL`
- `template TEXT NOT NULL`
- `recipient TEXT NOT NULL`
- `payload JSONB NOT NULL`
- `status TEXT NOT NULL`：`pending`、`sending`、`sent`、`failed`
- `attempts INTEGER NOT NULL DEFAULT 0`
- `idempotency_key TEXT UNIQUE NOT NULL`
- `provider_message_id TEXT`
- `last_error TEXT`
- `sent_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

## 通知配置

扩展发布版本的 `result_config.notifications`：

```json
{
  "enabled": true,
  "template": "score_result",
  "recipient": {
    "source": "account_email",
    "fieldKey": null
  },
  "autoSend": true,
  "events": {
    "revisionRequested": true,
    "gradingCompleted": true,
    "processingChanged": true
  },
  "content": {
    "includeQuestionScores": true,
    "includeComments": true,
    "includeCorrectAnswers": false
  }
}
```

补交请求邮件属于补交闭环的必要通知。匿名提交无法解析邮箱时，管理员不能向其发起补交请求；登录提交者仍可通过账号访问，邮件失败不阻止请求建立。

## 页面与路由

### 用户端

- `/forms/my-submissions`
  - 登录用户的提交列表。
  - 显示表单、提交时间、批改状态、处理状态、补交状态和当前分数。
- `/forms/submissions/[submissionId]`
  - 当前结果、处理备注、批改结果、补交请求和修订时间线。
- `/forms/submissions/[submissionId]/revise`
  - 预填当前答案。
  - 非授权字段只读。
  - 显示原因、截止时间和变更范围。
- `/forms/submissions/access?token=...`
  - 兑换匿名令牌，设置 HttpOnly Cookie 后重定向到干净 URL。

### 管理端

- 扩展 `/dashboard/forms/[id]/results/[submissionId]`：
  - “需补充”对话框增加原因、截止时间和字段范围。
  - 增加有效补交请求状态、取消和重发邮件。
  - 增加修订时间线和任意两个修订的字段差异。
  - 增加邮件投递状态和失败重试。
- 结果列表增加“待补交”“已补交”筛选和修订次数。

## API

### 管理员

- `POST /api/forms/[id]/results/[submissionId]/revision-requests`
  - 创建补交请求。
- `POST /api/forms/[id]/results/[submissionId]/revision-requests/[requestId]/cancel`
  - 取消未完成请求。
- `POST /api/forms/[id]/results/[submissionId]/revision-requests/[requestId]/resend`
  - 重发补交邮件。
- `POST /api/forms/[id]/results/[submissionId]/notifications/[notificationId]/retry`
  - 重试失败通知。
- `GET /api/forms/[id]/results/[submissionId]/revisions`
  - 获取修订和差异数据。

现有 `process` API 不再直接创建 `needs_changes`，该动作统一由 revision request API 完成，避免两个真相来源。

### 用户

- `GET /api/forms/submissions/mine`
- `GET /api/forms/submissions/[submissionId]`
- `POST /api/forms/submissions/[submissionId]/access`
- `POST /api/forms/submissions/[submissionId]/revisions`

## 安全规则

1. 登录用户必须满足 `submission.user_id === session.user.id`。
2. 管理员权限不能隐式授予匿名令牌持有者。
3. 匿名令牌使用至少 32 字节随机值，数据库只保存哈希。
4. 令牌兑换后使用 HttpOnly、Secure（生产）、SameSite=Lax Cookie。
5. URL 中的令牌兑换后立即重定向清除。
6. 服务端校验实际变更字段是允许集合的子集。
7. 同一补交请求只能成功提交一次，事务内使用 `FOR UPDATE`。
8. 截止时间已过时将请求标记为 `expired`，禁止继续提交。
9. 通知内容不写入访问令牌明文、正确答案或管理员内部元数据。
10. 手动重试使用新的投递尝试，但不得重复触发业务状态变化。

## 缓存策略

新增缓存标签：

- `form-submission:<submissionId>`
- `user-form-submissions:<userId>`
- `form-result-revisions:<submissionId>`

创建/取消补交请求、提交修订、保存批改、处理状态和通知状态变化后，失效：

- 当前提交详情。
- 用户“我的提交”。
- 管理员结果列表与详情。
- 表单统计。

## 默认规则

1. 一个提交最多存在一个有效补交请求，但可以连续进行多轮补交。
2. 截止时间可选；未设置时匿名修改令牌默认 30 天过期。
3. 设置截止时间时，令牌过期时间等于截止时间。
4. 全部字段指原提交版本中所有启用字段。
5. 指定字段模式至少选择一个字段。
6. 补交后不自动保留当前修订的人工得分。
7. 只有批改状态首次进入 `graded` 时自动发送该修订的成绩邮件。
8. `approved`、`rejected`、`needs_changes` 可以触发处理通知。
9. 自动通知失败不回滚补交、批改或处理事务。

## 验收标准

1. 管理员能够选择全部字段或指定字段发起补交。
2. 登录用户只能查看和补交自己的提交。
3. 匿名用户只能通过有效邮件链接访问指定提交。
4. 过期、撤销、已消费或篡改令牌均不能提交修订。
5. 指定字段模式下，客户端和服务端都阻止修改其他字段。
6. 原答案和原评分保持不变，新修订可完整回放。
7. 补交后客观题重新评分，主观题进入待人工批改。
8. 补交后处理状态恢复为待处理。
9. 多轮补交按修订号有序记录，不产生重复结果行。
10. 批改完成邮件只发送一次，手动重发除外。
11. 邮件包含分数、评语和结果链接，但默认不包含正确答案。
12. 邮件失败可在后台查看并重试。
13. 用户端和管理员端缓存即时更新。
14. CSV 默认导出当前修订，并增加修订次数和最近补交时间。
15. `bun run lint`、`bunx tsc --noEmit`、`bun run build` 通过。
16. 桌面和移动端补交页面无溢出、重叠或不可操作控件。

## 风险

1. 匿名链接被转发会授予接收者访问权限，因此必须短期有效、可撤销且不在 URL 中长期保留。
2. 补交与管理员批改并发可能覆盖当前投影，必须锁定提交和当前修订。
3. 邮件发送发生在业务事务之后，必须通过通知记录和幂等键防止重复发送。
4. 修订历史增加查询量，结果列表继续读取主提交投影，历史仅在详情页按需加载。
5. 破坏性迁移必须在停止 Next.js 服务后执行，避免 DDL 锁等待。

## 规划结论

需求已冻结，无剩余产品决策。实现前需由用户批准执行计划。
