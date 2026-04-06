function createCacheKey(...parts: string[]) {
    return parts;
}

export const CACHE_KEYS = {
    ADMIN_BLOG_LIST: createCacheKey("cache", "blog", "admin-list"),
    ADMIN_FORM_LIST: createCacheKey("cache", "form", "admin-list"),
    ADMIN_FORM_DETAIL: createCacheKey("cache", "form", "admin-detail"),
    FORM_SUBMISSION_LIST: createCacheKey("cache", "form", "submission-list"),
    REVIEW_RULES: createCacheKey("cache", "review", "rules"),
    REVIEW_CONFIG: createCacheKey("cache", "review", "config"),
    REVIEW_SUBMISSION_LIST: createCacheKey("cache", "review", "submission-list"),
    ADMIN_USER_LIST: createCacheKey("cache", "user", "admin-list"),
    SETTING_ITEM: createCacheKey("cache", "settings", "item"),
    SETTINGS_MASKED: createCacheKey("cache", "settings", "masked"),
    AI_CONFIG: createCacheKey("cache", "settings", "ai-config"),
};
