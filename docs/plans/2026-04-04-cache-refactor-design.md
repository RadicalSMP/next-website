# Cache Refactor Design

**目标：** 以最小风险将缓存层从分散文件整理为统一模块，并只把适合的公开读取缓存迁移到 Next.js 16 Cache Components。

## 设计摘要

本次不复制 `dev` 分支的全量迁移策略，而采用“结构先行、语义分级”的方案。第一阶段仅重组模块与标签管理；第二阶段只迁公开纯读缓存；第三阶段明确保留后台高动态缓存的旧实现，避免在鉴权、分页、审核与后台列表场景中把渲染模型和缓存模型一次性改掉。

## 方案对比

### 方案 A：直接复刻 `dev` 的全量迁移

- 优点：表面上最接近 Next.js 16 新范式
- 缺点：改动面过大，构建失败时难定位；会同时改变 helper、layout、构建行为与缓存策略

### 方案 B：完全不迁，只做目录整理

- 优点：风险最低
- 缺点：无法验证 Cache Components 在当前仓库里的可行边界，后续还得再开一次重构

### 方案 C：分层迁移

- 优点：风险与收益平衡最好；能逐步验证 `cacheComponents` 与 `use cache` 在当前代码库中的真实表现
- 缺点：短期内会同时存在两套缓存写法

**推荐：** 方案 C。

## 模块边界

- `lib/cache/tags.ts`：集中管理缓存标签
- `lib/cache/blog.ts`：博客缓存
- `lib/cache/form.ts`：表单缓存
- `lib/cache/review.ts`：审核缓存
- `lib/cache/user.ts`：用户缓存
- `lib/cache/index.ts`：统一导出

## 迁移规则

### 迁到 Cache Components

- `getPublishedPosts`
- `getPublishedPostBySlug`
- `getPostMetadataBySlug`
- `getActiveForms`
- `getFormBySlug`

这些函数都具备公开、纯读、参数简单、无用户态依赖的特点。

### 保留 `unstable_cache`

- `getAdminBlogPosts`
- `getAdminForms`
- `getAdminFormById`
- `getFormSubmissions`
- `getReviewScoringRules`
- `getReviewSubmissions`
- `getAdminUsers`

这些函数虽然是读操作，但都更贴近后台动态管理场景，失效要求更严格，且排障成本更高。

## 风险控制

- 不改 layout，不引入 `Suspense` 包装调整
- 不引入 Vercel worker 数量 workaround
- 先改 helper 层，再改 import，最后开 `cacheComponents`
- 全量执行 lint/build 验证
