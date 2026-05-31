# 表单编辑器前端重构执行计划

**日期：** 2026-05-30  
**关联需求：** `docs/requirements/2026-05-30-form-editor-ui-redesign.md`  
**内部执行等级：** `L`  
**执行方式：** 串行阶段执行；每阶段完成后验证，暂不提交，等待用户确认

## 总体策略

本次改造采用“后端不动、前端重组”的方式。现有 `components/form-builder.tsx` 承载了数据加载、状态管理、字段编辑、发布设置、成员搜索、预览和发布动作，已经成为主要可用性和维护性瓶颈。计划先迁移路由布局，再拆分编辑器，最后补自动保存和发布检查。

## 阶段 0：基线确认与保护

**目标：** 确认当前未提交改动和可运行状态，防止误覆盖已有修复。

**任务：**

1. 记录 `git status --short --branch`。
2. 阅读 `components/form-builder.tsx`、后台表单列表页、创建页、编辑页。
3. 确认现有 API 请求 payload 与校验规则。
4. 跑一次 `bun run lint`，若失败先判断是否与本轮无关。

**验收：**

- 明确本轮需要触碰的文件清单。
- 未对无关后端逻辑做修改。

## 阶段 1：路由与布局重组

**目标：** URL 保持 `/dashboard/forms/new` 和 `/dashboard/forms/[id]/edit`，但编辑器页面不再继承 dashboard sidebar。

**任务：**

1. 新建独立 route group，例如 `app/(form-editor)/dashboard/forms/...`。
2. 在该 route group 下新增专用 `layout.tsx`：
   - 渲染完整 `<html>` / `<body>`，保持项目既有 theme provider 与 Toaster。
   - 服务端检查 session 和 admin role。
   - 不渲染 `DashboardSidebar`。
3. 将现有创建页与编辑页迁移到该 route group。
4. 删除或替换原 `app/(admin)/dashboard/forms/new/page.tsx` 与 `app/(admin)/dashboard/forms/[id]/edit/page.tsx`，避免同路径重复路由。
5. 后台表单列表页中：
   - “创建表单”用 `target="_blank"` 打开 `/dashboard/forms/new`。
   - “编辑表单”用 `target="_blank"` 打开 `/dashboard/forms/:id/edit`。

**验收：**

- 访问 `/dashboard/forms/[id]/edit` 不显示 sidebar。
- 后台列表页仍显示 sidebar。
- 非管理员不能进入编辑器。
- Next 构建不出现重复 route 冲突。

## 阶段 2：编辑器外壳与视觉结构

**目标：** 建立大厂文档类产品的工作台结构。

**目标布局：**

- 顶部固定工具栏：
  - 左侧：返回 dashboard、表单标题、状态徽标。
  - 中间：保存状态，如“本地已保存 / 正在同步 / 已同步 / 有校验问题”。
  - 右侧：预览、保存、发布。
- 左侧窄栏：
  - 字段大纲。
  - 新增字段按钮。
  - 字段类型快捷菜单。
- 中间画布：
  - 表单标题、描述、说明。
  - 全量字段列表，可直接编辑字段内容。
  - 当前选中字段有轻量高亮。
- 右侧属性栏：
  - Tab 1：字段设置。
  - Tab 2：表单设置。
  - Tab 3：发布检查。

**任务：**

1. 拆分 `components/form-builder.tsx` 为：
   - `components/forms/editor/form-editor-shell.tsx`
   - `components/forms/editor/form-editor-toolbar.tsx`
   - `components/forms/editor/form-field-outline.tsx`
   - `components/forms/editor/form-canvas.tsx`
   - `components/forms/editor/form-field-card.tsx`
   - `components/forms/editor/form-properties-panel.tsx`
   - `components/forms/editor/form-publish-panel.tsx`
   - `components/forms/editor/use-form-editor-state.ts`
2. 保留 `components/form-builder.tsx` 作为薄封装，减少路由层改动。
3. 使用 shadcn/ui 与 lucide-react，避免引入新的 UI 框架。
4. 样式遵循当前 neutral 设计系统，参考 Google Docs 的安静工具栏、浅灰工作区和白色文档画布。

**验收：**

- 主编辑页面不再是多张卡片堆叠。
- 主要编辑动作可以在画布中完成。
- 右侧面板只承担高级配置，不阻塞基础编辑。

## 阶段 3：字段编辑交互

**目标：** 让字段创建和编辑变成直接、连续的文档编辑体验。

**任务：**

1. 中间画布支持直接编辑：
   - 字段标题。
   - 字段说明。
   - 占位提示。
   - 选项列表。
2. 左侧大纲支持：
   - 新增字段。
   - 复制字段。
   - 删除字段。
   - 上移/下移字段。
   - 启用/禁用字段状态提示。
3. 右侧字段属性支持：
   - 字段类型。
   - key。
   - 必填。
   - 启用。
   - 默认值。
   - 基础校验规则。
4. 字段类型选择分组：
   - 常用：单行文本、多行文本、数字、单选、多选、下拉、开关、日期。
   - 高级：邮箱、QQ、Minecraft ID。
5. 对选项型字段使用行内选项编辑，避免用户必须在 textarea 中维护选项。

**验收：**

- 新增 3 个字段、修改标题、添加选项、复制、删除、排序的流程连续可用。
- 多选、单选、下拉字段的选项编辑清晰。
- 移动端下左侧/右侧可折叠，不遮挡主画布。

## 阶段 4：自动保存与恢复

**目标：** 防止意外关闭导致数据丢失，同时避免用无效数据频繁请求后端。

**设计：**

- 本地层：
  - 任意编辑变更后立即写入 `localStorage`。
  - key 使用 `form-editor:draft:new` 或 `form-editor:draft:<formId>`。
  - 存储 payload、更新时间、来源服务端更新时间。
- 服务端层：
  - debounce 约 1200ms。
  - 只有通过前端预校验的 payload 才请求后端。
  - 编辑模式调用 `PUT /api/forms/:id`。
  - 新建模式在满足标题、slug、字段标题等最小合法条件后调用 `POST /api/forms`。
  - 新建成功后用 `router.replace('/dashboard/forms/:id/edit')` 切换到编辑态。

**任务：**

1. 新增本地草稿读写 hook。
2. 新增自动保存状态机：
   - `idle`
   - `local_saved`
   - `syncing`
   - `synced`
   - `validation_blocked`
   - `error`
3. 页面加载时如果检测到本地草稿比服务端数据新，显示恢复提示。
4. 支持放弃本地草稿，恢复服务端版本。
5. 发布前强制调用一次保存；保存失败则阻止发布。

**验收：**

- 编辑后刷新页面能提示恢复。
- 字段为空时不反复请求后端失败。
- 字段补全后能自动同步服务器。
- 顶部状态能准确反映当前保存情况。

## 阶段 5：发布检查与预览入口

**目标：** 发布前把错误集中展示，减少“点发布才报错”的挫败感。

**任务：**

1. 在右侧发布 Tab 展示检查项：
   - 标题是否为空。
   - slug 是否为空且格式合法。
   - 字段标题是否完整。
   - 字段 key 是否为空或重复。
   - 单选/多选/下拉是否至少有一个选项。
   - 指定成员可见时是否选择成员。
2. 发布按钮状态与检查结果联动。
3. 已发布表单显示公开预览入口。
4. 发布成功后刷新版本信息和保存状态。

**验收：**

- 不完整表单不能发布。
- 错误项能定位到对应字段。
- 发布成功后可打开公开表单预览。

## 阶段 6：响应式与可访问性收口

**目标：** 保证新编辑器在常见屏幕尺寸下可用。

**任务：**

1. 桌面端使用三栏布局，固定顶部工具栏。
2. 平板端右侧属性栏可收起。
3. 移动端左侧大纲与右侧属性栏改为抽屉或分段视图。
4. 所有 icon button 增加 tooltip 或 `aria-label`。
5. 检查长标题、长字段、长选项不溢出。

**验收：**

- 1440px、1024px、390px 宽度下不出现明显重叠。
- 键盘 Tab 顺序可用。
- 关键按钮含可理解的 label 或 tooltip。

## 阶段 7：验证与清理

**目标：** 完成完整回归，清理临时产物，等待用户决定是否提交。

**验证命令：**

- `bun run lint`
- `bun run build`

**浏览器回归：**

1. 管理员登录。
2. 从后台表单列表新标签页打开创建页。
3. 创建表单，添加文本、单选、多选、下拉、日期字段。
4. 刷新页面，验证本地草稿恢复提示。
5. 补全字段，等待自动同步。
6. 发布表单。
7. 打开公开预览页，确认发布版本可填写。
8. 回到后台表单列表，确认状态和版本显示正常。

**清理：**

- 删除临时测试数据。
- 删除一次性调试脚本。
- 保留本次 `$vibe` 需求、计划和 receipt 文件。

## 文件所有权边界

**主要前端文件：**

- `components/form-builder.tsx`
- `components/forms/editor/*`
- `app/(admin)/dashboard/forms/page.tsx`
- `app/(form-editor)/dashboard/forms/new/page.tsx`
- `app/(form-editor)/dashboard/forms/[id]/edit/page.tsx`
- `app/(form-editor)/dashboard/forms/layout.tsx`

**原则上不改：**

- `lib/forms.ts`
- `lib/cache/form.ts`
- `app/(api)/api/forms/*`
- 数据库迁移脚本

如发现必须调整后端，必须先记录原因，并将改动限制在兼容性修复。

## 回滚规则

- 每个阶段保持可独立回退。
- 路由迁移阶段若出现重复路由或权限问题，优先回退 route group 调整。
- 自动保存阶段若服务端同步不稳定，保留本地保存，暂时关闭服务端 debounce 自动同步。
- 不回滚本轮开始前已经存在的未提交改动。

## 建议提交边界

用户确认后再提交。建议拆为三次提交：

1. `refactor(forms): 重组表单编辑器路由与布局`
2. `refactor(forms): 重做表单编辑器交互结构`
3. `feat(forms): 增加编辑器自动保存与发布检查`

## 执行前检查清单

- 用户确认开始实现。
- 当前工作区未提交改动已被明确识别。
- 如果需要启动本地服务，优先使用 `bun run dev`。
- 若浏览器插件无法访问 localhost，改用 API 和构建验证并明确说明限制。
