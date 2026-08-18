# CMS Improvement PRD

## Objective

Turn the CMS into a fast, trustworthy Blog Operations Workspace for the 个人博客. The CMS should feel visually connected to the Public Blog, show only real operational information, and make it obvious whether a saved change is already visible on the Public Blog.

## Non-Goals

- Do not rebuild the entire public blog visual theme from scratch.
- Do not add Live2D, Lottie, or animated anime character behavior in the first implementation stage.
- Do not make mobile support equal to the full desktop CMS.
- Do not store MinIO bucket names, object keys, or other storage-provider internals in blog config or post frontmatter.
- Do not keep fake analytics, decorative trend charts, or inferred page-view counters.

## Impact Scope

- CMS primary navigation, labels, and page titles.
- CMS 工作台 first screen and quick actions.
- CMS 站点装扮 layout and image selection behavior.
- CMS sync/build status messaging and failure handling.
- CMS decorative Sakura/Koharu assets and graceful fallback behavior.
- Public Blog synchronization paths for site profile, content, navigation, taxonomy, media references, friends, announcements, BGM, and SEO.
- Public Blog verification surfaces: `/`, `/about`, `/posts`, `/categories`, `/tags`, `/friends`, and one representative post detail page.

## Key Terms

Canonical terms live in [CONTEXT.md](../CONTEXT.md). The most important terms for this change are:

- CMS
- Public Blog
- Blog Operations Workspace
- CMS Primary Navigation
- Runtime Sync
- Build Sync
- Media Availability
- 品牌一致性
- 桌面优先
- 氛围装饰

## Primary Navigation

Replace the primary CMS labels with:

`工作台 / 文章书房 / 素材库 / 分类花园 / 站点装扮 / 运营设置 / 发布同步 / 回收站`

The old labels should not remain as primary navigation labels:

`仪表盘 / 文章管理 / 媒体库 / 分类标签 / 主题外观 / 插件中心 / 系统设置 / 操作日志`

## 工作台 Requirements

The 工作台 first viewport should prioritize:

- Sync status
- Build status
- Total posts
- Draft posts
- Recent updates
- Quick actions

Quick actions:

- 写新文章
- 上传素材
- 修改装扮
- 发布同步
- 查看博客

The 工作台 must show only real information from repository content, site configuration, runtime sync state, build state, or a real integration. Remove fake trend charts, placeholder analytics, and inferred counters.

## 站点装扮 Requirements

The 站点装扮 page is divided into:

- 身份资料
- 社交入口
- 导航菜单
- 内容开关

Only the active section should be shown in the main editing area. Avoid one long unstructured settings page.

身份资料 image fields must support:

- Choosing a CMS media asset.
- Manually entering a public HTTP(S) image URL, including GitHub-hosted image URLs.
- A future gallery source such as MinIO, while still outputting a public image reference for the Public Blog.

## Synchronization Rules

- Site profile changes such as avatar, site name, description, and social links use Runtime Sync and should appear on the Public Blog within 1 second in normal operation.
- Structural or static-content changes such as posts, navigation, taxonomy, friends, announcements, BGM, and SEO use Build Sync with visible status, targeting 30-90 seconds.
- Media uploads should have immediate Media Availability inside the CMS. Public Blog visibility depends on where the media is referenced.
- Save success and Public Blog sync success must be messaged separately.

## Failure Handling

Sync failures must not block continued editing.

If saving succeeds but Public Blog sync fails, the CMS should explicitly say the content was saved but the Public Blog did not update. 工作台 and 发布同步 must show the failure state, provide access to status/logs, and expose a `重新同步` action.

## Visual Design Requirements

- Maintain 品牌一致性 with the Public Blog.
- Keep Sakura/Koharu atmosphere, rounded visual language, avatar/profile identity, and calm pink styling.
- Avoid generic SaaS/admin-dashboard styling.
- Keep tables, filters, forms, and status panels efficient for management workflows.
- 氛围装饰 must not carry essential information. Missing decorative images should hide or gracefully degrade instead of leaving broken UI.

## Mobile Requirements

The CMS is 桌面优先.

Mobile should support:

- Viewing status.
- Quick publishing.
- Uploading media.
- Editing avatar/basic profile fields.
- Triggering 发布同步.

Complex tables, bulk management, and long-form editing can remain desktop-optimized.

## Architecture Decisions

- [ADR 0001: Tiered CMS-to-Public-Blog synchronization](./adr/0001-tiered-cms-to-public-blog-sync.md)
- [ADR 0002: Store public image references in blog content](./adr/0002-public-image-references-in-blog-content.md)

## Acceptance Criteria

- CMS primary navigation uses the approved labels.
- 工作台 contains no fake trend charts, inferred page-view counters, or placeholder metrics.
- 工作台 first viewport shows whether the Public Blog is current and what action to take next.
- Every 工作台 quick action performs a visible action or navigates to the correct CMS/Public Blog surface.
- 站点装扮 is divided into the approved four sections and does not become one long unstructured page.
- Avatar editing supports CMS media selection and manual public HTTP(S) URLs.
- Blog config and post frontmatter store public image paths/URLs, not storage-provider internals.
- Runtime Sync for site profile changes completes within 1 second in normal operation.
- Build Sync starts automatically for static-content changes and exposes running/success/failure state.
- Sync failures are visible in 工作台 and 发布同步, with logs/status and a `重新同步` action.
- Public Blog verification covers `/`, `/about`, `/posts`, `/categories`, `/tags`, `/friends`, and one representative post detail page.
- CMS screens visibly inherit the 个人博客 blog identity.
- Missing decorative Sakura/anime assets do not leave visibly broken UI.
- Mobile verification covers essential quick actions and status visibility.

## Test Checklist

- Verify CMS navigation labels and page titles.
- Verify 工作台 data comes from real CMS/API/config/build state.
- Verify each 工作台 quick action.
- Save avatar through CMS media selection and confirm Public Blog Runtime Sync.
- Save avatar through a public HTTP(S) URL and confirm Public Blog Runtime Sync.
- Save a static-content change and confirm Build Sync starts and status is visible.
- Force or simulate a sync/build failure and confirm the CMS distinguishes saved state from Public Blog visibility.
- Check Public Blog pages: `/`, `/about`, `/posts`, `/categories`, `/tags`, `/friends`, and one post detail page.
- Check mobile essential flows: status, quick publishing entry, media upload entry, profile/avatar edit, 发布同步.

