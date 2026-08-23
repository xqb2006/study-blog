import { AppIcon } from '@/components/ui/app-icon';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getSiteSettings, saveSiteSettings } from '@/lib/api';
import { normalizeContentSettings } from '@/lib/content-settings';
import { getPublicImageReferenceError } from '@/lib/media-path';
import { normalizeNavigation } from '@/lib/navigation-editor';
import type { SiteSettings, SiteSocialLink } from '@/types';
import { ContentSettingsEditor } from './ContentSettingsEditor';
import { Field, inputClassName, Panel, textareaClassName } from './dashboard/Panel';
import { MediaPathField } from './MediaPathField';
import { NavigationEditor } from './NavigationEditor';

type TextFieldKey = 'title' | 'alternate' | 'subtitle' | 'name' | 'description' | 'author' | 'url' | 'timezone';
type MediaFieldKey = 'avatar' | 'defaultOgImage';

const TEXT_FIELDS: { key: TextFieldKey; label: string; placeholder?: string }[] = [
  { key: 'title', label: '网站标题' },
  { key: 'alternate', label: '备用标题' },
  { key: 'subtitle', label: '副标题' },
  { key: 'name', label: '站点名称' },
  { key: 'author', label: '作者' },
  { key: 'description', label: '网站描述' },
  { key: 'url', label: '网站地址', placeholder: 'https://your-site.pages.dev' },
  { key: 'timezone', label: '时区', placeholder: 'Asia/Shanghai' },
];

const MEDIA_FIELDS: { key: MediaFieldKey; label: string; placeholder?: string; previewShape?: 'cover' | 'avatar' }[] = [
  { key: 'avatar', label: '头像路径', placeholder: '/img/avatar.webp', previewShape: 'avatar' },
  { key: 'defaultOgImage', label: '默认分享图', placeholder: '/img/avatar.webp', previewShape: 'cover' },
];

const SETTINGS_SECTIONS = [
  { id: 'basic', label: '身份资料', description: '标题、头像、简介', icon: 'ri:profile-line' },
  { id: 'social', label: '社交入口', description: '个人资料入口', icon: 'ri:links-line' },
  { id: 'navigation', label: '导航菜单', description: '顶部菜单结构', icon: 'ri:route-line' },
  { id: 'content', label: '内容开关', description: '文章增强开关', icon: 'ri:toggle-line' },
] as const;

type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

function resolvePreviewAsset(value: string, siteUrl: string) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;

  const normalizedSiteUrl = (siteUrl || 'https://your-site.pages.dev').replace(/\/$/, '');
  return value.startsWith('/') ? `${normalizedSiteUrl}${value}` : `${normalizedSiteUrl}/${value}`;
}

function cloneSettings(settings: SiteSettings): SiteSettings {
  return JSON.parse(JSON.stringify(settings)) as SiteSettings;
}

function socialToRows(social: Record<string, SiteSocialLink>) {
  return Object.entries(social).map(([id, value]) => ({
    id,
    url: value.url || '',
    icon: value.icon || '',
    color: value.color || '',
  }));
}

function rowsToSocial(rows: ReturnType<typeof socialToRows>): Record<string, SiteSocialLink> {
  return Object.fromEntries(
    rows
      .filter((row) => row.id.trim() && row.url.trim() && row.icon.trim())
      .map((row) => [
        row.id.trim(),
        {
          url: row.url.trim(),
          icon: row.icon.trim(),
          ...(row.color.trim() ? { color: row.color.trim() } : {}),
        },
      ]),
  );
}

function findSocialRowIndex(rows: ReturnType<typeof socialToRows>, id: string) {
  return rows.findIndex((row) => row.id.trim().toLowerCase() === id);
}

export function SiteSettingsPanel() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [navigationText, setNavigationText] = useState('[]');
  const [keywordText, setKeywordText] = useState('');
  const [socialRows, setSocialRows] = useState<ReturnType<typeof socialToRows>>([]);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('basic');

  const hasSettings = Boolean(settings);
  const previewUrl = settings?.site.url || '/';

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await getSiteSettings();
      const nextSettings = cloneSettings(response.settings);
      setSettings(nextSettings);
      setNavigationText(JSON.stringify(nextSettings.navigation || [], null, 2));
      setKeywordText((nextSettings.site.keywords || []).join('\n'));
      setSocialRows(socialToRows(nextSettings.social || {}));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取站点装扮失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const keywordCount = useMemo(() => keywordText.split('\n').filter((item) => item.trim()).length, [keywordText]);
  const githubUrl = useMemo(() => socialRows.find((row) => row.id.trim().toLowerCase() === 'github')?.url || '', [socialRows]);

  const updateGithubUrl = (value: string) => {
    setSocialRows((rows) => {
      const index = findSocialRowIndex(rows, 'github');
      if (index >= 0) {
        return rows.map((row, rowIndex) => (rowIndex === index ? { ...row, id: 'github', url: value, icon: row.icon || 'ri:github-fill' } : row));
      }

      return [...rows, { id: 'github', url: value, icon: 'ri:github-fill', color: '#181717' }];
    });
  };

  const updateSiteField = (key: TextFieldKey, value: string) => {
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        site: {
          ...current.site,
          [key]: value,
        },
      };
    });
  };

  const updateMediaField = (key: MediaFieldKey, value: string) => {
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        site: {
          ...current.site,
          [key]: value,
        },
      };
    });
  };

  const handleSave = async () => {
    if (!settings) return;

    for (const field of MEDIA_FIELDS) {
      const error = getPublicImageReferenceError(String(settings.site[field.key] || ''));
      if (error) {
        toast.error(`${field.label}：${error}`);
        setActiveSection('basic');
        return;
      }
    }

    setIsSaving(true);
    try {
      const navigation = normalizeNavigation(settings.navigation || []);
      const payload: SiteSettings = {
        ...settings,
        content: normalizeContentSettings(settings.content || {}),
        site: {
          ...settings.site,
          keywords: keywordText
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
        },
        social: rowsToSocial(socialRows),
        navigation,
      };

      const response = await saveSiteSettings(payload);
      const nextSettings = cloneSettings(response.settings);
      setSettings(nextSettings);
      setNavigationText(JSON.stringify(nextSettings.navigation || [], null, 2));
      setKeywordText((nextSettings.site.keywords || []).join('\n'));
      setSocialRows(socialToRows(nextSettings.social || {}));
      window.dispatchEvent(
        new CustomEvent('cms:site-settings-saved', {
          detail: {
            settings: nextSettings,
            runtimeSync: response.runtimeSync,
          },
        }),
      );
      toast.success(response.rebuildMessage || '站点装扮已保存，正在同步博客');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存站点装扮失败');
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

  if (!hasSettings || !settings) {
    return (
      <Panel title="站点装扮">
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <AppIcon name="ri:error-warning-line" className="size-10 text-destructive" />
          <p className="text-muted-foreground text-sm">没有读取到 config/site.yaml。</p>
          <Button variant="outline" onClick={loadSettings}>
            重新读取
          </Button>
        </div>
      </Panel>
    );
  }

  const avatarPreview = resolvePreviewAsset(String(settings.site.avatar || '/img/avatar.webp'), previewUrl);

  return (
    <div className="sakura-settings-workspace">
      <div className="sakura-settings-header">
        <div>
          <h1>站点装扮</h1>
          <p>同步博客标题、头像、导航、社交链接和内容增强开关。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSettings} disabled={isSaving}>
            <AppIcon name="ri:refresh-line" className="mr-1.5 size-4" />
            重新读取
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="sakura-primary-action">
            <AppIcon name={isSaving ? 'ri:loader-4-line' : 'ri:save-line'} className={isSaving ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
            保存设置
          </Button>
        </div>
      </div>

      <div className="sakura-settings-layout">
        <aside className="sakura-settings-nav" aria-label="站点装扮分区">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={activeSection === section.id ? 'is-active' : undefined}
            >
              <AppIcon name={section.icon} className="size-5" />
              <span>
                <strong>{section.label}</strong>
                <small>{section.description}</small>
              </span>
            </button>
          ))}

          <div className="sakura-settings-preview">
            <img src={avatarPreview} alt="" />
            <div>
              <strong>{settings.site.title || settings.site.name || '我的博客'}</strong>
              <span>{settings.site.author || '你的名字'}</span>
            </div>
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <AppIcon name="ri:external-link-line" className="size-4" />
              打开博客
            </a>
          </div>
        </aside>

        <div className="sakura-settings-content">
          {activeSection === 'basic' && (
            <Panel title="身份资料" description="这些内容会影响博客资料展示。头像支持素材库路径，也支持公开 http(s) 图片地址。">
              <div className="sakura-basic-fields">
                {TEXT_FIELDS.map((field) => (
                  <Field key={field.key} label={field.label}>
                    <input
                      value={String(settings.site[field.key] || '')}
                      onChange={(event) => updateSiteField(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      className={inputClassName}
                    />
                  </Field>
                ))}

                {MEDIA_FIELDS.map((field) => (
                  <Field key={field.key} label={field.label}>
                    <MediaPathField
                      value={String(settings.site[field.key] || '')}
                      onChange={(value) => updateMediaField(field.key, value)}
                      placeholder={field.placeholder}
                      previewShape={field.previewShape}
                      dialogTitle={`选择${field.label.replace('路径', '')}`}
                    />
                  </Field>
                ))}

                <Field label="建站年份">
                  <input
                    type="number"
                    value={settings.site.startYear || ''}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              site: {
                                ...current.site,
                                startYear: event.target.value ? Number(event.target.value) : undefined,
                              },
                            }
                          : current,
                      )
                    }
                    className={inputClassName}
                  />
                </Field>

                <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={settings.site.showLogo !== false}
                    onChange={(event) =>
                      setSettings((current) =>
                        current ? { ...current, site: { ...current.site, showLogo: event.target.checked } } : current,
                      )
                    }
                    className="size-4"
                  />
                  <span className="text-sm">显示 Logo</span>
                </label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_240px]">
                <Field label={`SEO 关键词（${keywordCount} 个）`} description="每行一个关键词。">
                  <textarea
                    value={keywordText}
                    onChange={(event) => setKeywordText(event.target.value)}
                    rows={4}
                    className={textareaClassName}
                  />
                </Field>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="font-medium text-sm">当前预览地址</p>
                  <a href={previewUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary text-sm">
                    <AppIcon name="ri:external-link-line" className="size-4" />
                    {previewUrl}
                  </a>
                  <p className="mt-3 text-muted-foreground text-xs">身份资料会写入即时资料同步；静态结构变更会进入发布同步。</p>
                </div>
              </div>
            </Panel>
          )}

          {activeSection === 'social' && (
            <Panel
              title="社交入口"
              description="显示在个人信息、页脚等位置。id 例如 github、email、rss。"
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSocialRows((rows) => [...rows, { id: '', url: '', icon: 'ri:link', color: '' }])}
                >
                  <AppIcon name="ri:add-line" className="mr-1.5 size-4" />
                  添加
                </Button>
              }
            >
              <div className="sakura-github-sync">
                <span>
                  <AppIcon name="ri:github-fill" className="size-5" />
                </span>
                <Field label="GitHub 地址">
                  <input
                    value={githubUrl}
                    onChange={(event) => updateGithubUrl(event.target.value)}
                    placeholder="粘贴 GitHub 主页地址"
                    className={inputClassName}
                  />
                </Field>
              </div>

              <div className="space-y-3">
                {socialRows.map((row, index) => (
                  <div key={`${row.id}-${index}`} className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 md:grid-cols-[140px_1fr_190px_120px_auto]">
                    <input
                      value={row.id}
                      onChange={(event) =>
                        setSocialRows((rows) => rows.map((item, itemIndex) => (itemIndex === index ? { ...item, id: event.target.value } : item)))
                      }
                      placeholder="id"
                      className={inputClassName}
                    />
                    <input
                      value={row.url}
                      onChange={(event) =>
                        setSocialRows((rows) => rows.map((item, itemIndex) => (itemIndex === index ? { ...item, url: event.target.value } : item)))
                      }
                      placeholder="链接"
                      className={inputClassName}
                    />
                    <input
                      value={row.icon}
                      onChange={(event) =>
                        setSocialRows((rows) => rows.map((item, itemIndex) => (itemIndex === index ? { ...item, icon: event.target.value } : item)))
                      }
                      placeholder="ri:github-fill"
                      className={inputClassName}
                    />
                    <input
                      value={row.color}
                      onChange={(event) =>
                        setSocialRows((rows) => rows.map((item, itemIndex) => (itemIndex === index ? { ...item, color: event.target.value } : item)))
                      }
                      placeholder="#55acd5"
                      className={inputClassName}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSocialRows((rows) => rows.filter((_, itemIndex) => itemIndex !== index))}
                      title="删除社交链接"
                    >
                      <AppIcon name="ri:delete-bin-line" className="size-4" />
                    </Button>
                  </div>
                ))}
                {socialRows.length === 0 && <p className="text-muted-foreground text-sm">暂无社交链接。</p>}
              </div>
            </Panel>
          )}

          {activeSection === 'navigation' && (
            <Panel title="导航菜单" description="保留 JSON 编辑，适合批量调整多级菜单；格式错误不会保存。">
              <NavigationEditor
                value={settings.navigation || []}
                rawText={navigationText}
                onRawTextChange={setNavigationText}
                onChange={(navigation) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          navigation: normalizeNavigation(navigation),
                        }
                      : current,
                  )
                }
              />
            </Panel>
          )}

          {activeSection === 'content' && (
            <Panel title="内容开关" description="控制文章渲染、代码块、链接预览、数学公式等功能。">
              <ContentSettingsEditor
                value={settings.content || {}}
                onChange={(content) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          content,
                        }
                      : current,
                  )
                }
              />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
