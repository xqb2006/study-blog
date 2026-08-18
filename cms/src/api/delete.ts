/**
 * CMS Delete API Handler
 *
 * Moves a blog post out of the content directory into a recoverable trash folder.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type { Context } from 'hono';
import yaml from 'js-yaml';
import { slugify } from 'transliteration';
import { z } from 'zod';
import { CONFIG_PATH, CONTENT_DIR } from '@/lib/paths';
import { hasValidMarkdownExtension, isPathSafe } from '@/lib/validation';
import type { DeletePostResponse } from '@/types';
import { requestBuildSync } from './build';

/** Zod schema for delete post request validation */
const deletePostRequestSchema = z.object({
  postId: z.string().min(1, 'postId is required'),
});

function createTrashTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

async function getAllMarkdownFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getAllMarkdownFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      files.push(path.relative(baseDir, fullPath));
    }
  }

  return files;
}

async function readPostLink(contentDir: string, postId: string): Promise<string | undefined> {
  const fileContent = await fs.readFile(path.join(contentDir, postId), 'utf-8');
  const { data } = matter(fileContent, {
    engines: {
      yaml: {
        parse: (str) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as object,
        stringify: (obj) => yaml.dump(obj),
      },
    },
  });

  return typeof data.link === 'string' && data.link.trim() ? data.link.trim() : undefined;
}

type I18nSettings = {
  defaultLocale: string;
  localeList: string[];
  allKnownLocales: Set<string>;
  enableSlugTransliteration: boolean;
};

async function readI18nSettings(projectRoot: string): Promise<I18nSettings> {
  const fallbackSettings: I18nSettings = {
    defaultLocale: 'zh',
    localeList: ['zh', 'en', 'ja'],
    allKnownLocales: new Set(['zh', 'en', 'ja']),
    enableSlugTransliteration: false,
  };

  try {
    const configPath = path.join(projectRoot, CONFIG_PATH);
    const rawConfig = await fs.readFile(configPath, 'utf-8');
    const parsed = yaml.load(rawConfig) as
      | {
          site?: {
            enableSlugTransliteration?: unknown;
          };
          i18n?: {
            defaultLocale?: unknown;
            locales?: { code?: unknown; enabled?: unknown }[];
          };
        }
      | undefined;

    const defaultLocale =
      typeof parsed?.i18n?.defaultLocale === 'string' && parsed.i18n.defaultLocale.trim()
        ? parsed.i18n.defaultLocale.trim()
        : 'zh';
    const allKnownLocales =
      parsed?.i18n?.locales
        ?.filter((locale) => typeof locale.code === 'string' && locale.code.trim())
        .map((locale) => String(locale.code).trim()) ?? [];
    const localeList =
      parsed?.i18n?.locales
        ?.filter((locale) => typeof locale.code === 'string' && locale.code.trim() && locale.enabled !== false)
        .map((locale) => String(locale.code).trim()) ?? [];

    return {
      defaultLocale,
      localeList: localeList.length ? localeList : [defaultLocale],
      allKnownLocales: new Set(allKnownLocales.length ? allKnownLocales : [defaultLocale, 'en', 'ja']),
      enableSlugTransliteration: parsed?.site?.enableSlugTransliteration === true,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[CMS Delete API] Failed to read i18n config, using defaults:', error);
    }

    return fallbackSettings;
  }
}

function encodeSlug(slug: string): string {
  return slug.split('/').map(encodeURIComponent).join('/');
}

function transliterateSlug(slug: string, settings: I18nSettings): string {
  if (!settings.enableSlugTransliteration) return slug;
  return slugify(slug, { allowedChars: 'a-zA-Z0-9-_.~/', separator: '-' });
}

function getPostLocaleInfo(postId: string, settings: I18nSettings): { locale: string; localeFreeSlug: string } {
  const normalizedPostId = postId.split(path.sep).join('/');
  const withoutExtension = normalizedPostId.replace(/\.(md|mdx)$/i, '');
  const [firstSegment, ...restSegments] = withoutExtension.split('/');

  if (
    firstSegment &&
    firstSegment !== settings.defaultLocale &&
    settings.allKnownLocales.has(firstSegment) &&
    restSegments.length > 0
  ) {
    return {
      locale: firstSegment,
      localeFreeSlug: restSegments.join('/'),
    };
  }

  return {
    locale: settings.defaultLocale,
    localeFreeSlug: withoutExtension,
  };
}

function getPostRoutes(postId: string, postLink: string | undefined, settings: I18nSettings): string[] {
  const { locale, localeFreeSlug } = getPostLocaleInfo(postId, settings);
  const slug = postLink?.trim() ? postLink.trim() : transliterateSlug(localeFreeSlug, settings);
  const encodedSlug = encodeSlug(slug);
  const routeLocales = locale === settings.defaultLocale ? settings.localeList : [locale];

  return routeLocales.map((routeLocale) => {
    const prefix = routeLocale === settings.defaultLocale ? '' : `/${routeLocale}`;
    return `${prefix}/post/${encodedSlug}/`;
  });
}

function getPostPageDirs(projectRoot: string, postId: string, postLink: string | undefined, settings: I18nSettings): string[] {
  return getPostRoutes(postId, postLink, settings).map((route) => path.join(projectRoot, 'dist', ...route.split('/').filter(Boolean)));
}

async function writeDeletedRoutesManifest(projectRoot: string, deletedRoutes: string[]): Promise<void> {
  if (!deletedRoutes.length) return;

  const manifestPath = path.join(projectRoot, 'dist', 'deleted-posts.json');
  let existingRoutes: string[] = [];

  try {
    const existing = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as { routes?: unknown };
    if (Array.isArray(existing.routes)) {
      existingRoutes = existing.routes.filter((route): route is string => typeof route === 'string');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[CMS Delete API] Failed to read deleted routes manifest, recreating it:', error);
    }
  }

  const routes = [...new Set([...existingRoutes, ...deletedRoutes])].sort();
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        routes,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    'utf-8',
  );
}

async function clearPublishedPostPages(
  projectRoot: string,
  contentDir: string,
  postIds: string[],
): Promise<{ clearedPagePaths: string[]; deletedRoutes: string[] }> {
  const settings = await readI18nSettings(projectRoot);
  const clearedPages: string[] = [];
  const deletedRoutes: string[] = [];

  for (const postId of postIds) {
    let postLink: string | undefined;
    try {
      postLink = await readPostLink(contentDir, postId);
    } catch (error) {
      console.warn(`[CMS Delete API] Failed to read post link before clearing dist page ${postId}:`, error);
    }

    deletedRoutes.push(...getPostRoutes(postId, postLink, settings));

    for (const pageDir of getPostPageDirs(projectRoot, postId, postLink, settings)) {
      const resolvedDistRoot = path.resolve(projectRoot, 'dist');
      const resolvedPageDir = path.resolve(pageDir);

      if (!resolvedPageDir.startsWith(`${resolvedDistRoot}${path.sep}`)) {
        console.warn(`[CMS Delete API] Refused to clear page outside dist: ${resolvedPageDir}`);
        continue;
      }

      await fs.rm(pageDir, { recursive: true, force: true });
      clearedPages.push(path.relative(projectRoot, pageDir).split(path.sep).join('/'));
    }
  }

  const uniqueDeletedRoutes = [...new Set(deletedRoutes)];
  await writeDeletedRoutesManifest(projectRoot, uniqueDeletedRoutes);

  return {
    clearedPagePaths: [...new Set(clearedPages)],
    deletedRoutes: uniqueDeletedRoutes,
  };
}

async function findRelatedPostIds(contentDir: string, postId: string): Promise<string[]> {
  const targetLink = await readPostLink(contentDir, postId);
  if (!targetLink) return [postId];

  const files = await getAllMarkdownFiles(contentDir);
  const related = new Set<string>([postId]);

  for (const file of files) {
    if (file === postId) continue;

    try {
      const link = await readPostLink(contentDir, file);
      if (link === targetLink) {
        related.add(file);
      }
    } catch (error) {
      console.warn(`[CMS Delete API] Failed to inspect related post ${file}:`, error);
    }
  }

  return [...related].sort();
}

/**
 * POST /api/cms/delete
 *
 * Request body:
 * {
 *   postId: string
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   deleted: boolean,
 *   trashPath: string
 * }
 */
export async function deleteHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const rawBody = await c.req.json();
    const parseResult = deletePostRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map((e) => e.message).join(', ');
      return c.json({ error: errorMessage }, 400);
    }

    const { postId } = parseResult.data;

    if (!isPathSafe(postId)) {
      return c.json({ error: 'Invalid postId' }, 400);
    }

    if (!hasValidMarkdownExtension(postId)) {
      return c.json({ error: 'Invalid file extension' }, 400);
    }

    const resolvedContentRoot = path.resolve(projectRoot, CONTENT_DIR);
    const contentDir = path.join(projectRoot, CONTENT_DIR);
    const resolvedFilePath = path.resolve(contentDir, postId);

    if (!resolvedFilePath.startsWith(`${resolvedContentRoot}${path.sep}`)) {
      return c.json({ error: 'Invalid postId' }, 400);
    }

    const trashId = createTrashTimestamp();
    const postIdsToDelete = await findRelatedPostIds(contentDir, postId);
    const trashPaths: string[] = [];
    const { clearedPagePaths, deletedRoutes } = await clearPublishedPostPages(projectRoot, contentDir, postIdsToDelete);

    for (const targetPostId of postIdsToDelete) {
      const sourcePath = path.join(contentDir, targetPostId);
      const trashPath = path.join(projectRoot, '.trash', 'cms', trashId, targetPostId);
      await fs.mkdir(path.dirname(trashPath), { recursive: true });
      await fs.rename(sourcePath, trashPath);
      trashPaths.push(path.relative(projectRoot, trashPath).split(path.sep).join('/'));
    }

    const response: DeletePostResponse = {
      success: true,
      deleted: true,
      trashPath: trashPaths[0],
      trashPaths,
      trashId,
      deletedPostIds: postIdsToDelete,
      clearedPagePaths,
      deletedRoutes,
      buildSync: await requestBuildSync(projectRoot),
    };

    return c.json(response);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return c.json({ error: 'File not found' }, 404);
    }

    console.error('[CMS Delete API] Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
