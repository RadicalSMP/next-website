# 风格与约定
- 所有说明、注释、提交信息优先使用中文。
- 项目使用 `@/*` 路径别名。
- 缓存分层：公开读优先 `use cache` + `cacheTag/cacheLife`；后台聚合读目前延续 `unstable_cache` + `revalidateTag`。
- 业务组件放 `components/`，基础 UI 与 shadcn 组件放 `components/ui/`。
- 不要假设有共享根 layout；不同 route group 各自管理文档结构。