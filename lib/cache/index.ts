/**
 * 缓存层统一入口
 * 
 * 职责：
 * 1. 集中管理所有缓存标签（避免命名冲突）
 * 2. Re-export 各领域缓存函数
 * 3. 提供全局缓存失效工具
 */

import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "./tags";

// ─── Re-export 缓存标签（外部仍可通过 @/lib/cache 导入） ──
export { CACHE_TAGS } from "./tags";

// ─── Re-export 各领域缓存函数 ─────────────────────────────
export {
  getPublishedPosts,
  getPublishedPostBySlug,
  getPostMetadataBySlug,
  getAdminBlogPosts,
  invalidateBlogCache,
} from "./blog";

export {
  getActiveForms,
  getFormBySlug,
  getAdminForms,
  getAdminFormById,
  getFormSubmissions,
  invalidateFormCache,
  invalidateSubmissionCache,
} from "./form";

export {
  getReviewScoringRules,
  getReviewSubmissions,
  invalidateReviewCache,
  invalidateReviewRulesCache,
} from "./review";

export {
  getAdminUsers,
  invalidateUserCache,
} from "./user";

// ─── 全局缓存工具 ────────────────────────────────────────

/**
 * 使所有缓存失效（慎用！）
 * @param immediate - 是否立即过期（默认 false，使用 stale-while-revalidate）
 */
export function invalidateAllCache(immediate = false) {
  const profile = immediate ? { expire: 0 } : "max";
  Object.values(CACHE_TAGS).forEach((tag) => {
    revalidateTag(tag, profile as "max");
  });
}

/**
 * 按标签批量失效
 * @param immediate - 是否立即过期（默认 false）
 * @param tags - 要失效的标签列表
 */
export function invalidateCacheTags(immediate: boolean, ...tags: string[]) {
  const profile = immediate ? { expire: 0 } : "max";
  tags.forEach((tag) => revalidateTag(tag, profile as "max"));
}
