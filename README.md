# Next Website

这是 **根号的离谱服务器**网站 的仓库。

## 技术栈

### 前端

- **Bun** 包管理器 & Js运行时
- **Next.js**
- **Typescript**
- **TailwindCSS**
- **shadcn/ui**

### 后端

- **uv** 包管理器 & 虚拟环境管理
- **Python**
- **Fastapi**
- **Sqlalchemy**
- **PostgreSQL**

### 托管

- **Vercel** 托管 Next.js + Fastapi 项目
- **supabase** 托管 PostgreSQL 数据库

## 本地运行

### 安装依赖

> 确保你已经安装了 bun 和 uv

```bash
bun install
uv sync
```

### 运行项目

```bash
bun run dev
```

这将会同时启动 Next.js 与 Fastapi 服务器在 **3000** 端口上, **Fastapi将被映射到 /api/:path 路径下**。

参见 [package.json](./package.json) 中的 `scripts` 字段。

## 关于项目

目前需要实现的功能:

* [ ] 页脚展示服务器版权信息、社交链接
* [ ] 增加用于切换页面的navbar
* [ ] 嵌入Fastapi
* [ ] 首页展示服务器风采、服务器状态及服务器最新的博客
* [ ] 冥人唐功能
* [ ] 关于页
* [ ] 注册&登录逻辑，使用**账号密码**
* [ ] 账号管理
* [ ] 博客编辑&发布&展示

......等待补充完善
