# 表单管理与编辑器体验优化执行计划

## 内部执行级别

L 级串行执行。该任务跨管理页、编辑器状态机、预览路由和少量 API 校验，但边界清晰，不需要多代理并行。

## 执行原则

1. 优先改前端体验，后端只做必要的读取接口和草稿校验放宽。
2. 不破坏已发布表单填写逻辑。
3. 每个阶段完成后做浏览器验证，再进入下一阶段。
4. 本轮不提交，除非用户明确要求。

## 阶段 1：优化表单管理页首屏

### 任务

1. 将 `/dashboard/forms` 页面改为服务端首屏取数。
2. 保留 client component 负责交互：复制链接、删除、局部刷新。
3. 通过 `getAdminForms()` 在页面服务端直接拿初始数据，避免刷新后先空列表再 `useEffect` 请求。
4. 调整 client 状态初始化为 `initialForms`。
5. 删除或弱化全屏 loading，仅在手动刷新或删除操作中显示局部状态。

### 验证

1. 浏览器打开并刷新 `/dashboard/forms`。
2. 确认首屏直接展示列表或空状态。
3. Network 中不应依赖 `/api/forms` 才出现首屏列表。

## 阶段 2：删除确认改为 shadcn Dialog

### 任务

1. 在表单管理 client 组件中引入 `AlertDialog`。
2. 用状态保存待删除表单：`id/title/submission_count`。
3. 删除按钮打开 dialog，不再调用 `window.confirm`。
4. Dialog 展示不可撤销说明和“关联提交记录也会删除”提示。
5. 删除中禁用按钮并显示 loading。
6. 删除成功后关闭 dialog，直接从本地列表移除对应表单，同时 toast 提示成功。

### 验证

1. 点击删除按钮时不出现浏览器系统确认框。
2. Dialog 样式与后台一致。
3. 删除取消不会发请求。
4. 删除确认会发 `DELETE /api/forms/<id>`，成功后列表更新。

## 阶段 3：后台草稿预览页

### 任务

1. 新增路由 `/dashboard/forms/[id]/view`。
2. 该页面需要管理员鉴权，读取 `getAdminFormById(id)`。
3. 预览数据来源优先使用 `draft_payload`：
   - 标题：`forms.title`，为空时显示“未命名表单”。
   - 描述：`forms.description`。
   - 字段：`draft_payload.fields`。
   - 设置：`draft_payload.settings` 合并默认设置。
4. 抽出公开填写页可复用的展示组件，支持 `mode="preview"`。
5. 预览模式中输入控件可以填写体验，但提交按钮禁用并显示“预览模式”。
6. 预览模式不调用提交 API，不写入 `form_submissions`。
7. 编辑器顶部增加“预览”按钮，指向 `/dashboard/forms/<id>/view`。
8. 表单管理页预览按钮统一指向后台预览页；已发布表单可额外保留公开链接入口。

### 验证

1. 未发布草稿可打开 `/dashboard/forms/<id>/view`。
2. 预览页能显示未发布字段和设置。
3. 点击提交按钮不会产生提交记录。
4. 已发布公开页 `/forms/<slug>` 仍读取发布版本。

## 阶段 4：放宽新建草稿自动保存

### 任务

1. 区分“保存草稿校验”和“发布校验”。
2. 新增草稿保存归一化规则：
   - 标题为空时保存为“未命名表单”。
   - slug 为空时生成 `untitled-xxxxxx`。
   - 字段标题为空时允许保存，但保留字段 key。
   - 字段列表为空时补一个默认字段。
3. API `POST /api/forms` 与 `PUT /api/forms/[id]` 的草稿保存路径允许不完整字段。
4. 发布接口继续使用严格 `validateFormVersionPayload`，不允许空标题、空字段标题、空 key、重复 key 或选项缺失。
5. 编辑器 UI 保持发布面板展示错误，不把草稿保存失败误报为发布失败。

### 验证

1. 新建表单后仅修改描述、字段标题、占位符或任意字段属性，都能触发自动保存。
2. 标题为空时服务器创建草稿成功，管理页显示“未命名表单”。
3. 临时 slug 格式为 `untitled-xxxxxx`，并可后续手动修改。
4. 未补字段标题时发布仍失败，并提示具体问题。

## 阶段 5：消除新建后二次 loading

### 任务

1. 创建成功后更新 `activeMode="edit"` 与 `activeFormId`，但不重置当前 payload。
2. 将 URL 更新为 `/dashboard/forms/<id>/edit` 时避免触发全屏 loading。
3. 可选实现策略：
   - 用 `window.history.replaceState` 更新地址，避免 App Router 重新挂载。
   - 或保留 `router.replace`，但通过状态保护跳过新建后的 `loadForm` 全屏 loading。
4. 迁移本地草稿：
   - 删除 `form-editor:draft:new`。
   - 写入 `form-editor:draft:<id>`，并标记 `syncedAt`。
5. 后台静默补拉版本列表和发布信息，不阻塞编辑器主界面。

### 验证

1. 新建自动保存完成后 URL 变为编辑 URL。
2. 编辑器不出现“正在加载表单编辑器...”。
3. 刷新编辑 URL 后能正常从服务器加载草稿。
4. 不再误弹“发现本地草稿”。

## 阶段 6：缓存与失效核对

### 任务

1. 核对 `getAdminForms()` 的 `unstable_cache` key 和 tag。
2. 确认创建、更新、发布、删除、提交都会调用正确的 `revalidateTag`。
3. 如果管理页改为服务端首屏取数，确认不因 fetch cache 叠加导致删除后列表陈旧。
4. 必要时为 `/api/forms` 设置明确动态语义，避免管理接口被浏览器或 Next 意外缓存。

### 验证

1. 创建后管理页能看到新表单。
2. 编辑标题/slug 后管理页能看到更新。
3. 发布后管理页版本和状态更新。
4. 删除后刷新管理页不会出现已删除表单。

## 阶段 7：完整回归

### 浏览器验证

1. `/dashboard/forms` 首屏列表展示速度。
2. 删除 dialog 取消与确认。
3. 新建表单任意改动自动保存。
4. 新建后 URL 更新且不闪 loading。
5. 草稿后台预览。
6. 发布后公开填写。
7. 提交管理搜索、详情、导出。
8. 桌面和移动端编辑器布局。

### 命令验证

1. `bun run lint`
2. `bun run build`

## 回滚规则

1. 如果后台预览抽组件影响公开填写页，优先回退抽组件方式，复制最小渲染逻辑保证公开页稳定。
2. 如果放宽草稿保存影响发布校验，立即恢复发布接口严格校验，仅保留草稿 API 的宽松路径。
3. 如果 `history.replaceState` 与 App Router 状态冲突，改回 `router.replace` 并用状态保护减少 loading。

## 清理要求

1. 删除临时测试表单或在最终汇报中列明测试数据。
2. 不保留调试日志。
3. 不提交 `.opencode/package-lock.json`，除非确认它属于项目需要。
4. 最终汇报列出实际修改文件、验证结果和未解决风险。
