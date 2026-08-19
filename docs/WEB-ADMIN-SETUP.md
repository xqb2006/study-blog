# 网页后台一次性配置

博客后台地址：`https://study-blog-5rb.pages.dev/admin`

后台使用 GitHub OAuth 登录，文章和个人信息仍然保存在 `xqb2006/study-blog` 仓库中。Cloudflare Pages 负责自动构建发布，不需要数据库。

## 1. 创建 GitHub OAuth App

在 GitHub 中打开：`Settings` → `Developer settings` → `OAuth Apps` → `New OAuth App`。

填写：

- Application name：`Study Blog Admin`
- Homepage URL：`https://study-blog-5rb.pages.dev`
- Authorization callback URL：`https://study-blog-5rb.pages.dev/api/admin/callback`

创建后复制 `Client ID`，并点击生成 `Client secret`。密钥只在 Cloudflare 中保存，不要提交到 GitHub。

## 2. 配置 Cloudflare Pages 环境变量

进入 Cloudflare：`Workers & Pages` → 选择 Pages 项目 → `Settings` → `Environment variables`。

在 **Production** 环境添加：

```text
GITHUB_CLIENT_ID=GitHub OAuth App 的 Client ID
GITHUB_CLIENT_SECRET=GitHub OAuth App 的 Client Secret
SESSION_SECRET=一串至少 32 位的随机字符串
```

保存后，进入 `Deployments`，点击最新提交右侧的重新部署按钮。之后访问 `/admin` 即可登录。

## 3. 日常使用

1. 打开 `/admin`。
2. 点击“使用 GitHub 登录”。
3. 在“文章管理”中新建或修改文章。
4. 在“个人信息”中修改博客名称、作者、简介和地址。
5. 点击保存，等待 Cloudflare 自动部署。

只有 GitHub 用户名 `xqb2006` 可以使用这个后台。

