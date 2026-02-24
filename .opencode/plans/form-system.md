# 通用表单系统实施计划

## 需求概要

- **第一实例**：玩家入服申请表（Minecraft ID、QQ 号、自我介绍、游戏经验、如何知道本服务器）
- **目标架构**：通用表单构建器——管理员可自定义字段，前台动态渲染
- **权限分级**：表单可设为 public / authenticated / members（指定用户）
- **数据存储**：PostgreSQL
- **审核流程**：管理员通过/拒绝 + 审核后邮件通知提交者

---

## 数据库设计（2 张表）

### `forms` — 表单定义表

```sql
CREATE TABLE IF NOT EXISTS "forms" (
    "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "title"             TEXT NOT NULL,
    "description"       TEXT,
    "slug"              VARCHAR(64) UNIQUE NOT NULL,
    "fields"            JSONB NOT NULL DEFAULT '[]',
    "visibility"        TEXT NOT NULL DEFAULT 'public',
    "allowed_user_ids"  TEXT[] DEFAULT '{}',
    "status"            TEXT NOT NULL DEFAULT 'active',
    "created_by"        TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**fields JSONB 结构：**
```json
[
  { "key": "mcid", "label": "Minecraft ID", "type": "text", "required": true, "placeholder": "你的游戏 ID" },
  { "key": "qq", "label": "QQ 号", "type": "text", "required": true },
  { "key": "intro", "label": "自我介绍", "type": "textarea", "required": true },
  { "key": "experience", "label": "游戏经验", "type": "textarea", "required": false },
  { "key": "source", "label": "如何知道本服务器", "type": "text", "required": true }
]
```

支持字段类型：`text` / `textarea` / `select` / `checkbox` / `number`

### `form_submissions` — 提交记录表

```sql
CREATE TABLE IF NOT EXISTS "form_submissions" (
    "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "form_id"       UUID NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
    "user_id"       TEXT REFERENCES "user"("id") ON DELETE SET NULL,
    "user_email"    TEXT,
    "data"          JSONB NOT NULL DEFAULT '{}',
    "status"        TEXT NOT NULL DEFAULT 'pending',
    "review_note"   TEXT,
    "reviewed_by"   TEXT REFERENCES "user"("id") ON DELETE SET NULL,
    "reviewed_at"   TIMESTAMPTZ,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 索引

```sql
CREATE INDEX IF NOT EXISTS "idx_forms_slug" ON "forms"("slug");
CREATE INDEX IF NOT EXISTS "idx_forms_status" ON "forms"("status");
CREATE INDEX IF NOT EXISTS "idx_form_submissions_form_id" ON "form_submissions"("form_id");
CREATE INDEX IF NOT EXISTS "idx_form_submissions_status" ON "form_submissions"("form_id", "status");
```

---

## 文件清单

| # | 文件路径 | 类型 | 说明 |
|---|---------|------|------|
| 1 | `scripts/migrate-forms.ts` | 迁移脚本 | 创建 forms + form_submissions 表 |
| 2 | `lib/form-cache.ts` | 缓存层 | unstable_cache + revalidateTag |
| 3 | `app/(api)/api/forms/route.ts` | API | GET 列表 / POST 创建（admin） |
| 4 | `app/(api)/api/forms/[id]/route.ts` | API | GET/PUT/DELETE 单个表单（admin） |
| 5 | `app/(api)/api/forms/[id]/submissions/route.ts` | API | GET 提交列表（admin） / POST 提交表单 |
| 6 | `app/(api)/api/forms/[id]/submissions/[subId]/route.ts` | API | PUT 审核 + 邮件通知 |
| 7 | `app/(api)/api/forms/by-slug/[slug]/route.ts` | API | GET 按 slug 查表单（前端用） |
| 8 | `app/(site)/forms/page.tsx` | 前端页面 | 表单列表 |
| 9 | `app/(site)/forms/[slug]/page.tsx` | 前端页面 | 动态表单填写 |
| 10 | `app/(admin)/dashboard/forms/page.tsx` | 管理页面 | 表单管理列表 |
| 11 | `app/(admin)/dashboard/forms/new/page.tsx` | 管理页面 | 表单构建器（创建） |
| 12 | `app/(admin)/dashboard/forms/[id]/edit/page.tsx` | 管理页面 | 表单构建器（编辑） |
| 13 | `app/(admin)/dashboard/forms/[id]/submissions/page.tsx` | 管理页面 | 提交审核 |
| 14 | `lib/email.ts` | 修改 | 新增 sendFormReviewEmail() |
| 15 | `app/resource/content.ts` | 修改 | dashboard_items + navbar_routes 新增入口 |
| 16 | `scripts/seed-join-form.ts` | 种子脚本 | 创建预设的入服申请表 |

---

## 实施顺序

1. 安装 shadcn 组件（textarea, select）✅ 已完成
2. 数据库迁移脚本
3. 缓存层
4. API 路由（6 个文件）
5. 邮件通知函数
6. 管理后台页面（4 个文件）
7. 前端页面（2 个文件）
8. 导航入口更新
9. 入服申请表种子脚本

---

## 代码约定（摘自项目分析）

- 所有 UI 文本用中文
- 客户端组件使用 `"use client"` 
- toast 通知用 `sonner`
- 加载状态用 `<Loader2 className="animate-spin" />`
- 表单用 useState + 手动管理（不用 react-hook-form）
- API 鉴权用 `auth.api.getSession({ headers: await headers() })`
- 图标用 `lucide-react`（shadcn 组件内）或 `react-icons`（导航/dashboard）
- 路径别名 `@/*`
- 包管理用 Bun
