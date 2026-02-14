# 注册登录系统后端架构方案

## 概述

基于已有的 better-auth 配置，完善 RadicalSMP 网站的注册登录系统后端。覆盖 6 个功能模块，使用 Resend 作为邮件服务，better-auth admin 插件管理角色。

## 当前状态

| 模块 | 状态 | 位置 |
|------|------|------|
| 基础注册/登录 API | ✅ 已有 | `app/(api)/api/auth/[...all]/route.ts` |
| better-auth 服务端配置 | ✅ 已有 | `lib/auth.ts` |
| 客户端 auth 导出 | ✅ 已有 | `lib/auth-client.ts` |
| Sign-in 前端 | ✅ 已有（缺错误处理） | `app/(site)/sign-in/page.tsx` |
| Sign-up 前端 | ✅ 已有 | `app/(site)/sign-up/page.tsx` |
| Dashboard 鉴权 | ⚠️ 仅检查登录 | `app/(admin)/dashboard/layout.tsx` |
| 密码重置 | ❌ 回调为空 | `lib/auth.ts:14` |
| 邮件验证 | ❌ 未配置 | - |
| Middleware 路由保护 | ❌ 不存在 | - |
| Rate Limiting | ❌ 未配置 | - |

## 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 邮件服务 | Resend | 现代 API，免费 100 封/天，TypeScript SDK |
| Admin 角色管理 | better-auth admin() 插件 | 已启用，内置 role 字段和权限管理 |
| 路由保护 | Next.js Middleware + Layout Guard | Middleware 做快速 cookie 检查，Layout 做精确 session/role 验证 |
| Rate Limiting | better-auth 内置 rateLimit | 无需额外依赖，支持自定义规则 |

## 新增环境变量

```
RESEND_API_KEY        # Resend 邮件服务 API Key
```

## 新增依赖

```
resend                # 邮件发送 SDK
```

---

## Task 1: 安装依赖 + 创建邮件工具模块

**优先级**: P0（其他任务依赖）
**预计文件变更**: `package.json`, `lib/email.ts`

### 步骤

1. 安装 `resend` 包：`bun add resend`
2. 创建 `lib/email.ts` — 封装 Resend 客户端和邮件发送工具函数

### `lib/email.ts` 设计

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// 发件人地址（Resend 未验证域名时用 onboarding@resend.dev）
const FROM = "RadicalSMP <onboarding@resend.dev>";

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
  userName?: string;
}) {
  // 发送密码重置邮件
  // 使用纯文本 + 简单 HTML，中文内容
}

export async function sendVerificationEmail(params: {
  to: string;
  verifyUrl: string;
  userName?: string;
}) {
  // 发送邮箱验证邮件
  // 使用纯文本 + 简单 HTML，中文内容
}
```

### 验收标准
- [ ] `resend` 已安装到 dependencies
- [ ] `lib/email.ts` 导出 `sendPasswordResetEmail` 和 `sendVerificationEmail`
- [ ] 邮件内容使用中文
- [ ] 使用环境变量 `RESEND_API_KEY`
- [ ] `lsp_diagnostics` 无错误

---

## Task 2: 实现密码重置后端

**优先级**: P0
**依赖**: Task 1
**预计文件变更**: `lib/auth.ts`, `app/(site)/forgot-password/page.tsx`, `app/(site)/reset-password/page.tsx`

### 步骤

1. 更新 `lib/auth.ts` — 填充 `sendResetPassword` 回调，调用 `sendPasswordResetEmail`
2. 创建 `app/(site)/forgot-password/page.tsx` — 输入邮箱，调用 `authClient.forgetPassword()`
3. 创建 `app/(site)/reset-password/page.tsx` — 从 URL 获取 token，输入新密码，调用 `authClient.resetPassword()`

### `lib/auth.ts` 变更

```typescript
emailAndPassword: {
    enabled: true,
    async sendResetPassword({ user, url, token }, request) {
        await sendPasswordResetEmail({
            to: user.email,
            resetUrl: url,
            userName: user.name,
        });
    },
    minPasswordLength: 8,
    maxPasswordLength: 128,
},
```

### `lib/auth-client.ts` 变更

新增导出：
```typescript
export const {
    signIn,
    signOut,
    signUp,
    useSession,
    forgetPassword,   // 新增
    resetPassword,    // 新增
} = authClient;
```

### 前端页面设计

**forgot-password**: 
- 输入邮箱 → 调用 `forgetPassword({ email, redirectTo: "/reset-password" })`
- 成功后显示"已发送重置邮件"提示

**reset-password**:
- 从 URL searchParams 获取 token
- 输入新密码 + 确认密码
- 调用 `resetPassword({ newPassword, token })`
- 成功后跳转到 `/sign-in`

### 验收标准
- [ ] `sendResetPassword` 回调正确调用 Resend 发送邮件
- [ ] forgot-password 页面可提交邮箱
- [ ] reset-password 页面可从 URL 获取 token 并重置密码
- [ ] 重置成功后跳转到登录页
- [ ] 所有 UI 文本使用中文
- [ ] `lsp_diagnostics` 无错误

---

## Task 3: 实现邮件验证

**优先级**: P1
**依赖**: Task 1
**预计文件变更**: `lib/auth.ts`, `lib/auth-client.ts`

### 步骤

1. 更新 `lib/auth.ts` — 添加 `emailVerification` 配置
2. 更新 `lib/auth-client.ts` — 导出 `sendVerificationEmail` 客户端方法（如需要）

### `lib/auth.ts` 变更

```typescript
emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) => {
        await sendVerificationEmail({
            to: user.email,
            verifyUrl: url,
            userName: user.name,
        });
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600, // 1 小时
},
emailAndPassword: {
    // ...existing config
    requireEmailVerification: true,
},
```

### 行为说明
- 注册后自动发送验证邮件（`sendOnSignUp: true`）
- 未验证用户登录时 better-auth 会返回错误
- 验证成功后自动登录（`autoSignInAfterVerification: true`）
- better-auth 内置处理验证链接的 API 端点，无需额外路由
- 验证链接 1 小时过期

### 验收标准
- [ ] 注册后自动发送验证邮件
- [ ] 未验证用户无法登录（better-auth 返回错误提示）
- [ ] 点击验证链接后邮箱标记为已验证
- [ ] 验证后自动登录
- [ ] `lsp_diagnostics` 无错误

---

## Task 4: 创建 Next.js Middleware 路由保护

**优先级**: P0
**依赖**: 无
**预计文件变更**: `middleware.ts`（新建，项目根目录）

### 设计思路

Middleware 做快速 cookie 检查（不验证 session 有效性），Layout Guard 做精确 session/role 验证。两层防护互补：

| 层级 | 职责 | 速度 | 精度 |
|------|------|------|------|
| Middleware | Cookie 存在性检查 + 重定向 | 快（Edge Runtime） | 低（cookie 可能过期） |
| Layout Guard | `auth.api.getSession()` 完整验证 | 慢（数据库查询） | 高 |

### `middleware.ts` 设计

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
    const sessionCookie = getSessionCookie(request);
    const { pathname } = request.nextUrl;

    // 已登录用户访问登录/注册页 → 重定向到首页
    if (sessionCookie && ["/sign-in", "/sign-up"].includes(pathname)) {
        return NextResponse.redirect(new URL("/", request.url));
    }

    // 未登录用户访问受保护路由 → 重定向到登录页
    if (!sessionCookie && pathname.startsWith("/dashboard")) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*", "/sign-in", "/sign-up"],
};
```

### 验收标准
- [ ] `middleware.ts` 位于项目根目录
- [ ] 未登录访问 `/dashboard` → 重定向到 `/sign-in`
- [ ] 已登录访问 `/sign-in` 或 `/sign-up` → 重定向到 `/`
- [ ] 使用 `better-auth/cookies` 的 `getSessionCookie`
- [ ] `matcher` 仅匹配需要保护的路由
- [ ] `lsp_diagnostics` 无错误

---

## Task 5: Dashboard Admin Role 校验

**优先级**: P1
**依赖**: Task 4
**预计文件变更**: `app/(admin)/dashboard/layout.tsx`

### 步骤

更新 `app/(admin)/dashboard/layout.tsx` — 在现有 session 检查后增加 role 校验

### 变更设计

```typescript
// 获取用户的 Session
const session = await auth.api.getSession({
    headers: await headers()
});

// 若未登录 → 跳转到 /sign-in
if (!session) {
    return redirect("/sign-in");
}

// 若 role 并非 admin → 跳转回主页
if (session.user.role !== "admin") {
    return redirect("/");
}
```

### 设计决策
- Middleware 层不做 role 检查（需数据库查询，Edge Runtime 成本高）
- admin 插件自动在 user 表添加 `role` 字段，默认值 `"user"`
- 需手动在数据库中将管理员 role 设为 `"admin"`

### 验收标准
- [ ] 已登录但 role !== "admin" → 重定向到 `/`
- [ ] admin 用户正常访问 dashboard
- [ ] 删除原有 TODO 注释
- [ ] `lsp_diagnostics` 无错误

---

## Task 6: Sign-in 错误处理 + 成功跳转

**优先级**: P1
**依赖**: 无
**预计文件变更**: `app/(site)/sign-in/page.tsx`

### 当前问题
- `signIn.email()` 无 `onError` 回调 → 登录失败无提示
- 无 `onSuccess` 回调 → 登录成功不跳转

### 变更设计

```typescript
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const router = useRouter();

await signIn.email({
    email,
    password,
    rememberMe,
    fetchOptions: {
        onRequest: () => setLoading(true),
        onResponse: () => setLoading(false),
        onError: (ctx) => {
            toast.error(ctx.error.message);
        },
        onSuccess: () => {
            router.push("/");
        },
    },
});
```

### 额外改进
- 引入 `sonner` 的 `toast`（sign-up 页面已使用）
- 引入 `useRouter`
- 在 sign-in 页面添加"忘记密码"链接（指向 `/forgot-password`）

### 验收标准
- [ ] 登录失败显示 toast 错误提示
- [ ] 登录成功跳转到首页
- [ ] 添加"忘记密码"链接
- [ ] 保持现有 loading 状态逻辑
- [ ] `lsp_diagnostics` 无错误

---

## Task 7: Rate Limiting 配置

**优先级**: P2
**依赖**: 无
**预计文件变更**: `lib/auth.ts`

### 设计

使用 better-auth 内置 `rateLimit`，无需额外依赖。

```typescript
rateLimit: {
    enabled: true,
    window: 60,       // 60 秒窗口
    max: 10,          // 每窗口最多 10 次请求（全局）
    customRules: {
        "/api/auth/sign-in/email": {
            window: 60,
            max: 5,    // 登录：60秒内最多 5 次
        },
        "/api/auth/sign-up/email": {
            window: 60,
            max: 3,    // 注册：60秒内最多 3 次
        },
        "/api/auth/forget-password": {
            window: 300,
            max: 3,    // 密码重置：5分钟内最多 3 次
        },
    },
    storage: "memory",
},
```

### 设计决策
- `storage: "memory"`：Vercel Serverless 实例间不共享，小型社区网站足够
- 如需严格限制可改为 `"database"` 使用 PostgreSQL 持久化

### 验收标准
- [ ] `rateLimit` 配置添加到 `lib/auth.ts`
- [ ] 全局限制 + 自定义规则（sign-in, sign-up, forget-password）
- [ ] `lsp_diagnostics` 无错误

---

## 执行顺序

```
Wave 1（无依赖，可并行）:
├── Task 1: 安装 Resend + 创建邮件工具模块
├── Task 4: 创建 Next.js Middleware
├── Task 6: Sign-in 错误处理 + 成功跳转
└── Task 7: Rate Limiting 配置

Wave 2（依赖 Task 1）:
├── Task 2: 密码重置后端 + 前端页面
└── Task 3: 邮件验证配置

Wave 3（依赖 Task 4）:
└── Task 5: Dashboard Admin Role 校验
```

## 文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `lib/email.ts` | Resend 邮件工具模块 |
| `middleware.ts` | Next.js Middleware 路由保护 |
| `app/(site)/forgot-password/page.tsx` | 忘记密码页面 |
| `app/(site)/reset-password/page.tsx` | 重置密码页面 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `lib/auth.ts` | 填充 sendResetPassword、添加 emailVerification、添加 rateLimit |
| `lib/auth-client.ts` | 新增导出 forgetPassword、resetPassword |
| `app/(site)/sign-in/page.tsx` | 添加错误处理 + 成功跳转 + 忘记密码链接 |
| `app/(admin)/dashboard/layout.tsx` | 添加 admin role 校验 |
| `package.json` | 新增 resend 依赖 |

## 边界情况处理

| 场景 | 处理方式 |
|------|----------|
| 已登录用户访问 /sign-in | Middleware 重定向到 / |
| 未验证邮箱用户登录 | better-auth 返回错误，前端 toast 显示 |
| 密码重置 token 过期 | better-auth 返回错误，前端显示提示 |
| 非 admin 访问 /dashboard | Layout Guard 重定向到 / |
| Rate limit 触发 | better-auth 返回 429，前端 toast 显示 |
| 现有用户无 role 字段 | admin 插件默认 role="user" |

## 不在范围内

- 用户管理 CRUD UI
- 新增 OAuth provider
- 邮件模板设计系统
- 2FA/MFA
- 用户个人资料编辑页面
