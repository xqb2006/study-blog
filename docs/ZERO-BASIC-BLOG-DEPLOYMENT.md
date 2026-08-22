# 从零部署免费的个人博客

> 适用对象：没有服务器、不会写代码，但想拥有一个能在网页后台写文章的个人博客的用户。

本教程使用 GitHub 保存博客内容，Cloudflare Pages 负责自动构建和公开访问。日常不需要维护服务器、数据库或 CMS 主机。

## 原项目与二次整理

- 原主题作者与上游仓库：[cosZone / astro-koharu](https://github.com/cosZone/astro-koharu)。感谢原作者提供 Astro-Koharu 主题。
- 本仓库在原项目基础上增加并整理了 GitHub + Cloudflare Pages 的免费部署、GitHub OAuth 登录和网页后台写作流程。
- 本项目使用 [AGPL-3.0](../LICENSE) 许可证。Fork、修改或再次发布时，请保留原作者署名、上游链接与许可证。

## 你将得到什么

- 一个免费的 `pages.dev` 博客网址，例如 `https://my-blog.pages.dev`。
- 一个 `/admin` 网页后台，用 GitHub 账号登录后可发布文章、上传图片、修改站点资料。
- 所有文章、图片和设置都保存在你自己的 GitHub 仓库；不依赖数据库。
- 每次保存后台内容后，Cloudflare 会自动重新部署博客。

## 先了解工作方式

```text
你在后台保存文章或设置
        ↓
GitHub 仓库新增一次提交
        ↓
Cloudflare Pages 自动执行 npm run build
        ↓
新的静态博客发布到公网
```

这是一套“Git 型 CMS”方案：后台只是帮你把文件保存进 GitHub，GitHub 仓库才是你的长期内容备份。

## 准备工作

只需要两个免费账号：

1. 一个 GitHub 账号：用于保存代码、文章和图片。
2. 一个 Cloudflare 账号：用于部署网站和运行网页后台。

建议使用电脑浏览器操作。第一次部署约需 20 到 40 分钟。无需购买域名、服务器或数据库。

> 注意：免费服务的额度与规则可能会调整；`pages.dev` 在中国大陆的可访问性也会受网络环境影响，无法承诺始终稳定。你的内容仍保留在 GitHub，随时可以迁移到其他静态托管平台。

## 第一步：Fork 本仓库

1. 打开本项目的 GitHub 仓库页面。
2. 点击右上角的 **Fork**。
3. Owner 选择你自己的 GitHub 账号。
4. 仓库名称可以保留默认，也可以改成例如 `my-blog`。
5. 点击 **Create fork**。

完成后，你会拥有自己的仓库，地址类似：

```text
https://github.com/你的用户名/my-blog
```

后续文章、图片和配置都会写入这个仓库。请不要把它 Fork 到别人的账号下。

## 第二步：先改成自己的博客信息

在 GitHub 打开你刚刚 Fork 的仓库，进入 `config/site.yaml`：

1. 点击文件右上角的编辑按钮。
2. 修改 `site` 下的常用字段。
3. 点击 **Commit changes** 保存。

可以先参考下面的内容，只改冒号右边的值：

```yaml
site:
  title: 小明的博客
  subtitle: 记录、思考与分享
  name: 小明
  author: 小明
  description: 这是我的个人博客
  avatar: /img/avatar.svg
  url: https://暂时不用填写.pages.dev
```

暂时不知道博客网址也没有关系，部署完成后再回来填写 `url`。

## 第三步：部署到 Cloudflare Pages

1. 登录 Cloudflare 控制台。
2. 进入 **Workers & Pages**。
3. 点击 **Create application**，选择 **Pages**。
4. 选择连接 GitHub，并授权 Cloudflare 访问你的 GitHub 账号。
5. 在仓库列表中选择你 Fork 的博客仓库。
6. 在构建设置中填写：

| 配置项 | 填写内容 |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |

7. 点击 **Save and Deploy**，等待构建完成。

首次构建通常需要几分钟。看到部署成功后，Cloudflare 会提供一个形如下面的地址：

```text
https://你的项目名.pages.dev
```

打开它，能看到博客首页就表示静态博客部署成功。

### 填写真实博客网址

回到 GitHub 仓库的 `config/site.yaml`，把 `site.url` 改成 Cloudflare 给你的完整 `https://...pages.dev` 地址并提交。Cloudflare 会自动再次部署。

## 第四步：配置网页后台

这一部分只需要做一次。完成后可在 `https://你的博客.pages.dev/admin` 中写文章。

### 4.1 创建 GitHub OAuth App

在 GitHub 中依次打开：**头像** → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**。

按下表填写：

| 字段 | 填写内容 |
| --- | --- |
| Application name | 例如 `My Blog Admin` |
| Homepage URL | `https://你的博客.pages.dev` |
| Authorization callback URL | `https://你的博客.pages.dev/api/admin/callback` |

创建后：

1. 复制页面上的 **Client ID**。
2. 点击生成 **Client secret**，立即复制并妥善保存。

`Client secret` 只允许保存到 Cloudflare，**不要**发给任何人、不要写进 GitHub 文件、不要截图公开。

### 4.2 在 Cloudflare 添加变量

回到 Cloudflare：**Workers & Pages** → 你的 Pages 项目 → **Settings** → **Variables and Secrets**。

在 **Production** 环境中添加下列变量：

| 变量名 | 类型 | 填写内容 |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | Text | OAuth App 的 Client ID |
| `GITHUB_CLIENT_SECRET` | Secret | OAuth App 的 Client secret |
| `SESSION_SECRET` | Secret | 自己生成的一段至少 32 位随机字符 |
| `GITHUB_REPOSITORY_OWNER` | Text | 你的 GitHub 用户名 |
| `GITHUB_REPOSITORY_NAME` | Text | 你 Fork 后的仓库名，例如 `my-blog` |
| `GITHUB_REPOSITORY_BRANCH` | Text | `main` |
| `GITHUB_ADMIN_USERNAME` | Text | 允许登录后台的 GitHub 用户名，通常与 Owner 相同 |

`SESSION_SECRET` 可以使用密码管理器生成随机字符串。它不是 GitHub 密码，也不是 OAuth 密钥。

保存变量后，进入 **Deployments**，对最新部署执行 **Retry deployment** 或 **Redeploy**。这是必须的：Pages Function 只有重新部署后才会读取新变量。

### 4.3 登录测试

1. 打开 `https://你的博客.pages.dev/admin`。
2. 点击“使用 GitHub 登录”。
3. 使用 `GITHUB_ADMIN_USERNAME` 对应的 GitHub 账号授权。
4. 回到后台后，尝试新建一篇测试文章并保存。

保存成功后，到 GitHub 仓库的提交记录中应能看到一条新的 `cms:` 提交。随后等待 Cloudflare 自动部署完成，再刷新首页即可看到文章。

## 第五步：日常写文章和改资料

### 在网页后台操作

打开：

```text
https://你的博客.pages.dev/admin
```

- **文章管理**：新建、编辑、发布、设为草稿或置顶。
- **媒体库**：上传文章图片、浏览图片、删除不用的图片。
- **站点设置**：修改博客标题、作者、简介、头像、网址、社交链接等。

点击保存后不需要手动上传网站：后台会写入 GitHub，Cloudflare 会自动发布。一般等待部署完成后刷新即可；如果浏览器仍显示旧资料，请按 `Ctrl + F5` 强制刷新。

### 后台不能登录时的备用写作方式

你的内容始终在 GitHub 中，后台故障不会丢文章：

1. 打开 GitHub 仓库中的 `src/content/blog/`。
2. 点击 **Add file** → **Create new file**。
3. 文件名可写为 `我的第一篇文章.md`。
4. 填写下面的模板并提交：

```markdown
---
title: 我的第一篇文章
description: 这是一篇测试文章
date: 2026-08-22 20:00:00
categories:
  - 随笔
tags:
  - 开始
draft: false
---

这里开始写正文。
```

更详细的 GitHub 网页编辑说明见：[GitHub 网页写作指南](./GITHUB-WEB-EDITING.md)。

## 常见问题

### Cloudflare 构建失败

进入 **Workers & Pages** → 项目 → **Deployments** → 最新部署 → **View build log**。确认构建命令是 `npm run build`，输出目录是 `dist`，并查看日志中第一条明确的报错。

### 打开 `/admin` 出现 Error 1101

这通常是后台 Function 配置有误，不代表博客首页坏了。依次检查：

1. 七个 Cloudflare 变量是否都在 **Production** 环境。
2. `GITHUB_REPOSITORY_OWNER`、`GITHUB_REPOSITORY_NAME`、`GITHUB_ADMIN_USERNAME` 是否拼写完全正确。
3. OAuth App 的回调地址是否与 `https://你的博客.pages.dev/api/admin/callback` 完全一致。
4. 添加或修改变量后是否重新部署。

然后打开最新部署的 Functions 日志，查看具体报错。不要公开日志中的密钥、Cookie 或 OAuth code。

### 登录后提示没有管理权限

你当前登录的 GitHub 用户名与 `GITHUB_ADMIN_USERNAME` 不一致。退出 GitHub 后用正确账号重新登录，或在 Cloudflare 修改该变量并重新部署。

### 后台保存了，首页还没更新

先到 GitHub 提交记录确认是否出现新的 `cms:` 提交；出现后等待 Cloudflare 部署完成。随后用 `Ctrl + F5` 刷新首页或使用浏览器无痕窗口打开。

### 图片显示不出来

先确认后台上传完成后 GitHub 仓库内存在 `public/img/` 下的新图片，再等待 Cloudflare 部署完成。文章内图片地址应以 `/img/` 开头，例如：

```markdown
![示例图片](/img/cms-uploads/example.jpg)
```

## 内容安全与长期维护

- 不要把密码、OAuth Secret、GitHub Token、Cookie 提交到仓库或发给 AI。
- GitHub 仓库建议保持公开，否则当前后台授权范围不适用于私有仓库。
- 文章、图片和配置都在 GitHub；定期下载仓库 ZIP 或使用 GitHub 的 Fork/Clone 作为备份。
- 不要直接修改 `dist/` 或 `public/admin/`，它们是构建生成内容。
- 需要改主题代码时，先同步远端提交，避免覆盖后台写作产生的文章和图片提交。详细规则见 [AI 部署上下文手册](./AI-DEPLOYMENT-PLAYBOOK.md)。

## 部署完成清单

- [ ] 已 Fork 到自己的 GitHub 账号。
- [ ] 首页可以通过 `https://你的项目.pages.dev` 打开。
- [ ] `config/site.yaml` 的 `site.url` 已改成真实网址。
- [ ] OAuth App 的两个 URL 填写正确。
- [ ] Cloudflare Production 环境已添加七个变量。
- [ ] `/admin` 可以用自己的 GitHub 账号登录。
- [ ] 后台发布测试文章后，GitHub 出现 `cms:` 提交。
- [ ] Cloudflare 自动部署后，首页能看到测试文章。
