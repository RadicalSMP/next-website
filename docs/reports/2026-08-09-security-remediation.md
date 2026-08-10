# 2026-08-09 安全修复报告

## 基线与范围

- 执行日期：2026-08-10（计划日期与报告文件名沿用 2026-08-09）。
- 分支：`fix/security-remediation-20260809`。
- 基线：`dev@454d967540775bb32d9ae0deca22f3d64b620ace`。
- 实现提交：`1c93f27 fix(security): 加固内容认证与请求边界`。
- 未执行：合并、远程推送、生产部署、生产或共享数据库迁移。

## 修复证据

### 博客内容与响应策略

- `lib/security/html.ts` 使用 `sanitize-html` 建立 Tiptap 白名单，保留标题、列表、引用、链接、图片、代码块和 lowlight class。
- 博客创建、更新时清洗；公开历史文章和后台编辑读取时再次清洗，覆盖存量恶意内容。
- 清洗会移除脚本、事件属性、危险协议和 `data:` 图片，并为链接固定 `rel="noopener noreferrer"`。
- `next.config.ts` 增加执行型 CSP、HSTS、`nosniff`、拒绝嵌套、Referrer Policy、COOP 和 Permissions Policy；CSP 显式允许配置的 CAP 来源及 Blob Worker。

### 邀请码与认证

- `scripts/migrate-security.ts` 幂等创建 `invitation_code_reservation` 和 better-auth `rateLimit` 表，不删除或改写既有业务数据。
- `lib/invitation-reservations.ts` 在邀请码行锁事务内清理过期预留、检查使用量和有效预留量，并创建 10 分钟预留。
- 注册业务失败时释放预留；注册成功后在事务中写使用记录、递增计数并删除预留；最终化失败时补偿删除刚创建的未完成账户。
- better-auth 限流由内存存储改为数据库存储；邀请码生成改用 `crypto.randomInt`。
- Next.js 从 `16.1.1` 升至 `16.2.11`，better-auth 从 `1.4.18` 升至 `1.6.22`，消除审计中直接依赖的 Proxy 绕过、OAuth 账户接管和 critical 认证告警。

### 请求来源与输入边界

- `lib/security/request.ts` 提供精确同源校验；`proxy.ts` 对全部 `/api/*` 自定义写请求统一执行，缺失或不匹配 `Origin` 均返回中文 `403`。
- 明确例外仅为 better-auth 自有路由和只读邮件访问链接兑换；敏感 Route Handler 原有服务端会话/管理员鉴权仍保留。
- 表单发布拒绝超长、无效或高风险正则，并限制字段、选项及校验规则规模。
- 表单提交执行数字 `min/max`、字符串与多选 `minLength/maxLength`、`pattern`，并校验 email、QQ、MCID、日期、布尔值和选项类型。
- 校验失败增加 `fieldKey` 和稳定 `code`，原有中文 `error` 字段保持兼容。
- 指纹限制为 256 字符，填写时长限制为 7 天；CAP token 限制为 4096 字符。
- 注册头像限制为不超过 2 MB 的 JPEG、PNG、WebP Data URL，并核对文件签名。

### 邮件与系统设置

- 验证邮件、密码重置邮件的姓名和 URL 均经过 HTML 转义，并拆出可单元测试的模板构建函数。
- 设置 API 只接受 `ai.api_key`、`ai.base_url`、`ai.model` 三个精确键。
- `ai.api_key` 的加密策略完全由服务端决定；客户端 `encrypted` 标志不能关闭加密。
- Base URL 限制长度、协议和认证信息；模型名和各设置值均限制格式与长度。
- `.env.example` 已补齐加密、OpenAI 回退、种子用户和隔离测试数据库配置。

## 数据库迁移

部署顺序必须是“备份与隔离验证 -> 执行安全迁移 -> 发布应用”。新应用在认证限流和注册时依赖新表，不能先发布应用。

隔离环境验证命令：

```bash
DATABASE_URL=<隔离数据库连接串> bun run migrate:security
TEST_DATABASE_URL=<隔离数据库连接串> bun test tests/security/invitation-database.test.ts
```

迁移脚本本轮未执行，因为环境没有提供 `TEST_DATABASE_URL`，且禁止将未知的 `DATABASE_URL` 当作测试数据库。

回滚顺序：

1. 先回滚应用提交，恢复内存限流和旧邀请码注册逻辑。
2. 确认没有旧应用实例依赖新表。
3. 如需回收新增基础设施，再执行：

```sql
DROP TABLE IF EXISTS invitation_code_reservation;
DROP TABLE IF EXISTS "rateLimit";
```

删除表会丢失尚未完成的邀请码预留和限流计数；通常可保留两张空闲表，不必为代码回滚立即删除。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| `bunx tsc --noEmit` | 通过 |
| `bun test` | 17 通过，1 跳过，0 失败；跳过项为未配置隔离数据库 |
| `bun run lint` | 通过，0 错误，0 警告 |
| `bun run build` | Next.js 16.2.11 生产构建通过，44 个页面生成成功 |
| HTTP 响应头 | 首页 200，CSP/HSTS/nosniff/X-Frame-Options 均存在 |
| 同源拒绝 | 缺失 Origin 和跨站 Origin 的 `POST /api/forms` 均返回中文 403 |
| `bun audit` | 完成；直接 Next/better-auth 告警已清除，仍有 45 条传递性告警 |

生产构建首次在 21 个静态生成 Worker 并发阶段发生一次 Windows 原生进程退出（`3221226505`）；未改代码原样重试后完整通过，判断为瞬时本机 Worker 故障。

## 未验证的外部集成

- 未连接隔离 PostgreSQL，因此邀请码并发预留、失败释放、单次消费和 better-auth 数据库限流测试已编写但未执行。
- 未发送 Resend 邮件，未执行 GitHub OAuth 回调，未向 CAP 服务提交真实令牌。
- 未执行 Vercel 预览或生产部署，也未验证生产代理链传递的 Host/Origin 行为。

## 残余风险

- 依赖审计仍报告 45 条传递性告警：29 high、14 moderate、2 low，涉及 18 个包。主要位于 shadcn/ESLint 构建链、Tiptap Markdown 转换链，以及上游尚未提供兼容修复的 `defu`、`sharp`；本轮没有使用强制 override 或无关全量升级。
- CSP 为兼容 Next.js 当前内联引导脚本保留 `'unsafe-inline'`。它是主动执行的限制策略，但强度低于逐请求 nonce/strict-dynamic 方案。
- 进程或数据库在普通业务错误之外异常中断时，邀请码预留可能保留至 10 分钟超时；不会永久消耗邀请码次数。
- 新迁移必须在应用发布前完成；遗漏迁移会使认证限流或邮箱注册请求失败。
- 数据库集成验证是合并前的必要门槛，应在专用 PostgreSQL 实例提供 `TEST_DATABASE_URL` 后补跑。
