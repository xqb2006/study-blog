/**
 * CMS Trash API
 *
 * Lists, restores, and permanently purges soft-deleted blog posts.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { z } from 'zod';
import { CONFIG_PATH, CONTENT_DIR } from '@/lib/paths';
import { hasValidMarkdownExtension, isPathSafe } from '@/lib/validation';
import type { PurgeTrashResponse, RestoreTrashResponse, TrashEntry, TrashFile, TrashListResponse } from '@/types';
import { requestBuildSync } from './build';

const trashActionSchema = z
  .object({
    trashId: z.string().min(1),
  })
  .strict();

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectMarkdownFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath, baseDir)));
      continue;
    }

    if (entry.isFile() && hasValidMarkdownExtension(entry.name)) {
      files.push(path.relative(baseDir, fullPath).split(path.sep).join('/'));
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function isValidTrashId(trashId: string): boolean {
  return isPathSafe(trashId) && !trashId.includes('/') && !trashId.includes('\\');
}

function getTrashRoot(projectRoot: string): string {
  return path.join(projectRoot, '.trash', 'cms');
}

function getTrashDir(projectRoot: string, trashId: string): string {
  return path.join(getTrashRoot(projectRoot), trashId);
}

function parseDeletedAt(trashId: string): string | undefined {
  const match = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(trashId);
  if (!match) return undefined;

  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
}

async function readTrashFile(trashDir: string, postId: string): Promise<TrashFile> {
  const filePath = path.join(trashDir, postId);
  const [rawContent, stat] = await Promise.all([fs.readFile(filePath, 'utf-8'), fs.stat(filePath)]);
  const { data } = matter(rawContent, {
    engines: {
      yaml: {
        parse: (str) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as object,
        stringify: (obj) => yaml.dump(obj),
      },
    },
  });

  return {
    postId,
    trashPath: path.relative(path.dirname(path.dirname(trashDir)), filePath).split(path.sep).join('/'),
    title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : path.basename(postId),
    date: typeof data.date === 'string' ? data.date : undefined,
    draft: typeof data.draft === 'boolean' ? data.draft : undefined,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
  };
}

async function readTrashEntry(projectRoot: string, trashId: string): Promise<TrashEntry | null> {
  const trashDir = getTrashDir(projectRoot, trashId);
  const stat = await fs.stat(trashDir);

  if (!stat.isDirectory()) {
    return null;
  }

  const postIds = await collectMarkdownFiles(trashDir);
  if (!postIds.length) {
    return null;
  }

  const files = await Promise.all(postIds.map((postId) => readTrashFile(trashDir, postId)));
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return {
    trashId,
    deletedAt: parseDeletedAt(trashId) ?? stat.mtime.toISOString(),
    primaryTitle: files[0]?.title || trashId,
    fileCount: files.length,
    totalSize,
    files,
  };
}

async function listTrashEntries(projectRoot: string): Promise<TrashEntry[]> {
  const trashRoot = getTrashRoot(projectRoot);
  if (!(await pathExists(trashRoot))) {
    return [];
  }

  const entries = await fs.readdir(trashRoot, { withFileTypes: true });
  const trashEntries = await Promise.all(
    entries.filter((entry) => entry.isDirectory()).map((entry) => readTrashEntry(projectRoot, entry.name)),
  );

  return trashEntries
    .filter((entry): entry is TrashEntry => Boolean(entry))
    .sort((a, b) => b.trashId.localeCompare(a.trashId));
}

async function readI18nSettings(projectRoot: string): Promise<{ defaultLocale: string; localeList: string[]; allKnownLocales: Set<string> }> {
  try {
    const rawConfig = await fs.readFile(path.join(projectRoot, CONFIG_PATH), 'utf-8');
    const parsed = yaml.load(rawConfig) as
      | {
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
    };
  } catch {
    return {
      defaultLocale: 'zh',
      localeList: ['zh', 'en', 'ja'],
      allKnownLocales: new Set(['zh', 'en', 'ja']),
    };
  }
}

function getPostLocaleInfo(postId: string, settings: { defaultLocale: string; allKnownLocales: Set<string> }) {
  const withoutExtension = postId.replace(/\.(md|mdx)$/i, '');
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

async function readPostLink(filePath: string): Promise<string | undefined> {
  const rawContent = await fs.readFile(filePath, 'utf-8');
  const { data } = matter(rawContent, {
    engines: {
      yaml: {
        parse: (str) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as object,
        stringify: (obj) => yaml.dump(obj),
      },
    },
  });

  return typeof data.link === 'string' && data.link.trim() ? data.link.trim() : undefined;
}

function normalizeRoute(route: string): string {
  const withLeadingSlash = route.startsWith('/') ? route : `/${route}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function getPostRoutes(postId: string, postLink: string | undefined, settings: Awaited<ReturnType<typeof readI18nSettings>>): string[] {
  const { locale, localeFreeSlug } = getPostLocaleInfo(postId, settings);
  const slug = postLink?.trim() ? postLink.trim() : localeFreeSlug;
  const routeLocales = locale === settings.defaultLocale ? settings.localeList : [locale];

  return routeLocales.map((routeLocale) => {
    const prefix = routeLocale === settings.defaultLocale ? '' : `/${routeLocale}`;
    return normalizeRoute(`${prefix}/post/${slug}/`);
  });
}

async function removeDeletedRoutes(projectRoot: string, restoredFiles: { postId: string; filePath: string }[]): Promise<string[]> {
  const manifestPath = path.join(projectRoot, 'dist', 'deleted-posts.json');
  if (!(await pathExists(manifestPath))) {
    return [];
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as { routes?: unknown; updatedAt?: string };
  const existingRoutes = Array.isArray(manifest.routes)
    ? manifest.routes.filter((route): route is string => typeof route === 'string').map(normalizeRoute)
    : [];

  if (!existingRoutes.length) {
    return [];
  }

  const i18nSettings = await readI18nSettings(projectRoot);
  const routesToRemove = new Set<string>();

  for (const restoredFile of restoredFiles) {
    let postLink: string | undefined;
    try {
      postLink = await readPostLink(restoredFile.filePath);
    } catch {
      postLink = undefined;
    }

    for (const route of getPostRoutes(restoredFile.postId, postLink, i18nSettings)) {
      routesToRemove.add(normalizeRoute(route));
    }
  }

  const routes = existingRoutes.filter((route) => !routesToRemove.has(route));
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

  return [...routesToRemove].sort();
}

async function parseTrashAction(c: Context): Promise<string | Response> {
  const rawBody = await c.req.json();
  const parseResult = trashActionSchema.safeParse(rawBody);

  if (!parseResult.success) {
    const errorMessage = parseResult.error.errors.map((error) => error.message).join(', ');
    return c.json({ error: errorMessage }, 400);
  }

  if (!isValidTrashId(parseResult.data.trashId)) {
    return c.json({ error: 'Invalid trashId' }, 400);
  }

  return parseResult.data.trashId;
}

/**
 * GET /api/cms/trash
 */
export async function listTrashHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    return c.json({
      success: true,
      entries: await listTrashEntries(projectRoot),
    } satisfies TrashListResponse);
  } catch (error) {
    console.error('[CMS Trash API] List error:', error);
    return c.json({ error: 'Failed to list trash' }, 500);
  }
}

/**
 * POST /api/cms/trash/restore
 */
export async function restoreTrashHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const trashIdOrResponse = await parseTrashAction(c);
    if (typeof trashIdOrResponse !== 'string') {
      return trashIdOrResponse;
    }

    const trashId = trashIdOrResponse;
    const trashDir = getTrashDir(projectRoot, trashId);

    if (!(await pathExists(trashDir))) {
      return c.json({ error: 'Trash entry not found' }, 404);
    }

    const postIds = await collectMarkdownFiles(trashDir);
    if (!postIds.length) {
      return c.json({ error: 'Trash entry is empty' }, 404);
    }

    const contentRoot = path.resolve(projectRoot, CONTENT_DIR);
    const restorePairs = postIds.map((postId) => {
      if (!isPathSafe(postId) || !hasValidMarkdownExtension(postId)) {
        throw new Error(`Invalid post path in trash: ${postId}`);
      }

      const sourcePath = path.resolve(trashDir, postId);
      const targetPath = path.resolve(contentRoot, postId);

      if (!sourcePath.startsWith(`${path.resolve(trashDir)}${path.sep}`) || !targetPath.startsWith(`${contentRoot}${path.sep}`)) {
        throw new Error(`Invalid post path in trash: ${postId}`);
      }

      return { postId, sourcePath, targetPath };
    });

    for (const pair of restorePairs) {
      if (await pathExists(pair.targetPath)) {
        return c.json({ error: `Target post already exists: ${pair.postId}` }, 409);
      }
    }

    for (const pair of restorePairs) {
      await fs.mkdir(path.dirname(pair.targetPath), { recursive: true });
      await fs.rename(pair.sourcePath, pair.targetPath);
    }

    await fs.rm(trashDir, { recursive: true, force: true });

    const removedDeletedRoutes = await removeDeletedRoutes(
      projectRoot,
      restorePairs.map((pair) => ({ postId: pair.postId, filePath: pair.targetPath })),
    );

    return c.json({
      success: true,
      restored: true,
      trashId,
      restoredPostIds: postIds,
      removedDeletedRoutes,
      buildSync: await requestBuildSync(projectRoot),
    } satisfies RestoreTrashResponse);
  } catch (error) {
    console.error('[CMS Trash API] Restore error:', error);
    return c.json({ error: 'Failed to restore trash entry' }, 500);
  }
}

/**
 * POST /api/cms/trash/purge
 */
export async function purgeTrashHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const trashIdOrResponse = await parseTrashAction(c);
    if (typeof trashIdOrResponse !== 'string') {
      return trashIdOrResponse;
    }

    const trashId = trashIdOrResponse;
    const trashDir = getTrashDir(projectRoot, trashId);

    if (!(await pathExists(trashDir))) {
      return c.json({ error: 'Trash entry not found' }, 404);
    }

    await fs.rm(trashDir, { recursive: true, force: true });

    return c.json({
      success: true,
      purged: true,
      trashId,
    } satisfies PurgeTrashResponse);
  } catch (error) {
    console.error('[CMS Trash API] Purge error:', error);
    return c.json({ error: 'Failed to purge trash entry' }, 500);
  }
}
