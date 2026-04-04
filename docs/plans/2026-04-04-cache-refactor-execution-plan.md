# Cache Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 `refactor/cache` 分支完成一轮低风险缓存重构：统一缓存模块结构，并只迁公开纯读缓存到 Cache Components。

**Architecture:** 先完成缓存模块聚合与标签抽象，确保导入路径和职责边界稳定；再对公开纯读函数逐个改为 `'use cache' + cacheTag/cacheLife`；后台和审核缓存保留 `unstable_cache`，避免一次性改变过多运行时行为。

**Tech Stack:** Next.js 16.1.1, React 19, TypeScript, PostgreSQL, `next/cache`

---

### Task 1: 建立统一缓存目录

**Files:**
- Create: `lib/cache/tags.ts`
- Create: `lib/cache/index.ts`
- Modify: `lib/blog-cache.ts`
- Modify: `lib/form-cache.ts`
- Modify: `lib/review-cache.ts`
- Modify: `lib/user-cache.ts`

**Step 1:** 新建统一标签定义文件。

**Step 2:** 将现有缓存模块内容搬迁到 `lib/cache/` 下的分领域文件。

**Step 3:** 创建统一导出入口，减少后续 import 分散。

**Step 4:** 删除旧入口并改写引用到新路径。

### Task 2: 只迁公开纯读缓存到 Cache Components

**Files:**
- Modify: `lib/cache/blog.ts`
- Modify: `lib/cache/form.ts`
- Modify: `next.config.ts`

**Step 1:** 开启 `cacheComponents: true`。

**Step 2:** 将博客公开缓存函数改为 `'use cache' + cacheTag/cacheLife`。

**Step 3:** 将公开表单读取函数改为 `'use cache' + cacheTag/cacheLife`。

**Step 4:** 保持后台/审核函数仍使用 `unstable_cache`。

### Task 3: 更新引用与验证

**Files:**
- Modify: `app/(site)/blogs/page.tsx`
- Modify: `app/(site)/blogs/[slug]/page.tsx`
- Modify: `app/(site)/forms/page.tsx`
- Modify: `app/(api)/api/**/route.ts`

**Step 1:** 修正所有缓存引用路径。

**Step 2:** 运行 `bun run lint`。

**Step 3:** 运行 `bun run build`。

**Step 4:** 记录结果并生成 cleanup receipt。
