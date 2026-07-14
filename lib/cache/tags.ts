export const CACHE_TAGS = {
    BLOG_POSTS: "blog-posts",
    ADMIN_BLOG_POSTS: "admin-blog-posts",
    FORMS: "forms",
    ADMIN_FORMS: "admin-forms",
    FORM_SUBMISSIONS: "form-submissions",
    FORM_RESULTS: "form-results",
    ADMIN_USERS: "admin-users",
    SETTINGS: "settings",
    INVITATION_CODES: "invitation-codes",
} as const;

export function getBlogPostTag(slug: string) {
    return `blog-post:${slug}`;
}

export function getFormTag(slug: string) {
    return `form:${slug}`;
}
