# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-10
**Commit:** fb126da
**Branch:** dev

## OVERVIEW

RadicalSMP (根号的离谱服务器) Minecraft 社区网站。Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui + better-auth + PostgreSQL，Bun 运行时，Vercel 部署。

## STRUCTURE

```
next-website/
├── app/
│   ├── (site)/          # 公开页面 — 有 Navbar + Footer 布局
│   ├── (admin)/dashboard/ # 管理后台 — Sidebar 布局，需登录
│   ├── (api)/api/auth/  # better-auth catch-all 路由
│   ├── resource/        # ⚠ 非路由！内容数据桶（org/navbar/famous/dashboard_items）
│   └── globals.css      # Tailwind v4 全局样式
├── components/
│   ├── ui/              # shadcn/ui 生成组件 + 自定义 UI（navbar, footer, theme-toggle）
│   ├── dashboard-sidebar.tsx
│   ├── theme-provider.tsx
│   └── user-avatar.tsx
├── lib/
│   ├── auth.ts          # better-auth 服务端配置（pg Pool, plugins, 自定义字段）
│   ├── auth-client.ts   # better-auth 客户端（signIn/signOut/signUp/useSession）
│   └── utils.ts         # cn() 工具函数
└── hooks/
    └── use-mobile.ts    # 移动端检测 hook
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| 添加公开页面 | `app/(site)/` | 新建目录 + `page.tsx`，自动继承 Navbar/Footer 布局 |
| 添加管理页面 | `app/(admin)/dashboard/` | 需登录，Sidebar 布局 |
| 修改导航栏路由 | `app/resource/content.tsx` → `navbar_routes` | 支持嵌套子菜单 |
| 修改名人堂数据 | `app/resource/content.tsx` → `famous` | |
| 修改 Dashboard 侧边栏 | `app/resource/content.tsx` → `dashboard_items` | |
| 添加 shadcn/ui 组件 | `bunx --bun shadcn@latest add <name>` | 自动放入 `components/ui/` |
| 修改认证逻辑 | `lib/auth.ts`（服务端）/ `lib/auth-client.ts`（客户端） | |
| 添加 API 路由 | `app/(api)/api/` | 当前仅有 auth catch-all |

## ARCHITECTURE DECISIONS

- **三个 Route Group 各自渲染 `<html>`**：`(site)` 和 `(admin)` 各有独立 layout.tsx 含完整 `<html>` 标签。无共享根 layout。添加新 route group 时必须包含完整 HTML 文档结构。
- **`app/resource/` 是数据模块，非路由**：通过 `index.ts` barrel export。所有静态内容（组织信息、路由配置、人员数据）集中于 `content.tsx`。
- **认证**：better-auth + `pg` Pool 直连 PostgreSQL（非 ORM）。支持邮箱密码 + GitHub OAuth。admin 插件已启用。用户扩展字段：`mcid`（Minecraft ID）、`qq`。
- **Dashboard 鉴权**：服务端 `auth.api.getSession()` + `headers()`，未登录重定向 `/sign-in`。

## CONVENTIONS

- **语言**：所有 UI 文本、注释、commit message 使用中文
- **Commit 格式**：`feat(scope): 中文描述`、`fix: ...`、`docs: ...`（Conventional Commits 风格）
- **shadcn/ui 风格**：`new-york` style，`neutral` base color，CSS variables 启用
- **图标库**：shadcn 组件用 `lucide-react`；自定义组件用 `react-icons`（fa/fa6/ri/lu）
- **主题**：`next-themes` ThemeProvider，`defaultTheme="system"`，class 策略
- **路径别名**：`@/*` → 项目根目录（tsconfig paths）
- **包管理**：Bun（`bun install`、`bun run dev`）。Vercel 构建用 `bun run --bun next build`

## ANTI-PATTERNS

- **不要在 `components/ui/` 中混入业务组件**：该目录含 shadcn 生成组件 + 少量全局 UI（navbar/footer/theme-toggle）。业务组件放 `components/` 根目录
- **不要假设有共享根 layout**：每个 route group 独立管理 `<html>`/`<body>`/ThemeProvider
- **不要直接导入 `content.tsx`**：通过 `@/app/resource` barrel import
- **不要用 npm/yarn**：项目使用 Bun

## OPEN TODOs

- `lib/auth.ts:14` — 补全重置密码逻辑（`sendResetPassword` 为空）
- `app/(admin)/dashboard/layout.tsx:22` — 增加 admin role 校验（当前仅检查是否登录）

## ENV VARS

```
DATABASE_URL          # PostgreSQL 连接串
GITHUB_CLIENT_ID      # GitHub OAuth
GITHUB_CLIENT_SECRET  # GitHub OAuth
NEXT_PUBLIC_APP_URL   # better-auth 客户端 baseURL
```

## COMMANDS

```bash
bun install           # 安装依赖
bun run dev           # 本地开发（http://localhost:3000）
bun run build         # 生产构建
bun run start         # 生产模式启动
bun run lint          # ESLint 检查
```

## NOTES

- Next.js **16.1.1** + React **19.2.3** — 使用最新 API，注意兼容性
- 无测试框架配置，无测试文件
- `metadata` 仍为 create-next-app 默认值（"Create Next App"），待更新
- `components/ui/` 中 `footer.tsx`、`navbar.tsx`、`theme-toggle.tsx` 是自定义组件，非 shadcn 生成
