# Draft: 注册登录系统后端架构

## Requirements (confirmed)
- 基于已有的 better-auth 配置完善后端认证系统
- 前端 sign-in / sign-up 页面已实现
- 需要符合 Next.js 后端规范

## Current State (from codebase analysis)
- better-auth catch-all route 已处理基础注册/登录 API
- `lib/auth.ts`: pg Pool 直连 PostgreSQL, emailAndPassword + GitHub OAuth + admin plugin
- `lib/auth-client.ts`: signIn, signOut, signUp, useSession 已导出
- `sendResetPassword` 回调为空 → 密码重置不可用
- Dashboard layout 仅检查是否登录，未校验 admin role
- Sign-in 页面无错误处理、无登录成功跳转
- 无 Next.js middleware 路由保护
- 无邮件验证流程

## Technical Decisions
- (pending) 是否需要密码重置功能？
- (pending) 是否需要邮件验证？
- (pending) 是否需要 Next.js middleware 路由保护？
- (pending) Dashboard admin role 校验方式？
- (pending) 前端错误处理改进范围？

## Research Findings
- better-auth 的 `sendResetPassword` 接收 `{ user, url, token }` 参数
- better-auth 支持 `requireEmailVerification` 配置
- better-auth 提供 `getSessionCookie()` 用于 middleware
- admin plugin 提供 role-based access control

## Open Questions
- (resolved) 密码重置 → YES, 用 Resend
- (resolved) 邮件验证 → YES, 用 Resend
- (resolved) 路由保护 → Next.js Middleware
- (resolved) Admin role → better-auth admin 插件
- (resolved) Sign-in 改进 → 错误处理 + 成功跳转
- (resolved) Rate Limiting → YES
- (pending) 测试策略 → 待确认

## Scope Boundaries
- INCLUDE: 密码重置流程, 邮件验证, Next.js Middleware, Dashboard admin role 校验, Sign-in 错误处理+跳转, Rate Limiting
- EXCLUDE: 前端页面大改版, 新增 OAuth provider, 用户管理 CRUD UI

## User Decisions
- 邮件服务: Resend (现代 API, 免费 100封/天)
- Admin 管理: better-auth admin() 插件内置 role
- 全部6个功能模块都要覆盖
