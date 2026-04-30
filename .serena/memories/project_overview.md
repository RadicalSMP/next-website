# 项目概览
- 项目：RadicalSMP Minecraft 社区网站。
- 技术栈：Next.js 16 App Router、React 19、TypeScript、Tailwind CSS v4、shadcn/ui、better-auth、PostgreSQL、Bun。
- 部署：Vercel；本地主要使用 Bun。
- 结构：`app/(site)` 为公开站点，`app/(admin)/dashboard` 为后台，`app/(api)/api` 为 API 路由，`lib/` 为服务端逻辑与基础设施，`lib/cache/` 为缓存抽象。