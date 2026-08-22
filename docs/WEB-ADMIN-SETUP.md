# 网页后台一次性配置

本项目的网页后台地址是：`https://你的博客.pages.dev/admin`。

后台使用 GitHub OAuth 登录，将文章、图片和站点配置提交到你自己的 GitHub 仓库；Cloudflare Pages 检测到提交后会自动构建发布，因此不需要数据库或 CMS 服务器。

完整的新手流程请优先阅读：[从零部署免费的个人博客](./ZERO-BASIC-BLOG-DEPLOYMENT.md)。

## 快速配置清单

1. 在 GitHub 创建 OAuth App：
   - Homepage URL：`https://你的博客.pages.dev`
   - Authorization callback URL：`https://你的博客.pages.dev/api/admin/callback`
2. 在 Cloudflare Pages 的 **Settings → Variables and Secrets** 中添加 Production 变量：

```text
GITHUB_CLIENT_ID=OAuth App 的 Client ID
GITHUB_CLIENT_SECRET=OAuth App 的 Client secret
SESSION_SECRET=至少 32 位随机字符串
GITHUB_REPOSITORY_OWNER=你的 GitHub 用户名
GITHUB_REPOSITORY_NAME=你的博客仓库名
GITHUB_REPOSITORY_BRANCH=main
GITHUB_ADMIN_USERNAME=允许登录后台的 GitHub 用户名
```

3. 保存变量后重新部署最新版本。
4. 打开 `/admin`，使用 `GITHUB_ADMIN_USERNAME` 对应的 GitHub 账号登录。

`GITHUB_CLIENT_SECRET` 与 `SESSION_SECRET` 必须使用 Secret 类型保存，不能提交进 GitHub、发给他人或写入前端代码。
