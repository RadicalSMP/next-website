# User Related Cache Invalidation Plan

**日期：** 2026-04-05
**关联需求：** `docs/requirements/2026-04-05-user-related-cache-invalidation.md`
**内部执行等级：** `M`

## 任务范围

只覆盖用户删除后遗留的联表缓存脏数据问题。

## 实施步骤

1. 在 `lib/cache/user.ts` 增加用户关联缓存目标采集逻辑，至少覆盖“该用户发布的博客 slug 清单”。
2. 在 `lib/cache/user.ts` 增加用户关联缓存失效函数，统一失效：
   - `ADMIN_USERS`
   - `BLOG_POSTS`
   - `ADMIN_BLOG_POSTS`
   - 用户名/头像相关的博客详情实体 tag
   - `ADMIN_FORMS`
   - `FORM_SUBMISSIONS`
   - `REVIEW_SUBMISSIONS`
3. 在 `/api/users/[id]` 删除路径里先采集目标，再执行删除，删除成功后再失效缓存。
4. 保持 `setRole` / `ban` / `unban` 仅失效 `ADMIN_USERS`，避免无谓扩散。

## 风险控制

- 不在删除前做缓存失效，避免删除失败后出现伪失效
- 不修改公开表单与审核配置逻辑
- 不调整现有 tag 结构，只补删除用户后的缺失失效链

## 验证

- `bun run lint`
- `bun run build`
