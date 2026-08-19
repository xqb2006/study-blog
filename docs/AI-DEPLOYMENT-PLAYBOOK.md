# AI 部署上下文手册

本文件用于交给其他 AI，帮助其理解项目部署架构、配置位置和排障方法。

安全要求：不得在本文件中保存 OAuth Secret、GitHub Token、Cookie、验证码或任何真实凭据。

## 一、架构总览

```text
GitHub 仓库
  ├─ Astro 源代码
  ├─ src/content/blog/*.md       文章
  └─ config/site.yaml             站点和个人资料
          │ push main
          ▼
Cloudflare Pages
  ├─ 安装依赖并执行 npm run build
  ├─ 发布 dist 静态文件
  └─ 运行 functions/ 下的 Pages Functions
          │
          ├─ /admin                 网页管理后台
          └─ /api/admin/*            GitHub OAuth 和 GitHub API 接口
```

当前仓库：

```text
https://github.com/xqb2006/study-blog
```

当前生产域名：

```text
https://study-blog-5rb.pages.dev
```

生产分支：`main`

## 二、Cloudflare Pages 配置

```text
Production branch: main
Build command: npm run build
Build output directory: dist
```

自动发布流程：

```text
git push origin main
  → Cloudflare 拉取仓库
  → pnpm install
  → npm run build
  → 发布 dist
  → 上传 functions
```

## 三、内容文件

文章目录：

```text
src/content/blog/
```

文章使用 Markdown + YAML frontmatter：

```markdown
---
title: 文章标题
description: 文章简介
date: 2026-08-19 20:00:00
categories:
  - 随笔
tags:
  - 记录
cover: /img/cover/10.webp
---

正文内容。
```

个人信息配置：

```text
config/site.yaml
```

常用字段：

```yaml
site:
  title: 博客标题
  alternate: English title
  subtitle: 博客副标题
  name: 作者名称
  author: 作者名称
  description: 博客简介
  avatar: /img/avatar.svg
  url: https://example.pages.dev
```

图片目录：`public/img/`。

## 四、网页后台

后台页面：

```text
/admin
```

前端文件：`src/pages/admin.astro`

Functions 文件：

```text
functions/_lib/github.ts
functions/api/admin/login.ts
functions/api/admin/callback.ts
functions/api/admin/session.ts
functions/api/admin/logout.ts
functions/api/admin/posts.ts
functions/api/admin/settings.ts
```

接口职责：

```text
/api/admin/login       跳转 GitHub OAuth
/api/admin/callback    接收 OAuth 回调并建立会话
/api/admin/session     检查登录状态
/api/admin/logout      清除会话
/api/admin/posts       读取、新建、修改、删除文章
/api/admin/settings    修改 config/site.yaml 的 site 节点
```

发布文章的实际流程：

```text
网页填写文章
  → Pages Function
  → GitHub Contents API
  → 写入 src/content/blog/*.md
  → GitHub 产生提交
  → Cloudflare 自动重新构建
```

## 五、GitHub OAuth

登录流程：

```text
/admin
  → /api/admin/login
  → GitHub 授权
  → /api/admin/callback
  → 换取 access token
  → 检查管理员 GitHub 用户名
  → 写入 HttpOnly、Secure、SameSite=Lax Cookie
```

当前管理员账号限制为：

```text
xqb2006
```

迁移到其他项目时必须修改管理员用户名、仓库所有者、仓库名称和分支。

OAuth App 的 callback URL 必须完全匹配：

```text
https://<pages-domain>/api/admin/callback
```

不要用 GitHub App 代替 OAuth App，除非重写 OAuth 授权代码。

## 六、Cloudflare 环境变量

在 Pages 项目的 `Settings → Variables and secrets` 中配置 Production 变量：

```text
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
SESSION_SECRET
```

要求：

- `GITHUB_CLIENT_ID` 可以是 Text。
- `GITHUB_CLIENT_SECRET` 必须是 Secret。
- `SESSION_SECRET` 必须是 Secret，建议至少 32 位随机字符串。
- Secret 不能提交到 GitHub、README、前端代码或日志。
- 修改变量后必须重新部署。

## 七、本地验证和发布

```powershell
npm run check
npm run build
git status
git diff
git add <相关文件>
git commit -m "描述修改"
git push origin main
```

成功标准：

- `npm run check` 没有 error。
- `npm run build` 成功。
- Cloudflare 日志显示 `Compiled Worker successfully`。
- Cloudflare 日志显示 `Success: Your site was deployed!`。

## 八、Error 1101 排查

`Error 1101 Worker threw exception` 通常表示 Pages Function 运行时异常，不一定是静态博客构建失败。

排查路径：

```text
Cloudflare
  → Workers & Pages
  → 项目
  → Deployments
  → 最新部署 Details
  → Functions
  → Begin log stream
```

然后从 `/admin` 重新开始登录，读取最新异常堆栈。

重点检查：

- OAuth callback URL 是否完全一致。
- 三个环境变量是否存在于 Production。
- 修改环境变量后是否重新部署。
- 是否访问了旧的 `/api/admin/callback?code=...&state=...` 地址。
- GitHub 返回内容是 JSON 还是 URL encoded 表单。
- 最新部署是否包含 Functions 目录。

不要只根据 Ray ID 猜测原因，必须读取最新 Functions 日志。

## 九、迁移到其他项目

复制本架构到其他项目时，必须重新确认：

```text
GitHub owner
GitHub repository
branch
Pages domain
OAuth callback URL
管理员 GitHub username
文章目录
配置文件路径
```

迁移清单：

- [ ] GitHub 仓库地址正确。
- [ ] Cloudflare Pages 连接正确仓库。
- [ ] 构建命令和输出目录正确。
- [ ] OAuth App 已创建。
- [ ] callback URL 正确。
- [ ] 三个环境变量已配置。
- [ ] 管理员账号限制已修改。
- [ ] `/admin` 可以打开。
- [ ] GitHub 登录可以回调成功。
- [ ] 新建文章可以产生 GitHub 提交。
- [ ] Cloudflare 可以自动重新部署。

## 十、交给其他 AI 的规则

1. 先读取本文件、`README.md`、`package.json` 和 `.pages.yml`。
2. 不要求用户提供密码、验证码、Token 或 Secret。
3. 不把任何 Secret 写入代码或提交记录。
4. 修改 Functions 后运行 `npm run check` 和 `npm run build`。
5. 遇到 Error 1101 时读取最新 Functions 日志，不依据旧日志猜测。
6. 不擅自引入服务器或数据库，除非用户明确改变架构。
7. 推送前检查 `git status` 和 `git diff`，不要提交无关文件。
8. 不执行删除仓库、重置分支、删除部署等破坏性操作，除非用户明确确认。
9. 最终汇报修改文件、验证结果、部署提交号和用户下一步操作。
## Git 同步策略（重要）

本项目存在两个会修改 `main` 的来源：网页 CMS 会通过 GitHub API 提交文章、设置和图片；AI/本地开发会提交源代码。因此，AI 修改代码前必须先同步远程仓库，不能假设本地分支是最新的。

推荐流程：

```powershell
& 'F:\app\Git\cmd\git.exe' -c http.version=HTTP/1.1 fetch origin main
& 'F:\app\Git\cmd\git.exe' rebase origin/main
& 'F:\app\Git\cmd\git.exe' -c http.version=HTTP/1.1 push origin main
```

规则：

- CMS 继续直接提交 `main`，因为 Cloudflare Pages 监听 `main` 自动部署。
- AI 开发前先执行 `fetch`，发现远程有新提交时先 `rebase`，再修改代码或推送。
- 代码开发优先使用独立分支并通过 Pull Request 合并，避免覆盖 CMS 产生的内容提交。
- 禁止使用 `git push --force`，不得覆盖网页端产生的文章、图片和设置提交。
- 当前网络对 Git 默认连接可能不稳定，推送统一优先使用 `http.version=HTTP/1.1`。
- 上传图片会产生独立 Git 提交；批量上传可以减少提交数量，但不能省略同步步骤。

CMS 当前只提供适合 GitHub + Cloudflare 架构的功能：文章编辑、Markdown 导入、站点配置、分类配置、图片上传/浏览/删除。不可恢复的回收站、本地编辑器跳转和手动本地构建入口不再提供。
