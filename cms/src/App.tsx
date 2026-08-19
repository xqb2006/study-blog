/**
 * CMS App
 *
 * Main entry point for the standalone CMS dashboard.
 */

import { AppIcon } from '@/components/ui/app-icon';
import { useEffect, useState, type CSSProperties } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'sonner';
import {
  AnnouncementsPanel,
  BgmPanel,
  CategoryStats,
  CreatePostDialog,
  ErrorFallback,
  FriendsPanel,
  ImportMarkdownDialog,
  MediaLibraryPanel,
  OperationsPanel,
  PostEditor,
  PostTable,
  RecentUpdates,
  SiteSettingsPanel,
  TaxonomyPanel,
} from '@/components';
import { AmbientCanvas } from '@/components/AmbientCanvas';
import { Button } from '@/components/ui/button';
import { type StatusFilter, type Tab, useDashboardState } from '@/hooks';
import { getBuildStatus, getSiteSettings } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { BuildStatusResponse, BuildSyncSummary, RuntimeSyncSummary, SiteSettings } from '@/types';

const BLOG_URL = 'http://localhost:4321';
const BLOG_FALLBACK_AVATAR = `${BLOG_URL}/img/avatar.webp`;
const COMPACT_RECENT_POSTS_DISPLAY = 3;
const COMPACT_CATEGORY_DISPLAY = 6;

type NavItem = { id: Tab; label: string; icon: string; description: string };

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: '内容工作区',
    items: [
      { id: 'overview', label: '工作台', icon: 'layout-dashboard', description: '今日总览' },
      { id: 'posts', label: '文章书房', icon: 'file-text', description: '写作发布' },
      { id: 'media', label: '素材库', icon: 'image', description: '图片素材' },
      { id: 'taxonomy', label: '分类花园', icon: 'tag', description: '内容结构' },
    ],
  },
  {
    label: '站点运营',
    items: [
      { id: 'settings', label: '站点装扮', icon: 'palette', description: '身份外观' },
      { id: 'operations', label: '运营设置', icon: 'wand-2', description: '评论统计' },
    ],
  },
];

const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

const TAB_FALLBACKS: Record<Tab, { label: string; description: string }> = {
  overview: { label: '工作台', description: '今日总览' },
  posts: { label: '文章书房', description: '写作发布' },
  media: { label: '素材库', description: '图片素材' },
  taxonomy: { label: '分类花园', description: '内容结构' },
  settings: { label: '站点装扮', description: '身份外观' },
  operations: { label: '运营设置', description: '评论统计' },
  friends: { label: '友链管理', description: '朋友站点' },
  announcements: { label: '公告管理', description: '站点公告' },
  bgm: { label: '音乐设置', description: '背景音乐' },
};

const DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const BUILD_STATUS_META: Record<BuildStatusResponse['lastResult'], { label: string; icon: string; className: string }> = {
  success: { label: '已同步', icon: 'check-circle-2', className: 'status-success' },
  failed: { label: '同步失败', icon: 'alert-triangle', className: 'status-failed' },
  running: { label: '同步中', icon: 'loader-2', className: 'status-running' },
  unknown: { label: '待确认', icon: 'circle-help', className: 'status-unknown' },
};

function resolveBlogAssetUrl(value?: string, baseUrl = BLOG_URL) {
  if (!value) return BLOG_FALLBACK_AVATAR;
  if (/^https?:\/\//i.test(value)) return value;

  const safeBaseUrl = baseUrl || BLOG_URL;
  const normalizedBase = safeBaseUrl.replace(/\/$/, '');
  return value.startsWith('/') ? `${normalizedBase}${value}` : `${normalizedBase}/${value}`;
}

function getBlogProfileFromSettings(settings: SiteSettings) {
  const site = settings.site || {};
  const url = site.url || BLOG_URL;

  return {
    avatar: resolveBlogAssetUrl(site.avatar, url),
    author: site.author || site.name || '你的名字',
    title: site.title || site.name || '我的博客',
    url,
  };
}

function formatShortDate(dateString: string) {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? dateString : DATE_FORMATTER.format(date);
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatSyncTime(value?: string) {
  if (!value) return '暂无记录';
  return formatShortDate(value);
}

function isSiteSettings(value: unknown): value is SiteSettings {
  return Boolean(value && typeof value === 'object' && 'site' in value);
}

function AppContent() {
  const [blogProfile, setBlogProfile] = useState({
    avatar: BLOG_FALLBACK_AVATAR,
    author: '你的名字',
    title: '我的博客',
    url: BLOG_URL,
  });
  const [runtimeSync, setRuntimeSync] = useState<RuntimeSyncSummary | null>(null);
  const [buildStatus, setBuildStatus] = useState<BuildStatusResponse | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const {
    activeTab,
    setActiveTab,
    data,
    isLoading,
    error,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    editingPostId,
    search,
    setSearch,
    category,
    setCategory,
    status,
    setStatus,
    sortField,
    sortOrder,
    fetchData,
    handleSort,
    handleToggleDraft,
    handleToggleSticky,
    handleDeletePost,
    handleCreatePostSuccess,
    handleImportPostSuccess,
    handleEditPost,
    handleEditorClose,
    handleEditorSaved,
  } = useDashboardState();

  useEffect(() => {
    let isMounted = true;
    const applySettings = (settings: SiteSettings) => {
      if (!isMounted) return;
      setBlogProfile(getBlogProfileFromSettings(settings));
    };
    const handleSiteSettingsSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ settings?: SiteSettings; runtimeSync?: RuntimeSyncSummary } | SiteSettings>).detail;
      const settings = isSiteSettings(detail) ? detail : detail.settings;
      if (settings?.site) applySettings(settings);
      if (!isSiteSettings(detail) && detail.runtimeSync) setRuntimeSync(detail.runtimeSync);
    };

    window.addEventListener('cms:site-settings-saved', handleSiteSettingsSaved);

    getSiteSettings()
      .then((response) => {
        applySettings(response.settings);
        setRuntimeSync(response.runtimeSync || null);
      })
      .catch((err) => console.error('同步博客头像失败:', err));

    return () => {
      isMounted = false;
      window.removeEventListener('cms:site-settings-saved', handleSiteSettingsSaved);
    };
  }, []);

  const loadBuildStatus = async () => {
    try {
      setBuildStatus(await getBuildStatus());
    } catch (err) {
      console.error('读取发布同步状态失败:', err);
    }
  };

  useEffect(() => {
    const handleBuildSyncRequested = (event: Event) => {
      const buildSync = (event as CustomEvent<BuildSyncSummary>).detail;
      if (buildSync?.status) setBuildStatus(buildSync.status);
      window.setTimeout(() => void loadBuildStatus(), 500);
      window.setTimeout(() => void loadBuildStatus(), 2000);
    };

    window.addEventListener('cms:build-sync-requested', handleBuildSyncRequested);
    return () => window.removeEventListener('cms:build-sync-requested', handleBuildSyncRequested);
  }, []);

  useEffect(() => {
    void loadBuildStatus();
  }, []);

  useEffect(() => {
    if (!buildStatus?.isRunning && !buildStatus?.isPending) return;
    const timer = window.setInterval(() => void loadBuildStatus(), 2000);
    return () => window.clearInterval(timer);
  }, [buildStatus?.isPending, buildStatus?.isRunning]);

  if (editingPostId) {
    return <PostEditor postId={editingPostId} onClose={handleEditorClose} onSaved={handleEditorSaved} />;
  }

  const activeItem = NAV_ITEMS.find((item) => item.id === activeTab) ?? TAB_FALLBACKS[activeTab];
  const totalPosts = data?.stats.total ?? 0;
  const publishedPosts = data?.stats.published ?? 0;
  const draftPosts = data?.stats.draft ?? 0;
  const categoryStats = data?.stats.categoryStats.slice(0, 4) ?? [];
  const recentPosts = data?.stats.recentPosts ?? [];
  const buildMeta = BUILD_STATUS_META[buildStatus?.lastResult || 'unknown'];
  const buildLabel = buildStatus?.isRunning ? '同步中' : buildStatus?.isPending ? '已排队' : buildMeta.label;
  const openPostsView = (nextStatus: StatusFilter = 'all') => {
    setSearch('');
    setCategory('');
    setStatus(nextStatus);
    setActiveTab('posts');
  };

  const statCards = [
    { label: 'Runtime Sync', value: runtimeSync?.success ? '已生成' : '待生成', delta: runtimeSync?.updatedAt ? formatSyncTime(runtimeSync.updatedAt) : '资料即时同步', icon: 'flashlight', tone: 'blue', action: () => setActiveTab('settings') },
    { label: '总文章数', value: formatCount(totalPosts), delta: '打开文章书房', icon: 'file-text', tone: 'cyan', action: () => openPostsView('all') },
    { label: '草稿箱', value: formatCount(draftPosts), delta: '查看草稿文章', icon: 'draft', tone: 'purple', action: () => openPostsView('draft') },
  ];

  const quickActions = [
    { label: '写新文章', description: '打开文章编辑入口', icon: 'plus-circle', action: () => setIsCreateDialogOpen(true) },
    { label: '导入 Markdown', description: '上传文档或粘贴公开链接', icon: 'file-up', action: () => setIsImportDialogOpen(true) },
    { label: '上传素材', description: '进入素材库上传图片', icon: 'image-plus', action: () => setActiveTab('media') },
    { label: '修改装扮', description: '同步头像、社交链接和站点信息', icon: 'palette', action: () => setActiveTab('settings') },
    { label: '查看博客', description: '打开 Public Blog 新窗口', icon: 'external-link', action: () => window.open(blogProfile.url, '_blank', 'noopener,noreferrer') },
  ];

  return (
    <>
      <Toaster position="top-right" richColors />

      <div className="sakura-shell min-h-screen overflow-x-hidden text-foreground lg:grid lg:grid-cols-[220px_1fr]">
        <AmbientCanvas />
        <aside className="sakura-sidebar border-b lg:min-h-screen lg:border-r lg:border-b-0">
          <div className="px-5 pt-7 pb-5">
            <button type="button" onClick={() => setActiveTab('overview')} className="sakura-logo" aria-label="打开工作台">
              <span className="sakura-logo-mark">
                <AppIcon name="flower" className="size-5" />
              </span>
              <span className="sakura-logo-type">
                我的博客
                <span>CMS</span>
              </span>
            </button>
            <p className="sakura-logo-kicker">Content atelier</p>
          </div>

          <nav className="sakura-nav flex gap-2 overflow-x-auto px-3 pb-4 lg:block lg:space-y-1.5 lg:overflow-visible">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label} className="sakura-nav-group">
                <p className="sakura-nav-label">{section.label}</p>
                <div className="sakura-nav-items">
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={cn('sakura-nav-item group', activeTab === item.id && 'is-active')}
                    >
                      <span className="sakura-nav-icon">
                        <AppIcon name={item.icon} className="size-4 shrink-0" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{item.label}</span>
                        <span className="hidden truncate text-[11px] text-[var(--cms-muted)] xl:block">{item.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-auto hidden px-4 pb-6 lg:block">
            <div className="sakura-helper-card">
              <div className="sakura-helper-body">
                <p className="sakura-helper-title">今日写作</p>
                <p className="sakura-helper-note mt-2 text-xs leading-5">先写完一页，再点发布同步。预览无误后再上线。</p>
                <button type="button" onClick={() => setIsCreateDialogOpen(true)} className="sakura-helper-button">
                  <AppIcon name="sparkles" className="size-3.5" />
                  新建一篇
                </button>
              </div>
            </div>
            <p className="sakura-sidebar-copyright mt-4 text-center text-[11px] leading-5">
              © 2026 我的博客 CMS
              <br />
              localhost:4321
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sakura-topbar sticky top-0 z-30">
            <div className="flex min-h-[76px] items-center gap-4 px-4 md:px-7">
              <div className="sakura-topbar-context">
                <span>CMS / {activeItem.label}</span>
                <strong>{activeItem.description}</strong>
              </div>

              <label className="sakura-search">
                <AppIcon name="search" className="size-4 text-[var(--cms-muted)]" />
                <input
                  type="search"
                  placeholder="搜索文章、素材、分类..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <span>⌘ K</span>
              </label>

              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} className="sakura-primary-action">
                  <AppIcon name="plus" className="mr-1.5 size-4" />
                  快速发布
                </Button>
                <button type="button" className="sakura-icon-button hidden sm:inline-flex" aria-label="打开公告" title="打开公告" onClick={() => setActiveTab('announcements')}>
                  <AppIcon name="bell" className="size-5" />
                  <span className="sakura-notice-dot" />
                </button>
                <button type="button" className="sakura-icon-button hidden sm:inline-flex" aria-label="刷新文章" title="刷新文章" onClick={fetchData}>
                  <AppIcon name={isLoading ? 'loader-2' : 'refresh'} className={cn('size-5', isLoading && 'animate-spin')} />
                </button>
                <button type="button" onClick={() => window.open(blogProfile.url, '_blank', 'noopener,noreferrer')} className="sakura-user-chip">
                  <img src={blogProfile.avatar} alt="" />
                  <span>{blogProfile.author}</span>
                  <AppIcon name="external-link" className="size-3.5 opacity-70" />
                </button>
              </div>
            </div>
          </header>

          <main className="sakura-main-area flex-1 px-4 pb-10 md:px-7">
            {error ? (
              <div className="sakura-empty-state">
                <AppIcon name="alert-triangle" className="size-12 text-[var(--cms-accent)]" />
                <p>{error}</p>
                <Button variant="outline" onClick={fetchData}>重试</Button>
              </div>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <div className="sakura-dashboard">
                    <section className="sakura-dashboard-main">
                      <div className="sakura-welcome">
                        <div>
                          <p className="sakura-eyebrow">Workspace / Overview</p>
                          <h1>
                            欢迎回来，
                            <span className="sakura-display-name">{blogProfile.author}</span>
                          </h1>
                          <p className="sakura-lede">内容、素材、分类与发布同步，集中在同一块画布里完成。</p>
                        </div>
                        <div className="sakura-welcome-meta" aria-hidden="true">
                          <span>01</span>
                          <em>atelier</em>
                        </div>
                      </div>

                      {isLoading || !data ? (
                        <div className="sakura-loading-panel">
                          <AppIcon name="loader-2" className="size-8 animate-spin text-[var(--cms-accent)]" />
                        </div>
                      ) : (
                        <>
                          <div className="sakura-stat-grid">
                            {statCards.map((card) => (
                              <button key={card.label} type="button" onClick={card.action} className="sakura-stat-card" aria-label={card.delta}>
                                <span className={cn('sakura-stat-icon', `sakura-stat-${card.tone}`)}>
                                  <AppIcon name={card.icon} className="size-6" />
                                </span>
                                <div>
                                  <p>{card.label}</p>
                                  <strong>{card.value}</strong>
                                  <span>{card.delta}</span>
                                </div>
                              </button>
                            ))}
                          </div>

                          <div className="sakura-analytics-grid">
                            <section className="sakura-panel sakura-sync-panel">
                              <div className="sakura-panel-header">
                                <h2>Public Blog 状态</h2>
                                <button type="button" onClick={() => void loadBuildStatus()} aria-label="刷新发布同步状态">
                                  <AppIcon name="refresh" className="size-4" />
                                </button>
                              </div>
                              <div className="sakura-sync-summary">
                                <span className={cn('sakura-sync-icon', buildMeta.className)}>
                                  <AppIcon name={buildMeta.icon} className={cn('size-7', buildStatus?.isRunning && 'animate-spin')} />
                                </span>
                                <div>
                                  <strong>{buildLabel}</strong>
                                  <p>
                                    {buildStatus?.lastResult === 'failed'
                                      ? '上次 Build Sync 失败，进入发布同步查看日志并重新同步。'
                                      : buildStatus?.isRunning
                                        ? 'Build Sync 正在运行，完成后 Public Blog 会更新静态内容。'
                                        : buildStatus?.isPending
                                          ? '已有新的静态内容变更排队，当前同步结束后会继续执行。'
                                          : '没有运行中的 Build Sync。Runtime Sync 资料会即时写入运行时文件。'}
                                  </p>
                                </div>
                              </div>
                              <div className="sakura-sync-grid">
                                <button type="button" onClick={() => window.open(blogProfile.url, '_blank', 'noopener,noreferrer')}>
                                  <span>Build Sync</span>
                                  <strong>{buildLabel}</strong>
                                  <small>{buildStatus?.distUpdatedAt ? `dist ${formatSyncTime(buildStatus.distUpdatedAt)}` : '暂无 dist 时间'}</small>
                                </button>
                                <button type="button" onClick={() => setActiveTab('settings')}>
                                  <span>Runtime Sync</span>
                                  <strong>{runtimeSync?.success ? '已可用' : '待生成'}</strong>
                                  <small>{runtimeSync?.updatedAt ? formatSyncTime(runtimeSync.updatedAt) : runtimeSync?.message || '资料保存后生成'}</small>
                                </button>
                                <button type="button" onClick={() => window.open(blogProfile.url, '_blank', 'noopener,noreferrer')}>
                                  <span>Public Blog</span>
                                  <strong>打开检查</strong>
                                  <small>{blogProfile.url}</small>
                                </button>
                                <button type="button" onClick={() => setActiveTab('settings')}>
                                  <span>日志</span>
                                  <strong>{buildStatus?.log?.trim() ? '可查看' : '暂无日志'}</strong>
                                  <small>{buildStatus?.logPath || '.cache/cms/rebuild-blog.log'}</small>
                                </button>
                              </div>
                              {buildStatus?.lastResult === 'failed' && (
                                <button type="button" className="sakura-sync-warning" onClick={() => setActiveTab('settings')}>
                                  <AppIcon name="alert-triangle" className="size-4" />
                                  内容已保存，但 Public Blog 上次同步失败。打开发布同步查看日志。
                                </button>
                              )}
                            </section>

                            <section className="sakura-panel">
                              <div className="sakura-panel-header">
                                <h2>文章状态统计</h2>
                                <button type="button" aria-label="打开文章书房" onClick={() => openPostsView('all')}>
                                  <AppIcon name="external-link" className="size-4" />
                                </button>
                              </div>
                              <div className="sakura-donut-wrap">
                                <div className="sakura-donut" style={{ '--published': `${Math.max(12, Math.round((publishedPosts / Math.max(totalPosts, 1)) * 100))}%` } as CSSProperties}>
                                  <span>总计</span>
                                  <strong>{formatCount(totalPosts)}</strong>
                                </div>
                                <div className="sakura-donut-legend">
                                  <p><span className="dot dot-pink" />已发布 <strong>{publishedPosts}</strong></p>
                                  <p><span className="dot dot-purple" />草稿 <strong>{draftPosts}</strong></p>
                                  {categoryStats.slice(0, 3).map((item) => (
                                    <p key={item.name}><span className="dot dot-blue" />{item.name} <strong>{item.count}</strong></p>
                                  ))}
                                </div>
                              </div>
                              <button type="button" onClick={() => openPostsView('all')} className="sakura-soft-link">查看详情 <AppIcon name="arrow-right" className="size-4" /></button>
                            </section>
                          </div>

                          <div className="sakura-lower-grid">
                            <section className="sakura-panel">
                              <div className="sakura-panel-header">
                                <h2>最近更新</h2>
                              </div>
                              <div className="sakura-comment-list">
                                {recentPosts.length > 0 ? (
                                  recentPosts.slice(0, 4).map((post) => (
                                      <button key={post.id} type="button" onClick={() => handleEditPost(post.id)} className="sakura-comment-row">
                                        <img src={blogProfile.avatar} alt="" />
                                        <span>
                                          <strong>{post.title}</strong>
                                          <small>{post.categories[0] || '未分类'} · {post.draft ? '草稿' : '已发布'}</small>
                                        </span>
                                        <time>{formatShortDate(post.updated || post.date)}</time>
                                        <em>{post.draft ? '待发布' : '已上线'}</em>
                                      </button>
                                    ))
                                ) : (
                                  <div className="sakura-empty-inline">
                                    <AppIcon name="inbox" className="size-8" />
                                    <p>暂无最近更新</p>
                                  </div>
                                )}
                              </div>
                            </section>

                            <section className="sakura-panel">
                              <div className="sakura-panel-header">
                                <h2>快捷操作</h2>
                              </div>
                              <div className="sakura-action-list">
                                {quickActions.map((item) => (
                                  <button key={item.label} type="button" onClick={item.action} className="sakura-action-row">
                                    <span className="sakura-action-icon">
                                      <AppIcon name={item.icon} className="size-4.5" />
                                    </span>
                                    <span>
                                      <strong>{item.label}</strong>
                                      <small>{item.description}</small>
                                    </span>
                                    <AppIcon name="arrow-right" className="sakura-action-arrow size-5" />
                                  </button>
                                ))}
                              </div>
                            </section>
                          </div>

                          <div className="hidden">
                            <RecentUpdates posts={recentPosts} maxDisplay={COMPACT_RECENT_POSTS_DISPLAY} onEdit={handleEditPost} />
                            <CategoryStats categories={data.stats.categoryStats} maxDisplay={COMPACT_CATEGORY_DISPLAY} />
                          </div>
                        </>
                      )}
                    </section>
                  </div>
                )}

                {activeTab === 'posts' && (
                  <div className="sakura-page">
                    <div className="sakura-page-title">
                      <div>
                        <h1>{activeItem.label}</h1>
                        <p>管理文章、草稿、置顶和本地编辑器入口。</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
                          <AppIcon name="file-up" className="mr-1.5 size-4" />
                          导入 Markdown
                        </Button>
                        <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} className="sakura-primary-action">
                          <AppIcon name="plus" className="mr-1.5 size-4" />
                          新建文章
                        </Button>
                      </div>
                    </div>

                    <div className="sakura-filter-bar">
                      <div className="flex items-center gap-2 pr-1 font-semibold text-[#8a4d76] text-sm">
                        <span className="sakura-filter-icon">
                          <AppIcon name="filter" className="size-5" />
                        </span>
                        文章筛选
                      </div>
                      <label className="sakura-field">
                        <AppIcon name="search" className="size-4" />
                        <input type="text" placeholder="搜索文章..." value={search} onChange={(event) => setSearch(event.target.value)} />
                      </label>
                      <label className="sakura-field">
                        <AppIcon name="folder" className="size-4" />
                        <select value={category} onChange={(event) => setCategory(event.target.value)}>
                          <option value="">全部分类</option>
                          {data?.categories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </label>
                      <label className="sakura-field">
                        <AppIcon name="filter" className="size-4" />
                        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
                          <option value="all">全部状态</option>
                          <option value="published">已发布</option>
                          <option value="draft">草稿</option>
                        </select>
                      </label>
                      <p className="ml-auto rounded-full bg-[#fff1f7] px-3 py-1.5 text-[#b36b91] text-sm">
                        筛选到 {data?.posts.length || 0} / {data?.stats.total || 0} 篇文章
                      </p>
                    </div>

                    {isLoading || !data ? (
                      <div className="sakura-loading-panel">
                        <AppIcon name="loader-2" className="size-8 animate-spin text-[var(--cms-accent)]" />
                      </div>
                    ) : (
                      <PostTable
                        posts={data.posts}
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        onToggleDraft={handleToggleDraft}
                        onToggleSticky={handleToggleSticky}
                        onDelete={handleDeletePost}
                        onEdit={handleEditPost}
                      />
                    )}
                  </div>
                )}

                {activeTab !== 'overview' && activeTab !== 'posts' && (
                  <div className="sakura-page">
                    <div className="sakura-page-title">
                      <div>
                        <h1>{activeItem.label}</h1>
                        <p>{activeItem.description} · {blogProfile.title}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
                        <AppIcon name={isLoading ? 'loader-2' : 'refresh'} className={cn('mr-1.5 size-4', isLoading && 'animate-spin')} />
                        刷新
                      </Button>
                    </div>
                    {activeTab === 'settings' ? (
                      <SiteSettingsPanel />
                    ) : (
                      <div className="sakura-panel sakura-subpanel">
                        {activeTab === 'taxonomy' && <TaxonomyPanel />}
                        {activeTab === 'operations' && <OperationsPanel />}
                        {activeTab === 'friends' && <FriendsPanel />}
                        {activeTab === 'announcements' && <AnnouncementsPanel />}
                        {activeTab === 'bgm' && <BgmPanel />}
                        {activeTab === 'media' && <MediaLibraryPanel />}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      <CreatePostDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        existingCategories={data?.categories || []}
        onSuccess={handleCreatePostSuccess}
      />
      <ImportMarkdownDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        existingCategories={data?.categories || []}
        onSuccess={handleImportPostSuccess}
      />
    </>
  );
}

export function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AppContent />
    </ErrorBoundary>
  );
}
