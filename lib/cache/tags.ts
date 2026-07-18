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

export function getFormSubmissionTag(submissionId: string) {
    return `form-submission:${submissionId}`;
}

export function getUserFormSubmissionsTag(userId: string) {
    return `user-form-submissions:${userId}`;
}

export function getFormResultRevisionsTag(submissionId: string) {
    return `form-result-revisions:${submissionId}`;
}
