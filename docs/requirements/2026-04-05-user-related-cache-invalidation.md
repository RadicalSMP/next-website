# User Related Cache Invalidation Requirement

**日期：** 2026-04-05
**分支：** `refactor/cache`
**运行模式：** `vibe / interactive_governed`

## 目标

只修复“用户写路径没有覆盖联表用户信息缓存失效”的问题，确保删除用户后，依赖用户名、头像、审核人名称等派生字段的缓存不会继续返回旧数据。

## 交付物

- 用户关联缓存目标采集逻辑
- 用户删除后的关联缓存失效逻辑
- 针对本次修复的 `vibe` 运行产物
- 验证结果与 Git 提交

## 约束

- 只处理 review 里第 2 点
- 暂不处理表单本体变更对提交缓存的影响
- 暂不处理 `getReviewScoringRules` 与 `getReviewConfig` 的双入口问题
- 尽量不扩大到无关缓存路径

## 验收标准

- 删除用户后，公开博客列表、公开博客详情、后台博客列表、后台表单列表/详情、后台表单提交列表、审核提交列表相关缓存都会失效
- 角色变更、封禁、解封仍保持原有最小失效范围
- `bun run lint` 通过
- `bun run build` 通过

## 非目标

- 不新增用户资料编辑接口
- 不重构整个用户缓存模型
- 不顺手修复其它 review finding
