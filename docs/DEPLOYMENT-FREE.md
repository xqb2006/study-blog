# 零费用部署与网页写作

## 目标

公开博客保持静态部署，不运行数据库、CMS 服务器或付费 API。

## 部署流程

```text
GitHub 仓库
    ↓
Cloudflare Pages 自动构建
    ↓
免费 pages.dev 地址
    ↓
公开博客
```

## 网页写作流程

项目根目录的 `.pages.yml` 为 Git 型网页 CMS 提供内容字段和媒体目录配置。

文章保存到：

```text
src/content/blog/
```

图片保存到：

```text
public/img/
```

网页编辑器提交内容后，GitHub 会产生一次提交，Cloudflare Pages 再自动构建博客。

## 备用发布方式

网页 CMS 暂时不可用时，可以直接在 GitHub 网页中编辑：

1. 打开 `src/content/blog/`
2. 新建或修改 `.md` 文件
3. 按照文章 Schema 填写 Frontmatter
4. 提交修改
5. 等待 Cloudflare Pages 自动构建

## 免费部署约束

- 不购买自定义域名
- 不配置评论服务
- 不配置统计服务
- 不配置运行时 AI
- 不将密钥提交到仓库
- 图片先压缩再上传

## 本地验证

```bash
npm install
npm run check
npm run build
```
