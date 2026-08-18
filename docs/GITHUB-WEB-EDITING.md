# GitHub 网页写作指南

本项目采用 GitHub 保存源码和文章，Cloudflare Pages 自动构建发布。日常写作不需要启动本地 CMS，也不需要维护服务器。

## 新建文章

1. 打开 GitHub 仓库。
2. 进入 `src/content/blog/`。
3. 点击 `Add file` → `Create new file`。
4. 输入文件名，例如 `my-first-post.md`。
5. 填写下面的文章模板：

```markdown
---
title: 我的第一篇文章
description: 文章简介
date: 2026-08-18 20:00:00
categories:
  - 随笔
tags:
  - 记录
cover: /img/cover/10.webp
---

## 开始写作

这里写文章正文。
```

6. 在页面下方点击 `Commit changes`。
7. 选择直接提交到默认分支，然后确认提交。

文章文件必须放在 `src/content/blog/` 下，并且使用 `.md` 扩展名。

## 修改站点资料

编辑：

```text
config/site.yaml
```

重点修改 `site` 部分：

```yaml
site:
  title: 我的博客
  alternate: My Blog
  subtitle: 记录、思考与分享
  name: 你的名字
  description: 你的博客简介
  author: 你的名字
  url: https://你的站点.pages.dev
  avatar: /img/avatar.svg
```

修改完成后点击 `Commit changes` 提交。

## 修改关于页面

编辑：

```text
src/pages/about.md
```

这里可以修改个人介绍、博客说明和联系方式。

## 上传头像或文章图片

1. 进入 `public/img/`。
2. 点击 `Add file` → `Upload files`。
3. 上传图片并提交。
4. 在文章中使用类似路径：

```markdown
![图片说明](/img/example.webp)
```

头像配置示例：

```yaml
avatar: /img/avatar.webp
```

## 发布过程

提交到 GitHub 后，Cloudflare Pages 会自动执行：

```text
GitHub 提交 → npm run build → 发布 dist
```

打开 Cloudflare Pages 项目的 Deployments 页面，可以查看构建状态。构建成功后刷新博客即可看到更新。

## 注意事项

- 不要直接编辑 `dist/`，它是构建生成目录。
- 不要删除 `src/content/config.ts`，否则文章格式校验会失效。
- 日期建议使用 `YYYY-MM-DD HH:mm:ss` 格式。
- 文章如果暂时不想公开，可以在 frontmatter 中加入 `draft: true`。
- 当前免费 Cloudflare Pages 地址在中国大陆的访问稳定性无法保证；如果未来主要面向国内访问，再考虑增加国内托管。
