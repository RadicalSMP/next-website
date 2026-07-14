# 表单结果收集与批改功能需求草案

## 背景

当前表单系统已经完成创建、编辑、发布、填写、提交管理的核心闭环。下一阶段不应把能力设计成“所有提交都进入审批流”，而应更接近 Google Forms、腾讯文档表单的产品模型：表单发布后持续收集结果，后台可以查看汇总、逐条查看、导出数据，并在需要时对客观题和主观题进行批改。

因此，本轮推荐把能力重命名为“结果收集与批改”。审核、通过、拒绝、入服申请结果通知都只是结果处理的一部分，不是系统主线。入服表单可以通过字段映射、分数规则、人工批改、结果状态和通知模板组合出来，但底层仍然是通用结果收集系统。

项目仍处于 dev 阶段，允许破坏性迁移。设计上应优先保证数据结构清晰、版本快照可靠、结果可回放、批改可追溯，避免再把业务逻辑和 `join-application` slug 或固定审批模式强绑定。

## 目标

1. 表单发布后自动进入结果收集状态，提交记录作为“结果”统一管理。
2. 结果配置随发布版本固化，后续改表单或改评分规则不影响旧结果回放。
3. 后台提供结果中心，支持汇总视图、结果列表、单条详情、筛选、搜索、导出。
4. 支持客观题自动批改：单选、多选、下拉、开关等字段可配置答案和分值。
5. 支持主观题人工批改：文本、多行文本、数字、日期等字段可由管理员给分、写评语。
6. 支持总分、满分、逐题得分、批改状态、批改历史。
7. 支持可选的结果处理状态，例如待处理、已处理、已通过、已拒绝、需补充。
8. 支持可选通知模板，但不要求每个表单都发送结果通知。
9. 入服申请通过预设实现：字段映射、结果状态、批改规则、通知模板组合，不生成独立模式。
10. 提交管理页升级为结果管理页，避免“提交”和“审核”概念割裂。

## 非目标

1. 本轮不做多级审批、会签、复杂流转。
2. 本轮不做 AI 自动批改。
3. 本轮不做实时协作批改。
4. 本轮不做用户重新补交/退回修改闭环，除非后续确认必须要做。
5. 本轮不做细粒度批改员角色，只按当前 admin 权限实现。
6. 本轮不把 `join-application` 设计成特殊代码路径。
7. 本轮不要求所有结果都必须有“通过/拒绝”结论。

## 推荐产品模型

### 一个结果系统，多种使用场景

表单发布版本保存 `result_config`：

```json
{
  "collection": {
    "enabled": true,
    "label": "入服申请",
    "allowAnonymous": true
  },
  "grading": {
    "enabled": true,
    "mode": "mixed",
    "rules": []
  },
  "processing": {
    "enabled": true,
    "statuses": ["pending", "approved", "rejected", "needs_changes"],
    "defaultStatus": "pending"
  },
  "notifications": {
    "enabled": false,
    "template": null,
    "recipient": {
      "source": "mapped_field",
      "fieldKey": "email"
    }
  },
  "fieldMappings": {
    "email": "email",
    "playerName": "mcid",
    "qq": "qq"
  }
}
```

普通问卷可以使用最小配置：

```json
{
  "collection": {
    "enabled": true
  },
  "grading": {
    "enabled": false
  },
  "processing": {
    "enabled": false
  },
  "notifications": {
    "enabled": false
  }
}
```

关键点：

1. `collection` 是主线，所有表单提交都是可查看、可筛选、可导出的结果。
2. `grading` 是可选能力，开启后支持客观题自动批改和主观题人工批改。
3. `processing` 是可选能力，只有需要“通过/拒绝/需补充”的表单才启用。
4. `notifications` 是可选能力，不默认发送结果通知。
5. `fieldMappings` 是可选能力，用于把通用字段映射到业务语义。
6. 入服申请、报名审核、答题测验都只是不同配置组合。

### 入服表单如何通过配置实现

入服表单不需要独立审核模式，只需要使用一组预设配置：

1. `collection.label = "入服申请"`。
2. 启用 `processing`，状态包含待处理、已通过、已拒绝、需补充。
3. 映射邮箱字段，用于可选发送结果通知。
4. 映射玩家名、QQ、MCID 字段，用于详情页展示和通知文案。
5. 可选启用 `grading`，对入服答题项设置客观题答案和分值。
6. 对主观题如“申请理由”“社区理解”等允许管理员人工给分和评语。
7. 可选启用通知模板 `join_application_result`。

这样任何表单都可以通过配置成为“入服申请表单”，但数据库、API、结果中心和页面只认识通用结果收集与批改。

### 结果状态

建议把状态拆成三类，避免概念混用。

#### 收集状态

描述结果记录本身的生命周期：

- `submitted`：已提交。
- `flagged`：已标记。
- `archived`：已归档。

#### 批改状态

描述是否完成评分：

- `not_required`：无需批改。
- `auto_graded`：已自动批改。
- `manual_required`：需要人工批改。
- `graded`：已完成批改。

#### 处理状态

只有启用 `processing` 时才使用：

- `not_required`：无需处理。
- `pending`：待处理。
- `approved`：已通过。
- `rejected`：已拒绝。
- `needs_changes`：需补充或需修改，先保留状态位，本轮可以不做用户补交入口。

这样普通问卷不会被迫出现“待审核”，答题表单可以只看批改状态，入服表单则可以额外看处理状态。

### 客观题自动批改

支持字段：

- 单选、下拉、开关：配置一个正确答案和分值。
- 多选：配置正确答案集合、分值、匹配策略。

提交后立即根据发布版本的 `result_config.grading` 生成客观题批改快照：

- 总分
- 满分
- 每题得分
- 是否命中正确答案
- 评分规则快照

### 主观题人工批改

支持字段：

- 单行文本
- 多行文本
- 数字
- 日期
- 其他后续扩展字段

管理员在单条结果详情页中逐题给分、写评语：

- 单题得分
- 单题满分
- 批改评语
- 批改人
- 批改时间
- 批改历史

主观题不做自动判分，避免过早引入复杂规则。后续如需要，可再扩展关键词匹配、范围判分或 AI 辅助批改。

### 结果通知

通知是可选能力：

- 普通问卷默认不通知。
- 答题测验可选择发送成绩。
- 入服申请可选择发送通过/拒绝结果。

本轮推荐先实现邮件通知，站内通知只保留扩展位。通知收件人优先从字段映射读取，也可以 fallback 到提交用户账号邮箱。

## 推荐数据模型

### `form_versions`

新增或调整：

- `result_config JSONB NOT NULL DEFAULT '{"collection":{"enabled":true},"grading":{"enabled":false},"processing":{"enabled":false},"notifications":{"enabled":false}}'`

原因：结果收集、批改、处理、通知配置必须和发布版本绑定，避免表单后续修改污染旧结果。

### `form_submissions`

保留提交结果主记录，并新增：

- `grading_status TEXT NOT NULL DEFAULT 'not_required'`
- `total_score NUMERIC`
- `max_score NUMERIC`
- `processing_status TEXT NOT NULL DEFAULT 'not_required'`
- `processed_by TEXT`
- `processed_at TIMESTAMPTZ`
- `processing_note TEXT`

原因：结果列表、统计页、导出页需要快速读取批改和处理摘要，不应每次从明细表聚合。

### `submission_grades`

用于保存每次提交的逐题批改明细，覆盖客观题自动批改和主观题人工批改：

- `id`
- `submission_id`
- `field_key`
- `field_label`
- `field_type`
- `answer`
- `expected_answer`
- `score`
- `max_score`
- `grading_type`：`auto` 或 `manual`
- `matched`
- `comment`
- `rule_snapshot`
- `graded_by`
- `graded_at`
- `created_at`
- `updated_at`

原因：评分结果必须可回放，导出和详情页也需要逐题解释。

### `submission_events`

用于保存结果处理、批改、通知等事件历史：

- `id`
- `submission_id`
- `form_id`
- `event_type`
- `action`
- `from_status`
- `to_status`
- `note`
- `score`
- `max_score`
- `actor_id`
- `metadata`
- `created_at`

原因：结果状态可能被修改，主观题可能被重新批改，通知可能失败，必须保留事件历史，便于追责和恢复上下文。

## 推荐页面

1. `/dashboard/forms/results`
   - 全局结果中心。
   - 支持按表单、收集状态、批改状态、处理状态、是否有评分、关键词筛选。
   - 可选显示场景标签，例如“入服申请”“问卷”“测验”。
   - 展示提交者、表单、分数、批改状态、处理状态、提交时间。

2. `/dashboard/forms/[id]/results`
   - 单表单结果管理页。
   - 替代或升级现有 submissions 页面。
   - 保持搜索、分页、展开详情、导出能力。
   - 增加汇总统计：总提交数、平均分、最高分、批改进度、处理状态分布。

3. `/dashboard/forms/[id]/results/[submissionId]`
   - 单条结果详情和批改页。
   - 展示字段值、元数据、客观题得分、主观题批改、事件历史。
   - 提供主观题给分、评语、保存批改。
   - 如果启用 `processing`，提供通过、拒绝、需补充、备注操作。
   - 如果启用 `notifications`，提供发送通知操作。

4. 编辑器属性面板新增“结果”或“收集”设置区
   - 结果收集设置。
   - 客观题答案和分数设置。
   - 主观题满分设置。
   - 可选处理状态设置。
   - 可选通知模板和收件人字段映射。
   - 提供“入服申请预设”按钮。

## 推荐 API

1. `GET /api/forms/results`
   - 获取全局结果列表。

2. `GET /api/forms/[id]/results`
   - 获取单表单结果列表和统计。

3. `GET /api/forms/[id]/results/[submissionId]`
   - 获取单条结果详情、批改明细、事件历史。

4. `POST /api/forms/[id]/results/[submissionId]/grades`
   - 保存主观题批改。

5. `POST /api/forms/[id]/results/[submissionId]/process`
   - 创建可选处理动作：通过、拒绝、需补充、备注。

6. `POST /api/forms/[id]/results/[submissionId]/notify`
   - 可选发送结果通知。

7. `PUT /api/forms` 和 `PUT /api/forms/[id]`
   - 扩展草稿 payload，保存 `resultConfig`。

8. `POST /api/forms/[id]/publish`
   - 校验并固化 `result_config`。

9. `POST /api/forms/[id]/submissions`
   - 按发布版本的 `result_config` 初始化批改状态、处理状态并生成客观题批改快照。

## 验收标准

1. 普通表单提交后进入结果中心，但不显示“待审核”。
2. 表单可以在编辑器里配置客观题答案、分值和主观题满分。
3. 发布后结果配置写入版本快照。
4. 客观题表单提交后自动生成逐题得分和总分。
5. 含主观题的表单提交后显示 `manual_required`，管理员可人工给分和评语。
6. 完成主观题批改后总分和批改状态更新。
7. 启用处理状态的表单可以通过、拒绝、需补充。
8. 未启用处理状态的表单不强制出现通过/拒绝。
9. 使用入服申请预设的表单可以表现为入服结果处理流程。
10. 通知只在配置启用并由管理员触发或规则允许时发送。
11. 修改草稿评分规则不影响已提交结果和旧版本批改快照。
12. `bun run lint` 和 `bun run build` 通过。

## 待确认问题

1. 结果中心路由是否改为 `/dashboard/forms/results` 和 `/dashboard/forms/[id]/results`，还是继续沿用 submissions 路由但 UI 改名为“结果”？
2. 是否需要内置“入服申请预设”，一键填充字段映射、场景标签、处理状态和邮件模板？
3. 主观题人工批改是否需要逐题满分，还是只允许给总分和总评？
4. 多选题评分默认采用完全匹配、部分给分、选错扣分，还是支持多种但默认完全匹配？
5. 成绩/结果通知是只允许管理员手动发送，还是支持批改完成后自动发送？
6. 是否本轮就做“需补充后用户修改提交”的闭环？如果需要，本轮复杂度会明显上升。
7. 是否需要结果汇总图表，例如选项分布、平均分、分数段统计？
