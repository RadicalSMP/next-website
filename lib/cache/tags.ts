// ─── 缓存标签注册表 ──────────────────────────────────────
// 所有缓存标签在此集中定义，避免跨模块冲突
// 独立文件，防止循环依赖

export const CACHE_TAGS = {
  // Blog 相关
  BLOG_POSTS: "blog-posts",
  ADMIN_BLOG_POSTS: "admin-blog-posts",

  // Form 相关
  FORMS: "forms",
  ADMIN_FORMS: "admin-forms",
  FORM_SUBMISSIONS: "form-submissions",

  // Review 相关
  REVIEW_SUBMISSIONS: "review-submissions",
  REVIEW_RULES: "review-rules",

  // User 相关
  ADMIN_USERS: "admin-users",
} as const;
