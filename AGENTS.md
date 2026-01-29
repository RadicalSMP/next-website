# Repository Guidelines

## Project Structure & Module Organization
- `app/`：Next.js App Router 页面与布局。
- `components/`：通用 UI 组件（含 shadcn/ui 生成组件）。
- `hooks/`：自定义 React Hooks。
- `lib/`：工具方法、业务逻辑与数据访问。
- `public/`：静态资源（图片、图标等）。
- 配置文件：`next.config.ts`、`tsconfig.json`、`eslint.config.mjs`、`postcss.config.mjs`、`components.json`、`vercel.json`。

## Build, Test, and Development Commands
使用 Bun 作为包管理与运行时：

```bash
bun install      # 安装依赖
bun run dev      # 启动本地开发服务
bun run build    # 生产构建
bun run start    # 以生产模式启动（需先 build）
bun run lint     # 运行 ESLint
```

## Coding Style & Naming Conventions
- 语言与框架：TypeScript + React（Next.js）。
- 风格与校验：遵循 `eslint-config-next`，保持现有代码风格与排版；避免与现有风格冲突的格式化改动。
- 命名建议：组件用 PascalCase，Hooks 用 `useXxx`，工具函数用 camelCase；文件与目录名沿用现有结构与命名习惯。

## Testing Guidelines
当前仓库未配置专用测试框架与测试命令（未看到 `tests/` 或 `__tests__/` 目录）。如需新增测试，建议：
- 测试文件命名为 `*.test.ts` / `*.test.tsx`；
- 与被测模块同目录或集中放在 `__tests__/`；
- 同步补充 `package.json` 的测试脚本。

## Commit & Pull Request Guidelines
- 提交信息遵循类似 Conventional Commits 的风格：`feat: ...`、`feat(api): ...`、`fix: ...`。
- PR 需包含：变更概述、影响范围、关联 Issue（如有）、UI 变更截图或动图、已执行的命令（如 `bun run lint`）。

## Security & Configuration Tips
- 配置与密钥使用 `.env.local` 等本地环境文件，不提交敏感信息。
- 与 Supabase/PostgreSQL 相关的连接信息需通过环境变量注入并在部署环境中配置。
