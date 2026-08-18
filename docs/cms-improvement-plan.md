# CMS Improvement Plan

## Goal

Refine the CMS into a Blog Operations Workspace that stays visually and behaviorally connected to the Public Blog. CMS changes should update the Public Blog quickly and consistently, especially site settings such as avatar, media, navigation, taxonomy, and content status.

## Impact Scope

- CMS dashboard navigation, labels, and clickable workflows.
- CMS settings panels for site appearance, media, taxonomy, operations, and build status.
- Public Blog synchronization behavior after CMS changes.
- Public Blog surfaces affected by CMS-managed data, including avatar, site profile, navigation, content lists, and media references.
- Build and runtime update paths that determine how quickly CMS changes become visible.

## Key Terms

See [CONTEXT.md](../CONTEXT.md).

## Design Decisions

- The Public Blog is in scope as the synchronization target and visual reference for CMS changes.
- Speed is part of the product requirement, not only an implementation detail.
- CMS changes should avoid unnecessary full rebuilds when a runtime update can safely synchronize the Public Blog.
- CMS Primary Navigation should be renamed around real blog-owner workflows and the 个人博客 identity, not generic admin-panel labels.
- CMS Primary Navigation labels are: `工作台 / 文章书房 / 素材库 / 分类花园 / 站点装扮 / 运营设置 / 发布同步 / 回收站`.
- CMS and Public Blog should maintain 品牌一致性. The CMS should feel like the operational side of the same blog, while still using efficient management controls such as tables, filters, forms, and status panels.
- Sync failures do not block continued editing, but the CMS must clearly distinguish "saved in CMS" from "visible on Public Blog".
- CMS is 桌面优先. Mobile should support status viewing, quick publishing, media upload, avatar/basic profile edits, and 发布同步; complex tables, bulk management, and long-form editing can remain desktop-optimized.
- The 工作台 should only show 真实信息. Decorative charts, inferred counters, or placeholder metrics should be removed unless connected to a real source.
- The 工作台 first screen prioritizes: Sync status, build status, total posts, draft posts, recent updates, and quick actions.
- 工作台 quick actions are: `写新文章 / 上传素材 / 修改装扮 / 发布同步 / 查看博客`.
- 氛围装饰 can support the Sakura/Koharu identity, but it must not carry essential information. If a decorative image fails to load, the CMS should hide or gracefully degrade that decoration.
- Animated anime character behavior is out of scope for the first implementation stage.
- 站点装扮 is divided into `身份资料 / 社交入口 / 导航菜单 / 内容开关`, with only the active section shown in the main content area.
- 身份资料 image fields support both 素材库 selection and manual 外链图片 input. The design should leave room for future 图库来源 such as MinIO.
- Blog configuration and post frontmatter store only public image URLs or public site-relative image paths. Storage-provider internals such as MinIO bucket names or object keys stay inside CMS integration code.
- Synchronization is tiered:
  - Site profile changes such as avatar, site name, description, and social links should use Runtime Sync and appear on the Public Blog within 1 second after saving.
  - Structural or static-content changes such as posts, navigation, taxonomy, friends, announcements, BGM, and SEO should use Build Sync with visible build status, targeting 30-90 seconds.
  - Media uploads should have immediate Media Availability in the CMS; public visibility depends on where the media is referenced.

## Open Questions

- None. The current planning interview is complete; implementation can proceed from the PRD.

## PRD

See [CMS Improvement PRD](./cms-improvement-prd.md).

## Acceptance Criteria

- A CMS change has a clear and predictable path to appearing on the Public Blog.
- The user does not need to guess whether a change requires waiting, rebuilding, or refreshing.
- Public Blog identity and CMS identity remain visually consistent.
- CMS screens avoid generic admin-dashboard styling and visibly inherit the 个人博客 blog identity.
- Slow operations expose status clearly instead of feeling unresponsive.
- Site profile Runtime Sync completes within 1 second in normal operation.
- Build Sync starts automatically for static-content changes and exposes running/success/failure state in the CMS.
- Sync failures are visible in 工作台 and 发布同步, with access to logs/status and a `重新同步` action.
- If a save succeeds but Public Blog sync fails, the success message explicitly says the content was saved but the Public Blog did not update.
- Mobile CMS verification covers essential quick actions and status visibility, not every advanced desktop workflow.
- Public Blog verification covers `/`, `/about`, `/posts`, `/categories`, `/tags`, `/friends`, and one representative post detail page.
- Primary navigation labels do not imply unavailable features or vague system areas.
- The old labels `仪表盘 / 文章管理 / 媒体库 / 分类标签 / 主题外观 / 插件中心 / 系统设置 / 操作日志` do not appear as primary navigation labels.
- The 工作台 contains no fake trend charts, inferred page-view counters, or placeholder metrics.
- The 工作台 first viewport lets the blog owner understand whether the Public Blog is current and what action to take next.
- Every 工作台 quick action performs a visible action or navigates to the correct CMS/Public Blog surface.
- Missing decorative Sakura/anime assets do not leave visibly broken UI.
- No Live2D/Lottie/character animation work is required in the first implementation stage.
- 站点装扮 does not present one long unstructured settings page; each section has a focused, bounded editing surface.
- Avatar editing supports choosing an existing CMS media asset and entering a public HTTP(S) image URL, including GitHub-hosted image URLs.
- CMS image selectors output a public image reference usable by the Public Blog.

