# 缓存层架构说明

## 目录结构

```
lib/cache/
├── index.ts      # 统一入口 + 缓存标签注册表
├── blog.ts       # 博客缓存
├── form.ts       # 表单缓存
├── review.ts     # 审核缓存
├── user.ts       # 用户缓存
└── README.md     # 本文档
```

## 缓存失效策略

### `{ expire: 0 }` - 立即过期（阻塞式）

**使用场景**：
- ✅ 审核决策（通过/拒绝）
- ✅ 评分规则更新
- ✅ 表单配置变更
- ✅ 表单提交
- ✅ 用户管理（封禁/角色变更）

**特点**：
- 下次请求会阻塞等待新数据
- 保证数据立即同步
- 适用于关键业务操作

### `profile="max"` - 渐进式更新（推荐）

**使用场景**：
- ✅ 博客文章发布/编辑

**特点**：
- 使用 stale-while-revalidate 策略
- 先返回旧数据，后台异步更新
- 用户体验更流畅

## 各模块策略

| 模块 | 函数 | 策略 | 理由 |
|------|------|------|------|
| **Blog** | `invalidateBlogCache()` | `"max"` | 内容更新延迟可接受 |
| **Form** | `invalidateFormCache()` | `{ expire: 0 }` | 避免用户提交到旧表单 |
| **Form** | `invalidateSubmissionCache()` | `{ expire: 0 }` | 管理员需立即看到新提交 |
| **Review** | `invalidateReviewCache()` | `{ expire: 0 }` | 审核决策需立即生效 |
| **Review** | `invalidateReviewRulesCache()` | `{ expire: 0 }` | 影响后续评分计算 |
| **User** | `invalidateUserCache()` | `{ expire: 0 }` | 封禁/角色变更需立即生效 |

## 使用示例

### 基础用法

```typescript
import { invalidateBlogCache, invalidateFormCache } from "@/lib/cache";

// 博客发布后（渐进式更新）
await pool.query("UPDATE blog_posts SET status = 'published' WHERE id = $1", [id]);
invalidateBlogCache();

// 表单配置更新后（立即过期）
await pool.query("UPDATE forms SET fields = $1 WHERE id = $2", [fields, id]);
invalidateFormCache();
```

### 高级用法

```typescript
import { invalidateAllCache, invalidateCacheTags, CACHE_TAGS } from "@/lib/cache";

// 使所有缓存失效（渐进式）
invalidateAllCache();

// 使所有缓存立即失效（慎用！）
invalidateAllCache(true);

// 批量失效特定标签（立即过期）
invalidateCacheTags(true, CACHE_TAGS.FORMS, CACHE_TAGS.REVIEW_SUBMISSIONS);
```

## 注意事项

1. **立即过期的代价**：`{ expire: 0 }` 会导致下次请求阻塞，影响用户体验
2. **渐进式更新的延迟**：`"max"` 策略下，用户可能短暂看到旧数据
3. **选择原则**：
   - 关键业务操作 → `{ expire: 0 }`
   - 内容展示类 → `"max"`
   - 不确定时 → 优先使用 `"max"`

## 参考文档

- [Next.js revalidateTag API](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
- [Next.js Caching and Revalidating](https://nextjs.org/docs/app/getting-started/caching-and-revalidating)
