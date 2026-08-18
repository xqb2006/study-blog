import { AppIcon } from '@/components/ui/app-icon';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getSiteSettings, saveSiteSettings } from '@/lib/api';
import type { AnalyticsSettings, CommentProvider, CommentSettings, RobotsPolicy, SeoSettings } from '@/types';
import { Field, inputClassName, Panel } from './dashboard/Panel';

const COMMENT_PROVIDERS: { value: CommentProvider; label: string }[] = [
  { value: 'none', label: '关闭评论' },
  { value: 'twikoo', label: 'Twikoo' },
  { value: 'giscus', label: 'Giscus' },
  { value: 'waline', label: 'Waline' },
  { value: 'remark42', label: 'Remark42' },
];

const GISCUS_FIELDS: { key: keyof NonNullable<CommentSettings['giscus']>; placeholder: string }[] = [
  { key: 'repo', placeholder: 'owner/repo' },
  { key: 'repoId', placeholder: 'R_kgDO...' },
  { key: 'category', placeholder: 'Announcements' },
  { key: 'categoryId', placeholder: 'DIC_kwDO...' },
  { key: 'mapping', placeholder: 'pathname' },
  { key: 'reactionsEnabled', placeholder: '1' },
  { key: 'emitMetadata', placeholder: '0' },
  { key: 'inputPosition', placeholder: 'top' },
  { key: 'lang', placeholder: 'zh-CN' },
  { key: 'theme', placeholder: 'light' },
  { key: 'loading', placeholder: 'lazy' },
];

const WALINE_SWITCHES: { key: keyof NonNullable<CommentSettings['waline']>; label: string }[] = [
  { key: 'imageUploader', label: '图片上传' },
  { key: 'highlighter', label: '代码高亮' },
  { key: 'texRenderer', label: 'LaTeX' },
  { key: 'search', label: '搜索' },
  { key: 'noCopyright', label: '隐藏版权' },
  { key: 'comment', label: '评论数' },
  { key: 'pageview', label: '访问量' },
];

const DEFAULT_COMMENT: CommentSettings = {
  provider: 'none',
  remark42: {},
  giscus: {},
  waline: {},
  twikoo: {},
};

const DEFAULT_ANALYTICS: AnalyticsSettings = {
  umami: {
    enabled: false,
    id: '',
    endpoint: '',
    statistics_display: {},
  },
};

const DEFAULT_SEO: SeoSettings = {
  robots: {
    host: undefined,
    policy: [],
  },
};

function cloneComment(value?: CommentSettings): CommentSettings {
  return {
    ...DEFAULT_COMMENT,
    ...(JSON.parse(JSON.stringify(value || {})) as Partial<CommentSettings>),
  };
}

function cloneAnalytics(value?: AnalyticsSettings): AnalyticsSettings {
  return {
    umami: {
      ...DEFAULT_ANALYTICS.umami,
      ...(JSON.parse(JSON.stringify(value?.umami || {})) as AnalyticsSettings['umami']),
    },
  };
}

function cloneSeo(value?: SeoSettings): SeoSettings {
  return {
    robots: {
      ...DEFAULT_SEO.robots,
      ...(JSON.parse(JSON.stringify(value?.robots || {})) as SeoSettings['robots']),
      policy: Array.isArray(value?.robots?.policy) ? JSON.parse(JSON.stringify(value.robots.policy)) : [],
    },
  };
}

function normalizeList(value?: string | string[]): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeComment(comment: CommentSettings): CommentSettings {
  return {
    provider: comment.provider,
    remark42: {
      ...(comment.remark42?.host?.trim() ? { host: comment.remark42.host.trim() } : {}),
      ...(comment.remark42?.siteId?.trim() ? { siteId: comment.remark42.siteId.trim() } : {}),
    },
    giscus: {
      ...(comment.giscus?.repo?.trim() ? { repo: comment.giscus.repo.trim() } : {}),
      ...(comment.giscus?.repoId?.trim() ? { repoId: comment.giscus.repoId.trim() } : {}),
      ...(comment.giscus?.category?.trim() ? { category: comment.giscus.category.trim() } : {}),
      ...(comment.giscus?.categoryId?.trim() ? { categoryId: comment.giscus.categoryId.trim() } : {}),
      ...(comment.giscus?.mapping?.trim() ? { mapping: comment.giscus.mapping.trim() } : {}),
      ...(comment.giscus?.reactionsEnabled?.trim() ? { reactionsEnabled: comment.giscus.reactionsEnabled.trim() } : {}),
      ...(comment.giscus?.emitMetadata?.trim() ? { emitMetadata: comment.giscus.emitMetadata.trim() } : {}),
      ...(comment.giscus?.inputPosition?.trim() ? { inputPosition: comment.giscus.inputPosition.trim() } : {}),
      ...(comment.giscus?.lang?.trim() ? { lang: comment.giscus.lang.trim() } : {}),
      ...(comment.giscus?.host?.trim() ? { host: comment.giscus.host.trim() } : {}),
      ...(comment.giscus?.theme?.trim() ? { theme: comment.giscus.theme.trim() } : {}),
      ...(comment.giscus?.loading?.trim() ? { loading: comment.giscus.loading.trim() } : {}),
    },
    waline: {
      ...(comment.waline?.serverURL?.trim() ? { serverURL: comment.waline.serverURL.trim() } : {}),
      ...(comment.waline?.lang?.trim() ? { lang: comment.waline.lang.trim() } : {}),
      ...(comment.waline?.dark !== undefined && comment.waline.dark !== '' ? { dark: comment.waline.dark } : {}),
      ...(comment.waline?.meta?.length ? { meta: comment.waline.meta.map((item) => item.trim()).filter(Boolean) } : {}),
      ...(comment.waline?.requiredMeta?.length ? { requiredMeta: comment.waline.requiredMeta.map((item) => item.trim()).filter(Boolean) } : {}),
      ...(comment.waline?.login?.trim() ? { login: comment.waline.login.trim() } : {}),
      ...(comment.waline?.wordLimit !== undefined ? { wordLimit: comment.waline.wordLimit } : {}),
      ...(comment.waline?.pageSize !== undefined ? { pageSize: comment.waline.pageSize } : {}),
      imageUploader: comment.waline?.imageUploader === true,
      highlighter: comment.waline?.highlighter !== false,
      texRenderer: comment.waline?.texRenderer === true,
      search: comment.waline?.search === true,
      noCopyright: comment.waline?.noCopyright === true,
      comment: comment.waline?.comment !== false,
      pageview: comment.waline?.pageview !== false,
    },
    twikoo: {
      ...(comment.twikoo?.envId?.trim() ? { envId: comment.twikoo.envId.trim() } : {}),
      ...(comment.twikoo?.region?.trim() ? { region: comment.twikoo.region.trim() } : {}),
      ...(comment.twikoo?.path?.trim() ? { path: comment.twikoo.path.trim() } : {}),
      ...(comment.twikoo?.lang?.trim() ? { lang: comment.twikoo.lang.trim() } : {}),
    },
  };
}

function normalizeAnalytics(analytics: AnalyticsSettings): AnalyticsSettings {
  return {
    umami: {
      enabled: analytics.umami.enabled === true,
      ...(analytics.umami.id?.trim() ? { id: analytics.umami.id.trim() } : {}),
      ...(analytics.umami.endpoint?.trim() ? { endpoint: analytics.umami.endpoint.trim() } : {}),
      statistics_display: {
        ...(analytics.umami.statistics_display?.token?.trim() ? { token: analytics.umami.statistics_display.token.trim() } : {}),
        article_page_views: analytics.umami.statistics_display?.article_page_views === true,
        footer_site_stats: analytics.umami.statistics_display?.footer_site_stats === true,
      },
    },
  };
}

function normalizeSeo(seo: SeoSettings): SeoSettings {
  return {
    robots: {
      ...(seo.robots.host !== undefined ? { host: seo.robots.host } : {}),
      policy: (seo.robots.policy || [])
        .filter((policy) => policy.userAgent.trim())
        .map((policy) => ({
          userAgent: policy.userAgent.trim(),
          ...(normalizeList(policy.allow).length ? { allow: normalizeList(policy.allow) } : {}),
          ...(normalizeList(policy.disallow).length ? { disallow: normalizeList(policy.disallow) } : {}),
        })),
    },
  };
}

export function OperationsPanel() {
  const [comment, setComment] = useState<CommentSettings>(DEFAULT_COMMENT);
  const [analytics, setAnalytics] = useState<AnalyticsSettings>(DEFAULT_ANALYTICS);
  const [seo, setSeo] = useState<SeoSettings>(DEFAULT_SEO);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await getSiteSettings();
      setComment(cloneComment(response.settings.comment));
      setAnalytics(cloneAnalytics(response.settings.analytics));
      setSeo(cloneSeo(response.settings.seo));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取运营配置失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateCommentProvider = (provider: CommentProvider) => {
    setComment((current) => ({ ...current, provider }));
  };

  const updateRobotsPolicy = (index: number, patch: Partial<RobotsPolicy>) => {
    setSeo((current) => ({
      ...current,
      robots: {
        ...current.robots,
        policy: (current.robots.policy || []).map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await saveSiteSettings({
        comment: normalizeComment(comment),
        analytics: normalizeAnalytics(analytics),
        seo: normalizeSeo(seo),
      });
      setComment(cloneComment(response.settings.comment));
      setAnalytics(cloneAnalytics(response.settings.analytics));
      setSeo(cloneSeo(response.settings.seo));
      toast.success('运营配置已保存');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存运营配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <AppIcon name="ri:loader-4-line" className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">运营设置</h1>
          <p className="mt-1 text-muted-foreground text-sm">管理评论系统、Umami 统计展示和 robots SEO 策略。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSettings} disabled={isSaving}>
            <AppIcon name="ri:refresh-line" className="mr-1.5 size-4" />
            重新读取
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <AppIcon name={isSaving ? 'ri:loader-4-line' : 'ri:save-line'} className={isSaving ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
            保存配置
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel>
          <div>
            <p className="font-semibold text-xl">{COMMENT_PROVIDERS.find((item) => item.value === comment.provider)?.label || comment.provider}</p>
            <p className="text-muted-foreground text-sm">评论系统</p>
          </div>
        </Panel>
        <Panel>
          <div>
            <p className="font-semibold text-xl">{analytics.umami.enabled ? '已启用' : '已关闭'}</p>
            <p className="text-muted-foreground text-sm">Umami 统计</p>
          </div>
        </Panel>
        <Panel>
          <div>
            <p className="font-semibold text-xl">{seo.robots.policy?.length || 0}</p>
            <p className="text-muted-foreground text-sm">robots 策略</p>
          </div>
        </Panel>
      </div>

      <Panel title="评论系统" description="切换 provider 不会清空其它评论系统配置，保存后会进入发布同步。">
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <Field label="评论提供商">
            <select value={comment.provider} onChange={(event) => updateCommentProvider(event.target.value as CommentProvider)} className={inputClassName}>
              {COMMENT_PROVIDERS.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-muted-foreground text-sm">
            当前前台会使用 <span className="font-medium text-foreground">{COMMENT_PROVIDERS.find((item) => item.value === comment.provider)?.label}</span>。
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Panel title="Twikoo">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="envId">
                <input value={comment.twikoo?.envId || ''} onChange={(event) => setComment((current) => ({ ...current, twikoo: { ...current.twikoo, envId: event.target.value } }))} className={inputClassName} />
              </Field>
              <Field label="region">
                <input value={comment.twikoo?.region || ''} onChange={(event) => setComment((current) => ({ ...current, twikoo: { ...current.twikoo, region: event.target.value } }))} placeholder="ap-shanghai" className={inputClassName} />
              </Field>
              <Field label="path">
                <input value={comment.twikoo?.path || ''} onChange={(event) => setComment((current) => ({ ...current, twikoo: { ...current.twikoo, path: event.target.value } }))} placeholder="location.pathname" className={inputClassName} />
              </Field>
              <Field label="lang">
                <input value={comment.twikoo?.lang || ''} onChange={(event) => setComment((current) => ({ ...current, twikoo: { ...current.twikoo, lang: event.target.value } }))} placeholder="zh-CN" className={inputClassName} />
              </Field>
            </div>
          </Panel>

          <Panel title="Giscus">
            <div className="grid gap-3 md:grid-cols-2">
              {GISCUS_FIELDS.map(({ key, placeholder }) => (
                <Field key={key} label={key}>
                  <input
                    value={String(comment.giscus?.[key] || '')}
                    onChange={(event) =>
                      setComment((current) => ({
                        ...current,
                        giscus: { ...current.giscus, [key]: event.target.value },
                      }))
                    }
                    placeholder={placeholder}
                    className={inputClassName}
                  />
                </Field>
              ))}
            </div>
          </Panel>

          <Panel title="Waline">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="serverURL">
                <input value={comment.waline?.serverURL || ''} onChange={(event) => setComment((current) => ({ ...current, waline: { ...current.waline, serverURL: event.target.value } }))} className={inputClassName} />
              </Field>
              <Field label="lang">
                <input value={comment.waline?.lang || ''} onChange={(event) => setComment((current) => ({ ...current, waline: { ...current.waline, lang: event.target.value } }))} placeholder="zh-CN" className={inputClassName} />
              </Field>
              <Field label="login">
                <input value={comment.waline?.login || ''} onChange={(event) => setComment((current) => ({ ...current, waline: { ...current.waline, login: event.target.value } }))} placeholder="enable" className={inputClassName} />
              </Field>
              <Field label="pageSize">
                <input
                  type="number"
                  value={comment.waline?.pageSize || ''}
                  onChange={(event) => setComment((current) => ({ ...current, waline: { ...current.waline, pageSize: event.target.value ? Number(event.target.value) : undefined } }))}
                  className={inputClassName}
                />
              </Field>
              <Field label="meta 字段" description="逗号分隔，例如 nick,mail,link。">
                <input
                  value={(comment.waline?.meta || []).join(',')}
                  onChange={(event) => setComment((current) => ({ ...current, waline: { ...current.waline, meta: event.target.value.split(',') } }))}
                  className={inputClassName}
                />
              </Field>
              <Field label="requiredMeta" description="逗号分隔。">
                <input
                  value={(comment.waline?.requiredMeta || []).join(',')}
                  onChange={(event) => setComment((current) => ({ ...current, waline: { ...current.waline, requiredMeta: event.target.value.split(',') } }))}
                  className={inputClassName}
                />
              </Field>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {WALINE_SWITCHES.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(comment.waline?.[key])}
                    onChange={(event) => setComment((current) => ({ ...current, waline: { ...current.waline, [key]: event.target.checked } }))}
                    className="size-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </Panel>

          <Panel title="Remark42">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="host">
                <input value={comment.remark42?.host || ''} onChange={(event) => setComment((current) => ({ ...current, remark42: { ...current.remark42, host: event.target.value } }))} className={inputClassName} />
              </Field>
              <Field label="siteId">
                <input value={comment.remark42?.siteId || ''} onChange={(event) => setComment((current) => ({ ...current, remark42: { ...current.remark42, siteId: event.target.value } }))} className={inputClassName} />
              </Field>
            </div>
          </Panel>
        </div>
      </Panel>

      <Panel title="Umami 统计" description="控制统计脚本和前台访问量展示。">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
            <input
              type="checkbox"
              checked={analytics.umami.enabled === true}
              onChange={(event) => setAnalytics((current) => ({ ...current, umami: { ...current.umami, enabled: event.target.checked } }))}
              className="size-4"
            />
            <span className="text-sm">启用 Umami</span>
          </label>
          <Field label="网站 ID">
            <input value={analytics.umami.id || ''} onChange={(event) => setAnalytics((current) => ({ ...current, umami: { ...current.umami, id: event.target.value } }))} className={inputClassName} />
          </Field>
          <Field label="统计服务地址">
            <input value={analytics.umami.endpoint || ''} onChange={(event) => setAnalytics((current) => ({ ...current, umami: { ...current.umami, endpoint: event.target.value } }))} className={inputClassName} />
          </Field>
          <Field label="分享 Token">
            <input
              value={analytics.umami.statistics_display?.token || ''}
              onChange={(event) =>
                setAnalytics((current) => ({
                  ...current,
                  umami: {
                    ...current.umami,
                    statistics_display: { ...current.umami.statistics_display, token: event.target.value },
                  },
                }))
              }
              className={inputClassName}
            />
          </Field>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
            <input
              type="checkbox"
              checked={analytics.umami.statistics_display?.article_page_views === true}
              onChange={(event) =>
                setAnalytics((current) => ({
                  ...current,
                  umami: {
                    ...current.umami,
                    statistics_display: { ...current.umami.statistics_display, article_page_views: event.target.checked },
                  },
                }))
              }
              className="size-4"
            />
            <span className="text-sm">文章页显示访问量</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
            <input
              type="checkbox"
              checked={analytics.umami.statistics_display?.footer_site_stats === true}
              onChange={(event) =>
                setAnalytics((current) => ({
                  ...current,
                  umami: {
                    ...current.umami,
                    statistics_display: { ...current.umami.statistics_display, footer_site_stats: event.target.checked },
                  },
                }))
              }
              className="size-4"
            />
            <span className="text-sm">页脚显示全站统计</span>
          </label>
        </div>
      </Panel>

      <Panel
        title="robots SEO"
        description="控制 robots.txt 生成策略。空策略表示使用默认允许规则。"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setSeo((current) => ({
                ...current,
                robots: {
                  ...current.robots,
                  policy: [...(current.robots.policy || []), { userAgent: '*', allow: ['/'], disallow: [] }],
                },
              }))
            }
          >
            <AppIcon name="ri:add-line" className="mr-1.5 size-4" />
            添加策略
          </Button>
        }
      >
        <div className="space-y-3">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
            <input
              type="checkbox"
              checked={seo.robots.host === true}
              onChange={(event) => setSeo((current) => ({ ...current, robots: { ...current.robots, host: event.target.checked } }))}
              className="size-4"
            />
            <span className="text-sm">添加 Host 指令</span>
          </label>
          {(seo.robots.policy || []).map((policy, index) => (
            <article key={`${policy.userAgent}-${index}`} className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-medium text-sm">策略 {index + 1}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setSeo((current) => ({
                      ...current,
                      robots: {
                        ...current.robots,
                        policy: (current.robots.policy || []).filter((_, itemIndex) => itemIndex !== index),
                      },
                    }))
                  }
                  title="删除策略"
                >
                  <AppIcon name="ri:delete-bin-line" className="size-4" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="User Agent">
                  <input value={policy.userAgent} onChange={(event) => updateRobotsPolicy(index, { userAgent: event.target.value })} placeholder="*" className={inputClassName} />
                </Field>
                <Field label="允许路径" description="逗号分隔。">
                  <input value={normalizeList(policy.allow).join(',')} onChange={(event) => updateRobotsPolicy(index, { allow: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="/" className={inputClassName} />
                </Field>
                <Field label="禁止路径" description="逗号分隔。">
                  <input value={normalizeList(policy.disallow).join(',')} onChange={(event) => updateRobotsPolicy(index, { disallow: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="/api/" className={inputClassName} />
                </Field>
              </div>
            </article>
          ))}
          {(!seo.robots.policy || seo.robots.policy.length === 0) && <p className="text-muted-foreground text-sm">暂无自定义 robots 策略。</p>}
        </div>
      </Panel>
    </div>
  );
}
