/**
 * CMS App
 *
 * Main entry point for the standalone CMS dashboard.
 */

import { AppIcon } from '@/components/ui/app-icon';
import { useEffect, useState, type CSSProperties } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { toast, Toaster } from 'sonner';
import {
  AnnouncementsPanel,
  BgmPanel,
  CategoryStats,
  ConfirmActionDialog,
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
import { getDeploymentStatus, getSiteSettings } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { DeploymentStatusResponse, RuntimeSyncSummary, SiteSettings } from '@/types';

const BLOG_URL = 'http://localhost:4321';
const BLOG_FALLBACK_AVATAR = `${BLOG_URL}/img/avatar.webp`;
const COMPACT_RECENT_POSTS_DISPLAY = 3;
const COMPACT_CATEGORY_DISPLAY = 6;
const DEPLOYMENT_POLL_INTERVAL_MS = 5000;
const DEPLOYMENT_MAX_POLL_ATTEMPTS = 24;

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

function getDeploymentPresentation(status: DeploymentStatusResponse | null) {
  switch (status?.state) {
    case 'success':
      return { icon: 'circle-check', iconClassName: 'status-success', title: '最新版本已上线', message: status.message };
    case 'failure':
      return { icon: 'circle-x', iconClassName: 'status-failed', title: 'Cloudflare 部署失败', message: status.message };
    case 'building':
      return { icon: 'loader-2', iconClassName: 'status-running', title: 'Cloudflare 正在构建', message: status.message };
    case 'queued':
      return { icon: 'clock-3', iconClassName: 'status-running', title: '等待 Cloudflare 构建', message: status.message };
    default:
      return {
        icon: 'circle-help',
        iconClassName: 'status-unknown',
        title: '等待部署状态',
        message: '文章、图片和设置保存后会先提交到 GitHub，再由 Cloudflare Pages 自动构建。',
      };
  }
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
  const [configuredCategoryMap, setConfiguredCategoryMap] = useState<Record<string, string>>({});
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatusResponse | null>(null);
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
    pendingPostDeletion,
    confirmDeletePost,
    cancelDeletePost,
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
      if (settings?.categoryMap) setConfiguredCategoryMap(settings.categoryMap);
      if (!isSiteSettings(detail) && detail.runtimeSync) setRuntimeSync(detail.runtimeSync);
    };

    window.addEventListener('cms:site-settings-saved', handleSiteSettingsSaved);

    getSiteSettings()
      .then((response) => {
        applySettings(response.settings);
        setConfiguredCategoryMap(response.settings.categoryMap || {});
        setRuntimeSync(response.runtimeSync || null);
      })
      .catch((err) => console.error('同步博客头像失败:', err));

    return () => {
      isMounted = false;
      window.removeEventListener('cms:site-settings-saved', handleSiteSettingsSaved);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: number | undefined;

    const pollDeployment = async (attempt: number, notify: boolean): Promise<void> => {
      try {
        const status = await getDeploymentStatus();
        if (!isMounted) return;
        setDeploymentStatus(status);

        if (status.state === 'success') {
          if (notify) toast.success('Cloudflare 已完成部署，前台网站已更新。');
          return;
        }

        if (status.state === 'failure') {
          if (notify) {
            toast.error('Cloudflare 部署失败，文章尚未上线。', {
              action: status.detailsUrl
                ? { label: '查看部署日志', onClick: () => window.open(status.detailsUrl, '_blank', 'noopener,noreferrer') }
                : undefined,
            });
          }
          return;
        }

        if (attempt >= DEPLOYMENT_MAX_POLL_ATTEMPTS) {
          if (notify) toast.message('Cloudflare 仍未返回部署结果，请稍后在“博客前台发布”面板查看状态。');
          return;
        }

        timeoutId = window.setTimeout(() => {
          void pollDeployment(attempt + 1, notify);
        }, DEPLOYMENT_POLL_INTERVAL_MS);
      } catch (error) {
        if (notify && isMounted) {
          toast.error(error instanceof Error ? error.message : '无法读取 Cloudflare 部署状态。');
        }
      }
    };

    const handleBuildSyncRequested = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      toast.message('内容已提交到 GitHub，正在等待 Cloudflare Pages 构建完成。');
      void pollDeployment(0, true);
    };

    window.addEventListener('cms:build-sync-requested', handleBuildSyncRequested);
    void pollDeployment(0, false);

    return () => {
      isMounted = false;
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener('cms:build-sync-requested', handleBuildSyncRequested);
    };
  }, []);

  if (editingPostId) {
    return <PostEditor postId={editingPostId} onClose={handleEditorClose} onSaved={handleEditorSaved} />;
  }

  const activeItem = NAV_ITEMS.find((item) => item.id === activeTab) ?? TAB_FALLBACKS[activeTab];
  const totalPosts = data?.stats.total ?? 0;
  const publishedPosts = data?.stats.published ?? 0;
  const draftPosts = data?.stats.draft ?? 0;
  const categoryStats = data?.stats.categoryStats.slice(0, 4) ?? [];
  const recentPosts = data?.stats.recentPosts ?? [];
  const availableCategories = [...new Set([...(data?.categories || []), ...Object.keys(configuredCategoryMap)])].sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const openPostsView = (nextStatus: StatusFilter = 'all') => {
    setSearch('');
    setCategory('');
    setStatus(nextStatus);
    setActiveTab('posts');
  };

  const statCards = [
    { label: '资料即时同步', value: runtimeSync?.success ? '已生成' : '待生成', delta: runtimeSync?.updatedAt ? formatSyncTime(runtimeSync.updatedAt) : '资料即时同步', icon: 'flashlight', tone: 'blue', action: () => setActiveTab('settings') },
    { label: '总文章数', value: formatCount(totalPosts), delta: '打开文章书房', icon: 'file-text', tone: 'cyan', action: () => openPostsView('all') },
    { label: '草稿箱', value: formatCount(draftPosts), delta: '查看草稿文章', icon: 'draft', tone: 'purple', action: () => openPostsView('draft') },
  ];
  const deploymentPresentation = getDeploymentPresentation(deploymentStatus);

  const quickActions = [
    { label: '写新文章', description: '打开文章编辑入口', icon: 'plus-circle', action: () => setIsCreateDialogOpen(true) },
    { label: '导入 Markdown', description: '上传文档或粘贴公开链接', icon: 'file-up', action: () => setIsImportDialogOpen(true) },
    { label: '上传素材', description: '进入素材库上传图片', icon: 'image-plus', action: () => setActiveTab('media') },
    { label: '修改装扮', description: '同步头像、社交链接和站点信息', icon: 'palette', action: () => setActiveTab('settings') },
    { label: '查看博客', description: '在新窗口打开博客前台', icon: 'external-link', action: () => window.open(blogProfile.url, '_blank', 'noopener,noreferrer') },
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
            <p className="sakura-logo-kicker">内容工作台</p>
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
                          <p className="sakura-eyebrow">工作台 / 概览</p>
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
                                <h2>博客前台发布</h2>
                              </div>
                              <div className="sakura-sync-summary">
                                <span className={cn('sakura-sync-icon', deploymentPresentation.iconClassName)}>
                                  <AppIcon name={deploymentPresentation.icon} className={cn('size-7', deploymentStatus?.state === 'building' && 'animate-spin')} />
                                </span>
                                <div>
                                  <strong>{deploymentPresentation.title}</strong>
                                  <p>{deploymentPresentation.message}</p>
                                </div>
                              </div>
                              <div className="sakura-sync-grid">
                                <button type="button" onClick={() => window.open(blogProfile.url, '_blank', 'noopener,noreferrer')}>
                                  <span>博客前台</span>
                                  <strong>打开检查</strong>
                                  <small>{blogProfile.url}</small>
                                </button>
                                <button type="button" onClick={() => setActiveTab('settings')}>
                                  <span>站点设置</span>
                                  <strong>{runtimeSync?.success ? '已可用' : '待生成'}</strong>
                                  <small>{runtimeSync?.updatedAt ? formatSyncTime(runtimeSync.updatedAt) : runtimeSync?.message || '资料保存后生成'}</small>
                                </button>
                                {deploymentStatus?.detailsUrl && (
                                  <button type="button" onClick={() => window.open(deploymentStatus.detailsUrl, '_blank', 'noopener,noreferrer')}>
                                    <span>部署日志</span>
                                    <strong>{deploymentStatus.state === 'failure' ? '查看失败原因' : '查看构建详情'}</strong>
                                    <small>{deploymentStatus.commitSha.slice(0, 7)}</small>
                                  </button>
                                )}
                              </div>
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
        existingCategories={availableCategories}
        onSuccess={handleCreatePostSuccess}
      />
      <ImportMarkdownDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        existingCategories={availableCategories}
        onSuccess={handleImportPostSuccess}
      />
      <ConfirmActionDialog
        open={Boolean(pendingPostDeletion)}
        onOpenChange={(open) => {
          if (!open) cancelDeletePost();
        }}
        title={`永久删除《${pendingPostDeletion?.title || ''}》？`}
        description="文章会从 GitHub 仓库删除。Cloudflare Pages 部署后，博客前台将不再展示；后台无法恢复。"
        confirmLabel="永久删除文章"
        destructive
        onConfirm={() => void confirmDeletePost()}
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
