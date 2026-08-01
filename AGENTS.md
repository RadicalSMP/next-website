# RadicalSMP 项目协作指南

本文档是 `根号的离谱服务器（RadicalSMP）` 官网的仓库级知识库，也是开发者和编码代理修改项目时的执行约束。开始工作前先阅读本文件；代码事实与本文冲突时，以当前代码为准，并在同一变更中更新本文。

## 项目概览

- 产品定位：Minecraft SMP 社区官网与内部管理平台。
- 核心目标：承载社区介绍、博客内容、入服及其他动态表单、成员账户和后台管理流程。
- 当前审阅基线：2026-07-15，分支 `refactor/form`，提交 `82a015d`。
- 部署方式：Next.js 应用部署到 Vercel，PostgreSQL 由外部服务提供。
- 当前阶段：主要业务闭环已经存在，但首页文案、站点元数据、测试和部分数据库基础设施仍需完善。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 运行时与包管理 | Bun，仓库锁文件为 `bun.lock` |
| Web 框架 | Next.js 16.1.1 App Router，启用 Cache Components |
| UI | React 19.2.3、TypeScript 5、Tailwind CSS v4、shadcn/ui |
| 编辑器 | Tiptap 3 + lowlight |
| 身份认证 | better-auth 1.4，邮箱密码、GitHub OAuth、admin 插件 |
| 数据库 | PostgreSQL，通过 `pg` 和参数化 SQL 直连，无 ORM |
| 邮件 | Resend |
| AI 配置 | OpenAI SDK；当前只完成配置读取和客户端封装，尚无业务调用 |
| 部署 | Vercel |

TypeScript 开启 `strict` 和 `noEmit`，路径别名 `@/*` 指向项目根目录。

## 当前功能

### 公开站点

- `/`：服务器品牌、社区特性、加入流程、近期事项和社区入口。
- `/about`：服务器理念和组织信息。
- `/blogs`、`/blogs/[slug]`：已发布博客列表、文章详情、文章元数据和目录导航。
- `/forms`、`/forms/[slug]`：已发布表单列表与填写页。
- `/tools/famous`：社区“冥人唐”成员展示。
- 全站导航栏、页脚、登录入口、用户头像、明暗主题和 Toast 提示。

公开页面通过 `app/(site)/layout.tsx` 统一获得 Navbar、Footer 和 ThemeProvider。

### 账户与认证

- 邮箱密码注册和登录。
- 注册必须提供邀请码；支持使用次数、过期时间和邮箱白名单校验。
- 注册后发送邮箱验证邮件，验证成功后自动登录。
- GitHub OAuth 登录。
- 忘记密码、重置密码和重新发送验证邮件。
- 登录、注册和密码找回接口具备 better-auth 速率限制。
- 用户扩展字段为 `mcid: string[]` 和 `qq: string[]`，当前不允许通过注册请求直接写入。

`proxy.ts` 只根据会话 Cookie 做页面级快速跳转，不是最终授权边界。后台布局和所有敏感 API 必须再次读取服务端会话并检查 `role === "admin"`。

### 博客

- 公开读取已发布文章。
- 管理员创建、编辑、删除、发布文章或转为草稿。
- Tiptap 富文本编辑器支持标题、列表、引用、链接、图片、代码块等内容。
- 文章支持摘要、封面图、作者和发布时间。
- 公开文章与后台列表使用统一缓存标签，并在写操作后失效。

### 动态表单与结果中心

- 管理员创建、编辑、预览、发布、归档和删除表单。
- 草稿和发布版本分离；发布会生成只读版本快照，公开填写始终读取当前发布版本。
- 支持 `public`、`authenticated`、`members` 三种可见性；成员表单可指定用户 ID 白名单。
- 字段类型包括文本、多行文本、数字、单选、多选、下拉、开关、日期、邮箱、QQ 和 Minecraft ID。
- 字段支持必填、启停、占位提示、帮助文本、默认值、选项和校验规则。
- 提交时执行服务端字段校验，并保存字段快照、表单版本、账户、IP、User-Agent、指纹和填写时长。
- 结果中心支持跨表单查询、筛选、分页、统计和 CSV 导出。
- 支持客观题自动批改、主观题人工批改、总分统计和批改状态。
- 支持待处理、通过、拒绝、需补充等处理状态，并记录操作备注。
- 支持入服申请、成绩和通用结果邮件模板；收件人可来自字段映射或账户邮箱。
- 提交、批改、处理和通知操作均写入事件历史。

### 管理后台

- `/dashboard`：管理员快捷入口。
- `/dashboard/user/manage`：用户搜索、分页、角色变更、封禁、解封和删除。
- `/dashboard/invitation-code`：邀请码生成、限制、使用记录和删除。
- `/dashboard/blog/*`：博客列表、新建和编辑。
- `/dashboard/forms/*`：表单管理、独立编辑器、预览、结果列表和结果详情。
- `/dashboard/settings`：AI API Key、Base URL 和模型配置；敏感值加密存储并脱敏展示。

后台和表单编辑器都执行登录与管理员角色校验。普通用户不能进入管理页面。

## 架构与目录

```text
next-website/
├── app/
│   ├── (site)/                    # 公开页面，Navbar + Footer
│   ├── (auth)/                    # 登录、注册、验证、密码找回
│   ├── (admin)/dashboard/         # 管理后台，Sidebar 布局
│   ├── (form-editor)/dashboard/   # 沉浸式表单编辑与预览布局
│   ├── (api)/api/                 # Route Handlers
│   ├── resource/content.ts        # 组织、导航、冥人唐、后台菜单静态内容
│   └── globals.css                # Tailwind v4 主题变量与全局样式
├── components/
│   ├── ui/                        # shadcn/ui 基础组件
│   ├── forms/editor/              # 表单编辑器
│   ├── forms/results/             # 结果列表与详情
│   └── *.tsx                      # 跨页面或业务组件
├── lib/
│   ├── auth.ts                    # better-auth 服务端配置
│   ├── auth-client.ts             # better-auth 客户端封装
│   ├── db.ts                      # pg Pool 单例
│   ├── forms.ts                   # 表单模型、规范化、校验和评分纯逻辑
│   ├── cache/                     # 查询缓存与失效函数
│   ├── settings.ts / crypto.ts    # 系统设置和 AES-256-GCM 加密
│   ├── email.ts                   # Resend 邮件模板
│   └── openai.ts                  # OpenAI 配置与客户端工厂
├── scripts/                       # 数据库迁移与开发种子脚本
├── docs/requirements/             # 需求记录
├── docs/plans/                    # 实施计划
├── proxy.ts                       # 页面访问的 Cookie 快速判断
└── next.config.ts                 # Cache Components 与远程图片域名
```

### Route Group 约束

项目没有共享的根 `app/layout.tsx`。以下四个 UI Route Group 各自输出完整的 `<html>` 和 `<body>`：

- `app/(site)/layout.tsx`
- `app/(auth)/layout.tsx`
- `app/(admin)/dashboard/layout.tsx`
- `app/(form-editor)/dashboard/forms/layout.tsx`

新增 UI Route Group 时必须提供完整根布局，并显式引入 `app/globals.css`、主题 Provider 和该场景所需的全局组件。API Route Group 不需要 UI layout。

## 数据与缓存

### 主要数据表

- better-auth 管理：`user`、`session`、`account`、`verification` 等认证表。
- 邀请码：`invitation_code`、`invitation_code_usage`。
- 博客：`blog_posts`。
- 表单：`forms`、`form_versions`、`form_submissions`、`submission_grades`、`submission_events`。
- 系统设置：`system_settings`，代码依赖该表，但仓库当前没有对应迁移脚本。

### 数据访问规则

- 统一从 `@/lib/db` 导入共享 `pool`；不要在业务模块重复创建连接池。`lib/auth.ts` 因 better-auth 配置目前保留独立 Pool。
- 所有外部输入必须使用 PostgreSQL 参数占位符，不得拼接进 SQL。
- 多表写入、批改、处理等需要原子性的操作必须使用事务，并在 `finally` 中释放连接。
- 新增或调整表结构时同步维护 `scripts/` 下的迁移脚本和本文档。
- `scripts/migrate-forms.ts` 会删除并重建全部表单相关表，是破坏性脚本；没有明确授权和备份时不得在共享或生产数据库执行。

### 缓存规则

- `next.config.ts` 已设置 `cacheComponents: true`。
- 公开博客和表单读取在 `lib/cache/` 中使用 `"use cache"`、`cacheTag` 和 `cacheLife`。
- 后台分页查询继续使用 `unstable_cache`。
- 所有写接口必须调用对应的失效函数：
  - 博客：`invalidateBlogCache`
  - 表单配置：`invalidateFormCache`
  - 提交、批改、处理、通知：`invalidateSubmissionCache`
  - 用户：`invalidateUserCache`，删除用户时还需失效关联内容
  - 邀请码：`invalidateInvitationCodeCache`
  - 系统设置：`invalidateSettingsCache`
- 缓存 API 统一从 `@/lib/cache` 导入，不要绕过 `index.ts`。
- 当前关键缓存均通过 `{ expire: 0 }` 立即失效。`lib/cache/README.md` 中关于 `profile="max"`、`invalidateAllCache` 和 `invalidateCacheTags` 的描述已与实现不一致，不要照搬。

## 常见修改入口

| 任务 | 主要位置 | 注意事项 |
| --- | --- | --- |
| 修改首页、关于页或公开页面 | `app/(site)/` | 自动继承公开站点布局 |
| 修改组织资料、导航、冥人唐、后台菜单 | `app/resource/content.ts` | 当前直接从 `@/app/resource/content` 导入，无 barrel 文件 |
| 修改登录注册 | `app/(auth)/`、`lib/auth.ts`、`lib/auth-client.ts` | 同时检查邮件验证、邀请码和速率限制 |
| 修改后台权限 | 后台 layout、表单编辑器 layout、各 API 的 `requireAdmin` | 页面保护不能替代 API 授权 |
| 修改博客 | `app/(site)/blogs/`、`app/(admin)/dashboard/blog/`、`components/blog-editor.tsx`、`app/(api)/api/blog/` | 写入后失效博客缓存 |
| 修改表单模型或校验 | `lib/forms.ts` | 客户端编辑器和服务端提交必须复用同一模型 |
| 修改表单编辑器 | `components/forms/editor/` | 页面壳位于 `app/(form-editor)/` |
| 修改结果中心 | `components/forms/results/`、`app/(admin)/dashboard/forms/`、结果 API | 更新提交、评分、事件时使用事务 |
| 修改缓存 | `lib/cache/` | 同步维护标签、key、查询和失效路径 |
| 修改系统设置或 AI 配置 | `lib/settings.ts`、`lib/crypto.ts`、`lib/openai.ts`、`app/(api)/api/settings/` | API Key 必须加密，不得返回明文 |
| 添加 shadcn/ui 组件 | `bunx --bun shadcn@latest add <name>` | 生成到 `components/ui/` |

## 编码规范

### 语言与命名

- UI 文案、业务错误、代码注释、技术文档和提交说明使用中文。
- 框架 API、协议字段和既有数据字段保留其英文名称，不做无意义翻译。
- React 组件和类型使用 PascalCase；函数、变量和文件沿用现有 camelCase/kebab-case 习惯。
- 提交信息使用 Conventional Commits，例如 `feat(forms): 增加表单发布校验`、`fix(auth): 修复验证邮件重发`。

### React 与 Next.js

- 默认使用 Server Component；只有状态、事件、浏览器 API 或客户端 Hook 确有需要时才添加 `"use client"`。
- 保持服务端数据获取靠近页面或 `lib/cache/`，不要把数据库访问搬到客户端。
- Next.js 16 动态路由的 `params` 按 Promise 处理，例如 `await params`。
- 依赖请求时数据的异步内容放入合适的 `<Suspense>` 边界。
- 使用 `next/image`、`next/link` 和 App Router API，不引入 Pages Router 模式。
- 可交互控件必须有可辨识文本或 `aria-label`，并保留键盘操作能力。

### 组件与样式

- `components/ui/` 只放 shadcn/ui 基础组件；业务组件放 `components/` 或对应业务子目录。
- shadcn 配置为 `new-york`、`neutral`、CSS variables、`lucide` 图标。
- 样式使用 Tailwind CSS v4 和 `app/globals.css` 中的语义变量，兼容亮色与暗色主题。
- 合并 className 使用 `cn()`；避免新增与现有设计系统重复的全局 CSS。
- 图标优先使用 `lucide-react`；已有静态内容和少数组件使用 `react-icons`，修改时保持局部一致。

### API、安全与错误处理

- 敏感 Route Handler 先做服务端会话和管理员角色检查，再读取或修改数据。
- 对请求体、查询参数、slug、分页和枚举值做显式校验，并返回中文 JSON 错误。
- 不信任客户端传入的用户 ID、角色、分数、发布状态或表单版本。
- 密钥不得写入代码、日志、文档或客户端响应；系统设置中的敏感值使用 `ENCRYPTION_KEY` 加密。
- 新增认证入口时评估 better-auth 的速率限制；内存限流在多实例部署下不是全局限流。
- 邮件模板中的用户内容必须 HTML 转义。

## 环境变量

| 变量 | 用途 | 必需性 |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串 | 必需 |
| `BETTER_AUTH_SECRET` | better-auth 签名密钥 | 生产必需 |
| `BETTER_AUTH_BASE_URL` | better-auth 服务端地址 | 部署时必需 |
| `NEXT_PUBLIC_APP_URL` | 客户端认证 Base URL | 必需 |
| `GITHUB_CLIENT_ID` | GitHub OAuth | 启用 GitHub 登录时必需 |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth | 启用 GitHub 登录时必需 |
| `RESEND_API_KEY` | 验证、重置和结果通知邮件 | 邮件功能必需 |
| `CAP_API_URL` | CAP 服务端令牌校验地址 | 可选，缺省为 `https://cap.hami.im/` |
| `NEXT_PUBLIC_CAP_API_URL` | CAP 浏览器组件和挑战接口地址 | 可选，缺省为 `https://cap.hami.im/` |
| `ENCRYPTION_KEY` | 64 位 hex 的 AES-256-GCM 密钥 | 保存加密系统设置时必需 |
| `OPENAI_API_KEY` | AI Key 的环境变量回退 | 可选 |
| `OPENAI_BASE_URL` | OpenAI 兼容 API 地址 | 可选 |
| `OPENAI_MODEL` | 默认模型，缺省为 `gpt-4o-mini` | 可选 |
| `ADMIN_USER_ID` | 入服表单种子脚本指定创建者 | 可选 |

`.env.example` 当前尚未列出 `ENCRYPTION_KEY`、OpenAI 回退变量和 `ADMIN_USER_ID`。新增环境依赖时必须同步更新 `.env.example`，但不得填写真实密钥。

## 常用命令

```bash
bun install
bun run dev
bun run lint
bun run build
bun run start
```

数据库和开发数据命令：

```bash
bun run seed
bun run migrate:blog
bun run migrate:forms
bun run seed:join-form
bun run scripts/migrate-invitation-code.ts
```

只使用 Bun 管理依赖和锁文件，不要运行 `npm install`、`yarn` 或 `pnpm`。个别 package script 内部调用 Node 是仓库既有实现，不等于切换包管理器。

## 变更与验证流程

1. 先检查 `git status --short`，保留用户已有改动，不覆盖无关文件。
2. 阅读目标页面、组件、API、数据模型和缓存失效路径，确认完整调用链。
3. 优先小范围修改，复用现有类型、校验函数、UI 组件和缓存入口。
4. 修改数据库写路径时核对权限、参数化 SQL、事务和缓存失效。
5. 至少运行 `bun run lint` 和 `bun run build`；涉及数据库或外部服务时说明未验证的集成边界。
6. 仓库目前没有测试框架和 `test` 脚本。新增复杂纯逻辑时应补测试基础设施，不能用“构建通过”代替业务验证。

## 已知缺口与风险

- `app/(site)/layout.tsx` 的 metadata 仍为 `Create Next App` 默认值，需要替换为 RadicalSMP 品牌信息。
- 首页多处明确标注为占位内容，“冥人唐”仍有成员资料待填写。
- 仓库没有自动化测试、测试脚本和 CI 验证配置。
- `system_settings` 被设置模块依赖，但仓库没有建表迁移脚本。
- `.env.example` 未覆盖代码实际使用的全部环境变量。
- `lib/cache/README.md` 的部分缓存策略和示例 API 已经过时。
- `lib/auth.ts` 与 `lib/db.ts` 各自持有一个 PostgreSQL Pool，需要关注 Serverless 连接数。
- Resend 发件人地址目前硬编码为 `botamidragen@hami.su`，更换正式域名后需更新。
- `proxy.ts` 只检查 Cookie 是否存在，不能单独承担鉴权或角色授权。
- 表单迁移脚本会破坏现有表单数据，执行前必须确认环境和备份。
