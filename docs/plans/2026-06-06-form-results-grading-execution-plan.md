# 表单结果收集与批改功能执行计划

## 内部执行级别

L 级串行执行。结果收集与批改会影响数据库、提交写入、缓存、后台页面、编辑器配置、导出和可选通知，但各模块边界清晰，推荐按阶段串行推进，不需要多代理并行。

## 执行原则

1. 主线是结果收集，不是审批流。
2. 批改是结果系统的可选能力，覆盖客观题自动批改和主观题人工批改。
3. 处理状态是可选能力，只有入服申请、报名筛选等场景才需要通过/拒绝。
4. 通知是可选能力，不默认发送结果通知。
5. 入服申请通过配置预设实现：场景标签、字段映射、处理状态、通知模板、批改规则组合。
6. 结果配置必须随 `form_versions` 固化，保证旧结果可回放。
7. 当前项目仍处于 dev 阶段，允许破坏性迁移，优先保持结构干净。

## 阶段 1：冻结结果与批改数据模型

### 任务

1. 扩展 `scripts/migrate-forms.ts`：
   - `form_versions.result_config JSONB NOT NULL DEFAULT '{"collection":{"enabled":true},"grading":{"enabled":false},"processing":{"enabled":false},"notifications":{"enabled":false}}'`
   - `form_submissions.grading_status`
   - `form_submissions.total_score`
   - `form_submissions.max_score`
   - `form_submissions.processing_status`
   - `form_submissions.processed_by`
   - `form_submissions.processed_at`
   - `form_submissions.processing_note`
2. 新增 `submission_grades` 表，保存逐题批改快照。
3. 新增 `submission_events` 表，保存批改、处理、通知等事件历史。
4. 增加索引：
   - `idx_form_submissions_grading_status`
   - `idx_form_submissions_processing_status`
   - `idx_submission_grades_submission_id`
   - `idx_submission_events_submission_id`
   - 可选 `idx_form_versions_result_config`，如果后续需要按配置统计再加。
5. 更新 seed 脚本：
   - `seed-join-form.ts` 发布表单时写入通用 `result_config`。
   - 入服申请效果通过 `collection.label`、`processing`、`notifications.template`、`fieldMappings` 实现。
   - 如需演示答题批改，可新增一个带 `grading.enabled = true` 的示例表单，但默认不强制。

### 验证

1. `bun run migrate:forms` 可以从零重建表结构。
2. `bun run seed:join-form` 可以创建带结果处理配置的已发布入服表单。
3. 数据库约束能阻止非法批改状态和处理状态。
4. 数据库结构中不出现 `review_mode` 或 `join_application` 专属列。

## 阶段 2：定义结果配置类型与校验

### 任务

1. 在 `lib/forms.ts` 中新增类型：
   - `FormResultConfig`
   - `ResultCollectionConfig`
   - `ResultGradingConfig`
   - `ResultGradingRule`
   - `ResultProcessingConfig`
   - `ResultNotificationConfig`
   - `ResultFieldMappings`
   - `SubmissionGradingStatus`
   - `SubmissionProcessingStatus`
2. 增加默认值：
   - `DEFAULT_RESULT_CONFIG`
3. 增加归一化函数：
   - `normalizeResultConfig(raw, fields)`
   - `normalizeResultGrading(rawGrading, fields)`
   - `normalizeResultProcessing(rawProcessing)`
   - `normalizeResultNotifications(rawNotifications, fields)`
   - `normalizeResultFieldMappings(rawMappings, fields)`
4. 增加入服申请预设生成函数：
   - `createJoinApplicationResultPreset(fields)`
   - 返回通用 `FormResultConfig`，不返回特殊 mode。
5. 草稿保存允许不完整结果配置，但需要归一化。
6. 发布校验严格检查：
   - 评分规则只能引用存在的字段。
   - 客观题答案必须匹配字段选项。
   - 主观题满分必须为非负数字。
   - 字段 key 必须存在于当前字段列表。
   - 通知收件人字段必须存在，或明确允许 fallback 到账号邮箱。

### 验证

1. 普通无评分表单发布不受影响。
2. 客观题评分配置非法字段 key 时发布失败。
3. 主观题满分为空、负数、非数字时发布失败。
4. 入服申请预设生成的是通用 `result_config`。

## 阶段 3：编辑器增加结果与批改设置

### 任务

1. 在编辑器属性面板中新增 `结果` tab，或在现有 `表单` tab 下增加结果设置区。
2. 结果收集设置：
   - 场景标签，例如“问卷”“测验”“入服申请”。
   - 是否允许匿名，若当前系统支持。
3. 批改设置：
   - 启用或关闭批改。
   - 客观题字段自动列出：单选、多选、下拉、开关。
   - 主观题字段自动列出：单行文本、多行文本、数字、日期。
   - 客观题配置正确答案、分值、多选匹配策略。
   - 主观题配置满分、是否必批、批改提示。
   - 显示总分预估。
4. 处理状态设置：
   - 启用或关闭处理状态。
   - 配置可用状态：待处理、已通过、已拒绝、需补充。
   - 未启用时结果详情不显示通过/拒绝主操作。
5. 通知设置：
   - 启用或关闭通知。
   - 选择通知模板。
   - 配置收件人来源：字段映射或账号邮箱。
   - 默认不自动发送。
6. 支持“入服申请预设”按钮：
   - 自动设置场景标签。
   - 自动启用处理状态。
   - 自动启用入服结果通知模板但默认不自动发送。
   - 尝试按字段标题或 key 匹配邮箱、玩家名、QQ、MCID。
7. 自动保存时写入草稿 `resultConfig`。
8. 发布检查面板增加结果配置错误提示。

### 验证

1. 结果配置变更可自动保存。
2. 应用入服申请预设后，草稿保存的是通用结果配置。
3. 客观题和主观题规则变更后草稿预览不受影响。
4. 发布检查能定位到具体配置问题。
5. 关闭批改后不会保留无效规则影响发布。

## 阶段 4：发布流程固化结果配置

### 任务

1. 修改 `POST /api/forms/[id]/publish`：
   - 从 `draft_payload.resultConfig` 读取结果配置。
   - 使用严格校验。
   - 写入 `form_versions.result_config`。
2. 修改 `getFormBySlug()` 和 `getAdminFormById()`：
   - 必要时返回当前版本的 `result_config`。
3. 更新缓存失效：
   - 发布后继续失效 `forms`、`admin-forms`、单表单 tag。
   - 若有结果中心缓存，同步失效相关 tag。

### 验证

1. 发布新版本后，版本表保存结果配置快照。
2. 修改草稿评分规则不影响旧版本 `result_config`。
3. 公开填写页仍只读取已发布版本。
4. 发布版本中不保存特殊审核模式字段。

## 阶段 5：提交时初始化结果状态和客观题批改

### 任务

1. 修改 `POST /api/forms/[id]/submissions`：
   - 查询当前发布版本时带出 `result_config`。
   - 无批改：`grading_status = "not_required"`。
   - 仅客观题批改完成：`grading_status = "auto_graded"` 或 `graded`。
   - 存在主观题待批：`grading_status = "manual_required"`。
   - 未启用处理：`processing_status = "not_required"`。
   - 启用处理：`processing_status = defaultStatus`，例如 `pending`。
2. 新增客观题批改函数：
   - `gradeObjectiveFields(fields, values, resultConfig)`
   - 返回总分、满分、逐题明细。
3. 为主观题生成待批改记录：
   - 若配置主观题满分，写入 `submission_grades`，`grading_type = "manual"`，score 为空。
4. 提交写入事务化：
   - 插入 `form_submissions`。
   - 插入 `submission_grades`。
   - 必要时插入 `submission_events` 初始事件。
5. 更新缓存失效：
   - `invalidateSubmissionCache()`
   - 新增或复用 `RESULT_SUBMISSIONS` tag。

### 验证

1. 普通表单提交进入结果列表但不进入待处理。
2. 客观题表单提交后生成总分和逐题评分。
3. 含主观题的表单提交后进入待人工批改。
4. 使用入服申请预设的表单提交后进入同一个结果中心，并显示待处理。
5. 批改使用提交绑定的版本配置，而不是当前草稿配置。

## 阶段 6：结果中心 API 与缓存

### 任务

1. 新增 `lib/cache/result.ts` 或扩展 `lib/cache/form.ts`：
   - `getResultList(filters)`
   - `getFormResults(formId, filters)`
   - `getResultDetail(submissionId)`
   - `getResultStats(formId?)`
2. 新增 API：
   - `GET /api/forms/results`
   - `GET /api/forms/[id]/results`
   - `GET /api/forms/[id]/results/[submissionId]`
3. 查询支持筛选：
   - 表单 ID
   - 收集状态
   - 批改状态
   - 处理状态
   - 是否有评分
   - 场景标签
   - 关键词
   - 页码与分页大小
4. 返回字段：
   - 提交 ID
   - 表单标题
   - 版本号
   - 场景标签
   - 提交人
   - 提交时间
   - 批改状态
   - 处理状态
   - 分数/满分
   - 最后处理人
   - 最后处理时间
5. 增加缓存 key 和 tag：
   - `RESULT_LIST`
   - `FORM_RESULTS`
   - `RESULT_DETAIL`

### 验证

1. 全局结果中心能分页加载。
2. 单表单结果页能加载结果和统计。
3. 按批改状态筛选只返回目标状态。
4. 按处理状态筛选可以找到使用入服申请预设的表单结果。
5. 提交、批改、处理后结果缓存即时失效。

## 阶段 7：主观题批改 API

### 任务

1. 新增 `POST /api/forms/[id]/results/[submissionId]/grades`。
2. 请求体：
   - `grades: Array<{ fieldKey, score, comment }>`
   - `overallComment?`
3. 服务端校验：
   - 仅 admin 可操作。
   - submission 必须属于目标 form。
   - 字段必须存在于提交绑定版本。
   - 分数必须在 0 到该题满分之间。
4. 事务化更新：
   - 更新 `submission_grades` 主观题得分和评语。
   - 重新计算 `form_submissions.total_score/max_score`。
   - 更新 `grading_status`。
   - 插入 `submission_events`。
5. 缓存失效：
   - 结果列表
   - 单条结果详情
   - 单表单统计

### 验证

1. 管理员可以给主观题打分。
2. 分数越界返回 400。
3. 保存后总分更新。
4. 所有必批主观题完成后，批改状态变为 `graded`。
5. 批改历史保留每次动作。

## 阶段 8：可选处理动作 API

### 任务

1. 新增 `POST /api/forms/[id]/results/[submissionId]/process`。
2. 请求体：
   - `action: "approve" | "reject" | "request_changes" | "comment"`
   - `note`
3. 服务端校验：
   - 仅 admin 可操作。
   - submission 必须属于目标 form。
   - submission 的发布版本必须启用了 `processing`。
   - 已归档结果是否允许处理，需要按确认结果实现。
4. 事务化更新：
   - 更新 `form_submissions.processing_status`
   - 更新 `processed_by/processed_at/processing_note`
   - 插入 `submission_events`
5. 缓存失效：
   - 结果列表
   - 单条结果详情
   - 单表单统计

### 验证

1. 待处理结果可以通过。
2. 待处理结果可以拒绝并写入备注。
3. 未启用处理状态的结果不能调用处理 API。
4. 处理历史保留每次动作。
5. 非 admin 操作返回 403。

## 阶段 9：可选通知 API

### 任务

1. 新增 `POST /api/forms/[id]/results/[submissionId]/notify`。
2. 服务端校验：
   - 仅 admin 可操作。
   - submission 必须属于目标 form。
   - 发布版本必须启用 `notifications`。
   - 收件人必须能从字段映射或账号邮箱解析。
3. 通知发送：
   - `template = "join_application_result"` 时使用入服结果文案。
   - 后续可扩展 `score_result` 或 `generic_result`。
   - 邮件失败时记录错误并返回 warning。
4. 写入 `submission_events`：
   - 成功、失败、模板、收件人来源。
5. 缓存失效：
   - 单条结果详情。

### 验证

1. 使用入服申请预设时可以手动发送结果邮件。
2. 普通表单未启用通知时不能发送。
3. 邮件备注不会破坏 HTML。
4. 没有可用邮箱时提示管理员，不强行发送。
5. 通知逻辑不依赖 `join-application` slug。

## 阶段 10：结果中心页面

### 任务

1. 新增 `/dashboard/forms/results` 页面。
2. Dashboard 侧边栏增加“结果中心”入口。
3. 页面布局：
   - 顶部统计：总结果数、待批改、已批改、待处理、平均分。
   - 筛选栏：表单、批改状态、处理状态、是否有评分、场景标签、关键词。
   - 表格：表单、场景、提交者、分数、批改状态、处理状态、提交时间、操作。
4. 行操作：
   - 查看详情。
   - 快速处理可后续扩展，本轮建议进入详情页操作。
5. 保持 Dashboard 现有视觉语言，不做营销式页面。

### 验证

1. 页面可进入并加载结果列表。
2. 普通问卷不会显示成“待审核”。
3. 筛选不会导致布局跳动。
4. 空状态、加载态、错误态完整。
5. 移动端不发生表格内容严重溢出，必要时使用横向滚动。

## 阶段 11：单表单结果管理页

### 任务

1. 新增或改造 `/dashboard/forms/[id]/results`。
2. 页面分区：
   - 汇总卡片：提交总数、平均分、最高分、待批改数、待处理数。
   - 图表或摘要：选项分布、分数段、处理状态分布。
   - 结果表格：字段摘要、分数、批改状态、处理状态、提交时间。
3. 保留现有提交管理能力：
   - 搜索
   - 分页
   - 展开详情
   - CSV 导出
4. CSV 导出增加字段：
   - 批改状态
   - 分数
   - 满分
   - 处理状态
   - 处理备注
   - 处理时间

### 验证

1. 原普通提交列表能力迁移后仍正常。
2. 有评分的结果能显示状态和分数。
3. CSV 包含批改和处理列。
4. 搜索和筛选组合工作正常。

## 阶段 12：单条结果详情与批改页

### 任务

1. 新增 `/dashboard/forms/[id]/results/[submissionId]`。
2. 页面分区：
   - 结果摘要：表单、版本、场景标签、提交者、提交时间。
   - 提交内容：按字段快照展示。
   - 客观题批改：显示答案、正确答案、得分。
   - 主观题批改：输入得分和评语。
   - 字段映射摘要：显示邮箱、玩家名、QQ、MCID 等已映射字段。
   - 事件历史：批改、处理、通知事件。
   - 可选处理操作：通过、拒绝、需补充、备注。
   - 可选通知操作：发送结果通知。
3. 操作使用 shadcn Dialog：
   - 保存批改确认。
   - 通过/拒绝确认。
   - 发送通知确认。
4. 操作成功后刷新当前详情和结果中心缓存。

### 验证

1. 详情页能展示字段快照，不受当前表单草稿影响。
2. 客观题得分展示正确。
3. 主观题批改保存后总分更新。
4. 使用入服申请预设时展示玩家字段映射和可选通知。
5. 事件历史立即新增记录。

## 阶段 13：完整回归

### 命令验证

1. `bun run lint`
2. `bun run build`
3. `bun run migrate:forms`
4. `bun run seed:join-form`

### 浏览器验证

1. 普通问卷：创建、发布、填写、进入结果中心、导出。
2. 客观题测验：配置答案、发布、填写、自动批改、查看分数。
3. 主观题问卷：配置满分、发布、填写、人工批改、保存评语。
4. 混合题型表单：客观题自动得分 + 主观题人工得分，总分正确。
5. 入服申请预设：应用预设、提交、进入结果中心、处理通过/拒绝、可选邮件。
6. 版本回放：发布 v1、提交、修改规则发布 v2、确认 v1 结果批改快照不变。
7. 结果中心：筛选、搜索、分页。
8. 单条结果详情：字段快照、批改明细、字段映射、事件历史。
9. CSV 导出包含批改和处理字段。
10. 桌面和移动端布局不重叠。

## 回滚规则

1. 如果主观题批改影响范围过大，先保留主观题满分配置，详情页只支持总评和总分。
2. 如果处理状态影响普通结果体验，先隐藏处理状态 UI，仅保留数据位。
3. 如果通知不稳定，处理和批改先落库，通知作为 warning 返回，不回滚状态。
4. 如果结果中心缓存出现陈旧数据，先将结果中心 API 改为直接查询，后续再恢复缓存。
5. 如果入服申请预设字段自动匹配不稳定，先允许管理员手动选择字段映射。

## 建议提交拆分

1. `feat(forms): 增加结果收集与批改数据模型`
2. `feat(forms): 支持结果配置发布快照`
3. `feat(forms): 提交时生成客观题批改快照`
4. `feat(forms): 增加结果中心与详情接口`
5. `feat(forms): 实现主观题人工批改`
6. `feat(forms): 实现可选结果处理状态`
7. `feat(forms): 实现结果中心页面`
8. `feat(forms): 实现单条结果详情与批改页`
9. `feat(forms): 整合可选通知与入服申请预设`
10. `test(forms): 回归表单结果收集与批改流程`

## 需要用户确认后再实现的问题

1. 结果中心路由是否改为 `/dashboard/forms/results` 和 `/dashboard/forms/[id]/results`？
2. 是否需要内置“入服申请预设”按钮？
3. 主观题人工批改是逐题给分，还是只做总分和总评？
4. 多选题评分默认采用完全匹配，还是部分给分？
5. 成绩/结果通知是手动发送，还是批改完成后可自动发送？
6. 是否本轮做“需补充后用户修改提交”的闭环？
7. 是否需要结果汇总图表，例如选项分布、平均分、分数段统计？
