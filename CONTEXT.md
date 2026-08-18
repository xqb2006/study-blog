# Astro Koharu Blog Operations

This context describes the user-facing language for operating the 个人博客 through its CMS and public blog.

## Language

**CMS**:
The browser-based management interface used by the blog owner to edit content, media, taxonomy, site settings, and publishing workflows.
_Avoid_: 后台, 管理系统

**Public Blog**:
The reader-facing Astro site at the configured public URL, generated from repository content and configuration.
_Avoid_: 前台, 博客前台

**Blog Operations Workspace**:
The intended product shape of the CMS: a focused workspace for daily publishing, configuration, media, and rebuild tasks that stays visually connected to the Public Blog.
_Avoid_: 普通后台, 泛管理面板

**CMS Primary Navigation**:
The top-level CMS sections used by the blog owner to move between daily workflows. Labels should describe real blog operations and match the 个人博客 identity.
_Avoid_: 插件中心, 系统设置, 操作日志

**工作台**:
The CMS overview screen for daily status, quick actions, and sync/build awareness.
_Avoid_: 仪表盘

**真实信息**:
Data shown in the CMS that comes from repository content, site configuration, runtime sync state, build state, or another real integration.
_Avoid_: 假数据, 装饰性统计

**氛围装饰**:
Decorative Sakura/Koharu visual assets in the CMS that support brand feeling but do not carry essential workflow information.
_Avoid_: 核心内容, 功能提示

**品牌一致性**:
The visual and behavioral alignment between the CMS and the Public Blog, covering color, profile identity, Sakura/Koharu atmosphere, typography rhythm, and interaction polish.
_Avoid_: 完全复刻, 泛后台风格

**桌面优先**:
The CMS design priority where full management workflows are optimized for desktop, while mobile keeps essential status and quick actions usable.
_Avoid_: 移动端完整后台

**文章书房**:
The CMS section for creating, editing, filtering, publishing, drafting, and deleting posts.
_Avoid_: 文章管理

**素材库**:
The CMS section for uploading, browsing, selecting, and deleting media assets.
_Avoid_: 媒体库

**图库来源**:
A source from which the CMS can select or receive images. The current sources are local public media paths and external image URLs; future sources may include MinIO or another object-storage-backed gallery.
_Avoid_: 图片仓库, 图床

**外链图片**:
An image referenced by a full HTTP(S) URL, such as a GitHub-hosted image or another public image URL.
_Avoid_: 远程头像

**分类花园**:
The CMS section for category, tag, series, and featured content organization.
_Avoid_: 分类标签

**站点装扮**:
The CMS section for public blog identity and appearance settings such as avatar, title, profile, social links, navigation, and content feature switches.
_Avoid_: 主题外观, 站点设置

**运营设置**:
The CMS section for comments, analytics, robots, and other operational integrations.
_Avoid_: 插件中心

**发布同步**:
The CMS section for build status, rebuild logs, and Public Blog synchronization.
_Avoid_: 系统设置, 构建状态

**回收站**:
The CMS section for restoring or permanently clearing deleted posts and media.
_Avoid_: 操作日志

**Sync**:
The user-visible result that a CMS change appears correctly on the Public Blog without confusing manual steps.
_Avoid_: 发布, 刷新

**Runtime Sync**:
A fast synchronization path for CMS changes that can safely update the Public Blog without rebuilding static pages.
_Avoid_: 即时发布, 热更新

**Build Sync**:
A synchronization path for CMS changes that require regenerating static blog output before the Public Blog fully reflects the change.
_Avoid_: 手动刷新, 重新发布

**Media Availability**:
The state where uploaded media is immediately visible and selectable inside the CMS, even before any page that references it has been rebuilt.
_Avoid_: 媒体发布

