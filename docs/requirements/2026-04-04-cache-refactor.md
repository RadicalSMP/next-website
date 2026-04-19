# Cache Refactor Requirement

**日期：** 2026-04-04
**分支：** `refactor/cache`
**运行模式：** `vibe / interactive_governed`

## 目标

在当前 `refactor/cache` 分支完成一轮低风险的缓存重构，按三阶段路线推进：

1. 先整理缓存目录结构与标签管理，统一到 `lib/cache/`
2. 仅将公开、纯读、无用户态依赖的缓存函数迁移到 Cache Components
3. 管理后台、审核、用户管理等高动态缓存继续保留 `unstable_cache`

## 交付物

- 统一的 `lib/cache/` 目录结构
- 公开缓存函数的 Cache Components 迁移
- 保守保留的后台缓存边界
- 可通过的构建与 lint 验证
- `vibe` 运行产物与执行计划文档

## 约束

- 所有更改仅在 `refactor/cache` 分支完成
- 不直接照搬 `dev` 分支的整包 cache 改造
- 不引入 `dev` 分支上为构建问题添加的 worker workaround
- 不顺手改 unrelated 业务逻辑
- 优先保证 Vercel/Next.js 16 下的稳定性与可回滚性

## 验收标准

- `lib/*-cache.ts` 被迁入 `lib/cache/`，并由统一出口导出
- `next.config.ts` 仅开启 `cacheComponents: true`，不引入额外实验性构建修补
- 公开只读缓存改为 `'use cache' + cacheTag/cacheLife`
- 后台/审核/用户管理缓存继续使用 `unstable_cache`
- 所有引用路径更新完成
- `bun run lint` 通过
- `bun run build` 通过

## 非目标

- 不在本次内全量迁移所有 `unstable_cache`
- 不重构认证、布局、API 鉴权结构
- 不修复与本次缓存重构无关的历史问题

## 已确认设计

用户已批准采用“三阶段路线”而非 `dev` 分支中的全量 Cache Components 改造。
