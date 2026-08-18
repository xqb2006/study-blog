/**
 * CMS Site Settings API
 *
 * Reads and writes a safe subset of config/site.yaml for the CMS dashboard.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';
import yaml from 'js-yaml';
import { z } from 'zod';
import { CONFIG_PATH } from '@/lib/paths';
import type { RuntimeSyncSummary, SiteSettingsResponse } from '@/types';
import { requestBuildSync } from './build';

const RUNTIME_SETTINGS_RELATIVE_PATH = path.join('runtime', 'site-settings.json');
const RUNTIME_PROFILE_FIELDS = new Set(['alternate', 'author', 'avatar', 'description', 'name', 'subtitle', 'title', 'url']);

const publicImageReferenceSchema = z
  .string()
  .trim()
  .refine(
    (value) => !value || value.startsWith('/img/') || /^https?:\/\//i.test(value),
    'Image references must be public /img paths or http(s) URLs',
  );

const siteSchema = z
  .object({
    title: z.string().optional(),
    alternate: z.string().optional(),
    subtitle: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    avatar: publicImageReferenceSchema.optional(),
    showLogo: z.boolean().optional(),
    author: z.string().optional(),
    url: z.string().optional(),
    defaultOgImage: publicImageReferenceSchema.optional(),
    startYear: z.number().int().min(1990).max(2100).optional(),
    timezone: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  })
  .strict();

const socialItemSchema = z
  .object({
    url: z.string(),
    icon: z.string(),
    color: z.string().optional(),
  })
  .strict();

type NavigationItem = {
  name: string;
  nameKey?: string;
  path?: string;
  icon?: string;
  children?: NavigationItem[];
};

const navigationItemSchema: z.ZodType<NavigationItem> = z.lazy(() =>
  z
    .object({
      name: z.string().min(1),
      nameKey: z.string().optional(),
      path: z.string().optional(),
      icon: z.string().optional(),
      children: z.array(navigationItemSchema).optional(),
    })
    .strict(),
);

const contentSchema = z
  .object({
    addBlankTarget: z.boolean().optional(),
    smoothScroll: z.boolean().optional(),
    addHeadingLevel: z.boolean().optional(),
    enhanceCodeBlock: z.boolean().optional(),
    enableCodeCopy: z.boolean().optional(),
    enableCodeFullscreen: z.boolean().optional(),
    enableLinkEmbed: z.boolean().optional(),
    enableCodePenEmbed: z.boolean().optional(),
    enableTweetEmbed: z.boolean().optional(),
    enableOGPreview: z.boolean().optional(),
    previewCacheTime: z.number().int().min(0).max(365).optional(),
    lazyLoadEmbeds: z.boolean().optional(),
    postCardImagePosition: z.enum(['alternating', 'left', 'right']).optional(),
    enableShokaContainers: z.boolean().optional(),
    enableShokaAttrs: z.boolean().optional(),
    enableShokaEffects: z.boolean().optional(),
    enableShokaSpoiler: z.boolean().optional(),
    enableShokaRuby: z.boolean().optional(),
    enableShokaHexoTags: z.boolean().optional(),
    enableMath: z.boolean().optional(),
    enableCodeMeta: z.boolean().optional(),
    enableQuiz: z.boolean().optional(),
    enableEncryptedBlock: z.boolean().optional(),
  })
  .strict();

const featuredCategorySchema = z
  .object({
    link: z.string().min(1),
    label: z.string().min(1),
    image: z.string().min(1),
    description: z.string().min(1),
  })
  .strict();

const featuredSeriesSchema = z
  .object({
    slug: z.string().min(1),
    categoryName: z.string().min(1),
    label: z.string().optional(),
    fullName: z.string().optional(),
    description: z.string().optional(),
    cover: z.string().optional(),
    enabled: z.boolean().optional(),
    icon: z.string().optional(),
    highlightOnHome: z.boolean().optional(),
    links: z.record(z.string()).optional(),
  })
  .strict();

const friendsSchema = z
  .object({
    intro: z
      .object({
        title: z.string().optional(),
        subtitle: z.string().optional(),
        applyTitle: z.string().optional(),
        applyDesc: z.string().optional(),
        exampleYaml: z.string().optional(),
      })
      .strict()
      .default({}),
    data: z
      .array(
        z
          .object({
            site: z.string().min(1),
            url: z.string().min(1),
            owner: z.string().min(1),
            desc: z.string().min(1),
            image: z.string().min(1),
            color: z.string().optional(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

const announcementSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    content: z.string().min(1),
    type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
    priority: z.number().int().optional(),
    color: z.string().optional(),
    publishDate: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    link: z
      .object({
        url: z.string().min(1),
        text: z.string().min(1),
        external: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const bgmSchema = z
  .object({
    enabled: z.boolean().optional(),
    metingApi: z.string().optional(),
    audio: z
      .array(
        z
          .object({
            title: z.string().min(1),
            list: z.array(z.string().min(1)).default([]),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

const commentSchema = z
  .object({
    provider: z.enum(['none', 'remark42', 'giscus', 'waline', 'twikoo']).default('none'),
    remark42: z
      .object({
        host: z.string().optional(),
        siteId: z.string().optional(),
      })
      .passthrough()
      .optional(),
    giscus: z
      .object({
        repo: z.string().optional(),
        repoId: z.string().optional(),
        category: z.string().optional(),
        categoryId: z.string().optional(),
        mapping: z.string().optional(),
        reactionsEnabled: z.string().optional(),
        emitMetadata: z.string().optional(),
        inputPosition: z.string().optional(),
        lang: z.string().optional(),
        host: z.string().optional(),
        theme: z.string().optional(),
        loading: z.string().optional(),
      })
      .passthrough()
      .optional(),
    waline: z
      .object({
        serverURL: z.string().optional(),
        lang: z.string().optional(),
        dark: z.union([z.string(), z.boolean()]).optional(),
        meta: z.array(z.string()).optional(),
        requiredMeta: z.array(z.string()).optional(),
        login: z.string().optional(),
        wordLimit: z.union([z.number(), z.tuple([z.number(), z.number()])]).optional(),
        pageSize: z.number().optional(),
        imageUploader: z.boolean().optional(),
        highlighter: z.boolean().optional(),
        texRenderer: z.boolean().optional(),
        search: z.boolean().optional(),
        reaction: z.union([z.boolean(), z.array(z.string())]).optional(),
        emoji: z.union([z.boolean(), z.array(z.unknown())]).optional(),
        commentSorting: z.string().optional(),
        noCopyright: z.boolean().optional(),
        comment: z.boolean().optional(),
        pageview: z.boolean().optional(),
        recaptchaV3Key: z.string().optional(),
        turnstileKey: z.string().optional(),
        locale: z.record(z.string()).optional(),
      })
      .passthrough()
      .optional(),
    twikoo: z
      .object({
        envId: z.string().optional(),
        region: z.string().optional(),
        path: z.string().optional(),
        lang: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const analyticsSchema = z
  .object({
    umami: z
      .object({
        enabled: z.boolean().optional(),
        id: z.string().optional(),
        endpoint: z.string().optional(),
        statistics_display: z
          .object({
            token: z.string().optional(),
            article_page_views: z.boolean().optional(),
            footer_site_stats: z.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .passthrough()
      .default({}),
  })
  .passthrough();

const robotsPolicySchema = z
  .object({
    userAgent: z.string().min(1),
    allow: z.union([z.string(), z.array(z.string())]).optional(),
    disallow: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .passthrough();

const seoSchema = z
  .object({
    robots: z
      .object({
        host: z.boolean().optional(),
        policy: z.array(robotsPolicySchema).optional(),
      })
      .passthrough()
      .default({}),
  })
  .passthrough();

const saveSiteSettingsSchema = z
  .object({
    site: siteSchema.optional(),
    social: z.record(socialItemSchema).optional(),
    navigation: z.array(navigationItemSchema).optional(),
    content: contentSchema.optional(),
    categoryMap: z.record(z.string()).optional(),
    featuredCategories: z.array(featuredCategorySchema).optional(),
    featuredSeries: z.array(featuredSeriesSchema).optional(),
    friends: friendsSchema.optional(),
    announcements: z.array(announcementSchema).optional(),
    comment: commentSchema.optional(),
    analytics: analyticsSchema.optional(),
    seo: seoSchema.optional(),
    bgm: bgmSchema.optional(),
  })
  .strict();

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}

function normalizeComparableValue(value: unknown, pathParts: string[] = []): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeComparableValue(item, [...pathParts, String(index)]));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !(pathParts.length === 1 && pathParts[0] === 'site' && RUNTIME_PROFILE_FIELDS.has(key)))
    .filter(([key]) => !(pathParts.length === 0 && key === 'social'))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, normalizeComparableValue(entry, [...pathParts, key])]);

  return Object.fromEntries(entries);
}

function isRuntimeOnlySettingsChange(before: Record<string, unknown>, after: Record<string, unknown>): boolean {
  return JSON.stringify(normalizeComparableValue(before)) === JSON.stringify(normalizeComparableValue(after));
}

async function readSiteConfig(projectRoot: string): Promise<Record<string, unknown>> {
  const configPath = path.join(projectRoot, CONFIG_PATH);
  const raw = await fs.readFile(configPath, 'utf-8');
  return (yaml.load(raw, { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>) || {};
}

async function writeSiteConfig(projectRoot: string, config: Record<string, unknown>): Promise<void> {
  const configPath = path.join(projectRoot, CONFIG_PATH);
  const serialized = yaml.dump(config, {
    lineWidth: -1,
    noRefs: true,
    quotingType: "'",
  });
  await fs.writeFile(configPath, serialized, 'utf-8');
}

async function writeRuntimeSiteSettings(projectRoot: string, config: Record<string, unknown>): Promise<RuntimeSyncSummary> {
  const site = ((config.site as Record<string, unknown>) || {}) as Record<string, unknown>;
  const social = ((config.social as Record<string, unknown>) || {}) as Record<string, unknown>;
  const updatedAt = new Date().toISOString();
  const payload = {
    updatedAt,
    site: {
      title: typeof site.title === 'string' ? site.title : undefined,
      alternate: typeof site.alternate === 'string' ? site.alternate : undefined,
      subtitle: typeof site.subtitle === 'string' ? site.subtitle : undefined,
      name: typeof site.name === 'string' ? site.name : undefined,
      description: typeof site.description === 'string' ? site.description : undefined,
      avatar: typeof site.avatar === 'string' ? site.avatar : undefined,
      author: typeof site.author === 'string' ? site.author : undefined,
      url: typeof site.url === 'string' ? site.url : undefined,
    },
    social,
  };
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  const targets = [
    path.join(projectRoot, 'public', RUNTIME_SETTINGS_RELATIVE_PATH),
    path.join(projectRoot, 'dist', RUNTIME_SETTINGS_RELATIVE_PATH),
  ];

  await Promise.all(
    targets.map(async (targetPath) => {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, serialized, 'utf-8');
    }),
  );

  return {
    success: true,
    path: `/${RUNTIME_SETTINGS_RELATIVE_PATH.split(path.sep).join('/')}`,
    updatedAt,
    message: 'Runtime Sync 已更新',
  };
}

async function readRuntimeSyncSummary(projectRoot: string): Promise<RuntimeSyncSummary> {
  const runtimePath = path.join(projectRoot, 'public', RUNTIME_SETTINGS_RELATIVE_PATH);

  try {
    const [raw, stat] = await Promise.all([fs.readFile(runtimePath, 'utf-8'), fs.stat(runtimePath)]);
    const parsed = JSON.parse(raw) as { updatedAt?: unknown };
    return {
      success: true,
      path: `/${RUNTIME_SETTINGS_RELATIVE_PATH.split(path.sep).join('/')}`,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : stat.mtime.toISOString(),
      message: 'Runtime Sync 可用',
    };
  } catch {
    return {
      success: false,
      path: `/${RUNTIME_SETTINGS_RELATIVE_PATH.split(path.sep).join('/')}`,
      message: 'Runtime Sync 尚未生成',
    };
  }
}

function pickSettings(config: Record<string, unknown>): SiteSettingsResponse['settings'] {
  const comment = ((config.comment as unknown) || {}) as Partial<SiteSettingsResponse['settings']['comment']>;
  const analytics = ((config.analytics as unknown) || {}) as Partial<SiteSettingsResponse['settings']['analytics']>;
  const seo = ((config.seo as unknown) || {}) as Partial<SiteSettingsResponse['settings']['seo']>;

  return {
    site: ((config.site as Record<string, unknown>) || {}) as SiteSettingsResponse['settings']['site'],
    social: ((config.social as Record<string, unknown>) || {}) as SiteSettingsResponse['settings']['social'],
    navigation: (Array.isArray(config.navigation) ? config.navigation : []) as SiteSettingsResponse['settings']['navigation'],
    content: ((config.content as Record<string, unknown>) || {}) as SiteSettingsResponse['settings']['content'],
    categoryMap: ((config.categoryMap as Record<string, string>) || {}) as SiteSettingsResponse['settings']['categoryMap'],
    featuredCategories: (Array.isArray(config.featuredCategories)
      ? config.featuredCategories
      : []) as SiteSettingsResponse['settings']['featuredCategories'],
    featuredSeries: (Array.isArray(config.featuredSeries)
      ? config.featuredSeries
      : []) as SiteSettingsResponse['settings']['featuredSeries'],
    friends: {
      intro: (((config.friends as Record<string, unknown>)?.intro as Record<string, unknown>) || {}) as SiteSettingsResponse['settings']['friends']['intro'],
      data: (Array.isArray((config.friends as Record<string, unknown>)?.data)
        ? (config.friends as { data: unknown[] }).data
        : []) as SiteSettingsResponse['settings']['friends']['data'],
    },
    announcements: (Array.isArray(config.announcements) ? config.announcements : []) as SiteSettingsResponse['settings']['announcements'],
    comment: {
      ...comment,
      provider: comment.provider || 'none',
    } as SiteSettingsResponse['settings']['comment'],
    analytics: {
      ...analytics,
      umami: analytics.umami || {},
    } as SiteSettingsResponse['settings']['analytics'],
    seo: {
      ...seo,
      robots: seo.robots || {},
    } as SiteSettingsResponse['settings']['seo'],
    bgm: {
      ...(((config.bgm as Record<string, unknown>) || {}) as Omit<SiteSettingsResponse['settings']['bgm'], 'audio'>),
      audio: (Array.isArray((config.bgm as Record<string, unknown>)?.audio)
        ? (config.bgm as { audio: unknown[] }).audio
        : []) as SiteSettingsResponse['settings']['bgm']['audio'],
    },
  };
}

/**
 * GET /api/cms/site-settings
 */
export async function getSiteSettingsHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const config = await readSiteConfig(projectRoot);
    return c.json({
      success: true,
      configPath: CONFIG_PATH,
      settings: pickSettings(config),
      runtimeSync: await readRuntimeSyncSummary(projectRoot),
    } satisfies SiteSettingsResponse);
  } catch (error) {
    console.error('[CMS Site Settings API] Read error:', error);
    return c.json({ error: 'Failed to read site settings' }, 500);
  }
}

/**
 * POST /api/cms/site-settings
 */
export async function saveSiteSettingsHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const rawBody = await c.req.json();
    const parseResult = saveSiteSettingsSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map((error) => error.message).join(', ');
      return c.json({ error: errorMessage }, 400);
    }

    const config = await readSiteConfig(projectRoot);
    const originalConfig = cloneConfig(config);
    const patch = parseResult.data;

    if (patch.site) {
      config.site = {
        ...((config.site as Record<string, unknown>) || {}),
        ...stripUndefined(patch.site),
      };
    }

    if (patch.content) {
      config.content = {
        ...((config.content as Record<string, unknown>) || {}),
        ...stripUndefined(patch.content),
      };
    }

    if (patch.social) {
      config.social = patch.social;
    }

    if (patch.navigation) {
      config.navigation = patch.navigation;
    }

    if (patch.categoryMap) {
      config.categoryMap = patch.categoryMap;
    }

    if (patch.featuredCategories) {
      config.featuredCategories = patch.featuredCategories;
    }

    if (patch.featuredSeries) {
      config.featuredSeries = patch.featuredSeries;
    }

    if (patch.friends) {
      config.friends = patch.friends;
    }

    if (patch.announcements) {
      config.announcements = patch.announcements;
    }

    if (patch.comment) {
      config.comment = patch.comment;
    }

    if (patch.analytics) {
      config.analytics = patch.analytics;
    }

    if (patch.seo) {
      config.seo = patch.seo;
    }

    if (patch.bgm) {
      config.bgm = patch.bgm;
    }

    await writeSiteConfig(projectRoot, config);
    const runtimeSync = await writeRuntimeSiteSettings(projectRoot, config);

    if (isRuntimeOnlySettingsChange(originalConfig, config)) {
      return c.json({
        success: true,
        settings: pickSettings(config),
        rebuildStarted: false,
        rebuildMessage: '站点装扮已保存；Runtime Sync 已更新，Public Blog 可即时显示资料变更',
        runtimeSync,
      });
    }

    const buildSync = await requestBuildSync(projectRoot);

    return c.json({
      success: true,
      settings: pickSettings(config),
      rebuildStarted: buildSync.started,
      rebuildMessage: `站点装扮已保存；${runtimeSync.message}；${buildSync.message}`,
      runtimeSync,
      buildSync,
    });
  } catch (error) {
    console.error('[CMS Site Settings API] Save error:', error);
    return c.json({ error: 'Failed to save site settings' }, 500);
  }
}
