/**
 * CMS Media API
 *
 * Lists image files under public/img for cover and avatar selection.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Context } from 'hono';
import type {
  DeleteMediaResponse,
  MediaFile,
  MediaListResponse,
  MediaTrashFile,
  MediaTrashListResponse,
  PurgeMediaResponse,
  RestoreMediaResponse,
  UploadMediaResponse,
} from '@/types';

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const MAX_UPLOAD_SIZE = 12 * 1024 * 1024;
const DEFAULT_UPLOAD_DIR = 'cms-uploads';

const deleteMediaSchema = z.object({
  publicPath: z.string().min(1),
});

const mediaTrashActionSchema = z
  .object({
    trashPath: z.string().min(1),
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

function normalizeRelativePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\/+/, '');
}

function sanitizeDirectory(value: FormDataEntryValue | null): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const normalized = normalizeRelativePath(raw || DEFAULT_UPLOAD_DIR)
    .split('/')
    .map((part) => part.trim().replace(/[^a-zA-Z0-9._-]/g, '-'))
    .filter(Boolean)
    .join('/');

  return normalized || DEFAULT_UPLOAD_DIR;
}

function sanitizeFilename(name: string): string {
  const parsed = path.parse(name);
  const baseName = parsed.name.trim().replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const extension = parsed.ext.toLowerCase();
  return `${baseName || `image-${Date.now()}`}${extension}`;
}

function assertInside(parent: string, target: string): boolean {
  const relative = path.relative(parent, target);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function isInsideOrEqual(parent: string, target: string): boolean {
  const relative = path.relative(parent, target);
  return !relative || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function getUniquePath(targetPath: string): Promise<string> {
  if (!(await pathExists(targetPath))) return targetPath;

  const parsed = path.parse(targetPath);
  for (let index = 1; index < 1000; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);
    if (!(await pathExists(candidate))) return candidate;
  }

  throw new Error('Too many duplicate file names');
}

async function toMediaFile(fullPath: string, mediaRoot: string): Promise<MediaFile> {
  const stat = await fs.stat(fullPath);
  const relativePath = path.relative(mediaRoot, fullPath).split(path.sep).join('/');

  return {
    name: path.basename(fullPath),
    publicPath: `/img/${relativePath}`,
    relativePath,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    extension: path.extname(fullPath).toLowerCase(),
  };
}

async function collectImageFiles(dir: string, baseDir: string): Promise<MediaFile[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: MediaFile[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectImageFiles(fullPath, baseDir)));
      continue;
    }

    if (!entry.isFile()) continue;

    const extension = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension)) continue;

    files.push(await toMediaFile(fullPath, baseDir));
  }

  return files;
}

function getMediaTrashRoot(projectRoot: string): string {
  return path.join(projectRoot, '.cache', 'cms', 'media-trash');
}

function getDistMediaRoot(projectRoot: string): string {
  return path.join(projectRoot, 'dist', 'img');
}

async function mirrorPublicMediaToDist(projectRoot: string, mediaRoot: string, publicFilePath: string) {
  if (!(await pathExists(path.join(projectRoot, 'dist')))) return;

  const distMediaRoot = getDistMediaRoot(projectRoot);
  const relativePath = path.relative(mediaRoot, publicFilePath);
  const distFilePath = path.resolve(distMediaRoot, relativePath);

  if (!assertInside(path.resolve(distMediaRoot), distFilePath)) {
    throw new Error('Unsafe dist media mirror path');
  }

  await fs.mkdir(path.dirname(distFilePath), { recursive: true });
  await fs.copyFile(publicFilePath, distFilePath);
}

async function removeDistMedia(projectRoot: string, relativePath: string) {
  if (!(await pathExists(path.join(projectRoot, 'dist')))) return;

  const distMediaRoot = getDistMediaRoot(projectRoot);
  const distFilePath = path.resolve(distMediaRoot, relativePath);

  if (!assertInside(path.resolve(distMediaRoot), distFilePath)) {
    throw new Error('Unsafe dist media delete path');
  }

  await fs.rm(distFilePath, { force: true });
  await removeEmptyParents(distMediaRoot, path.dirname(distFilePath));
}

function parseDeletedAt(trashId: string): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(trashId);
  if (!match) return undefined;

  const [, date, hour, minute, second, millisecond] = match;
  return `${date}T${hour}:${minute}:${second}.${millisecond}Z`;
}

async function toMediaTrashFile(fullPath: string, trashRoot: string): Promise<MediaTrashFile | null> {
  const stat = await fs.stat(fullPath);
  if (!stat.isFile()) return null;

  const trashRelativePath = path.relative(trashRoot, fullPath).split(path.sep).join('/');
  const [trashId, ...relativeParts] = trashRelativePath.split('/');
  if (!trashId || relativeParts.length === 0) return null;

  const relativePath = relativeParts.join('/');
  const extension = path.extname(fullPath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return null;

  return {
    trashId,
    name: path.basename(fullPath),
    trashPath: path.join('.cache', 'cms', 'media-trash', trashRelativePath).split(path.sep).join('/'),
    publicPath: `/img/${relativePath}`,
    relativePath,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    extension,
    deletedAt: parseDeletedAt(trashId) ?? stat.mtime.toISOString(),
  };
}

async function collectMediaTrashFiles(dir: string, trashRoot: string): Promise<MediaTrashFile[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: MediaTrashFile[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectMediaTrashFiles(fullPath, trashRoot)));
      continue;
    }

    if (!entry.isFile()) continue;

    const trashFile = await toMediaTrashFile(fullPath, trashRoot);
    if (trashFile) {
      files.push(trashFile);
    }
  }

  return files;
}

function normalizeTrashPath(value: string): string {
  const normalized = normalizeRelativePath(value.trim());
  const prefix = '.cache/cms/media-trash/';
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
}

async function resolveMediaTrashFile(projectRoot: string, rawTrashPath: string) {
  const trashRoot = getMediaTrashRoot(projectRoot);
  const normalizedTrashPath = normalizeTrashPath(rawTrashPath);

  if (!normalizedTrashPath || normalizedTrashPath.split('/').some((part) => !part || part === '.' || part === '..')) {
    return { error: 'Invalid media trash path' as const, status: 400 as const };
  }

  const sourcePath = path.resolve(trashRoot, normalizedTrashPath);
  if (!isInsideOrEqual(path.resolve(trashRoot), sourcePath)) {
    return { error: 'Unsafe media trash path' as const, status: 400 as const };
  }

  if (!(await pathExists(sourcePath))) {
    return { error: 'Media trash file not found' as const, status: 404 as const };
  }

  const stat = await fs.stat(sourcePath);
  if (!stat.isFile()) {
    return { error: 'Media trash path is not a file' as const, status: 400 as const };
  }

  const trashFile = await toMediaTrashFile(sourcePath, trashRoot);
  if (!trashFile) {
    return { error: 'Media trash file is not a supported image' as const, status: 400 as const };
  }

  return { sourcePath, trashFile };
}

async function removeEmptyParents(stopAt: string, startDir: string) {
  const root = path.resolve(stopAt);
  let current = path.resolve(startDir);

  while (current !== root && isInsideOrEqual(root, current)) {
    const entries = await fs.readdir(current).catch(() => []);
    if (entries.length > 0) return;

    await fs.rmdir(current).catch(() => undefined);
    current = path.dirname(current);
  }
}

/**
 * GET /api/cms/media
 */
export async function listMediaHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;
  const mediaRoot = path.join(projectRoot, 'public', 'img');

  try {
    if (!(await pathExists(mediaRoot))) {
      return c.json({ success: true, root: 'public/img', files: [] } satisfies MediaListResponse);
    }

    const files = await collectImageFiles(mediaRoot, mediaRoot);
    files.sort((a, b) => a.publicPath.localeCompare(b.publicPath));

    return c.json({
      success: true,
      root: 'public/img',
      files,
    } satisfies MediaListResponse);
  } catch (error) {
    console.error('[CMS Media API] Error:', error);
    return c.json({ error: 'Failed to list media files' }, 500);
  }
}

/**
 * POST /api/cms/media/upload
 */
export async function uploadMediaHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;
  const mediaRoot = path.join(projectRoot, 'public', 'img');

  try {
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return c.json({ error: 'Missing upload file' }, 400);
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return c.json({ error: 'Image is too large. Maximum size is 12 MB.' }, 413);
    }

    const safeName = sanitizeFilename(file.name);
    const extension = path.extname(safeName).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension)) {
      return c.json({ error: 'Only image files are allowed' }, 400);
    }

    const uploadDir = sanitizeDirectory(formData.get('directory'));
    const targetDir = path.join(mediaRoot, uploadDir);
    const targetPath = await getUniquePath(path.join(targetDir, safeName));

    if (!assertInside(mediaRoot, targetDir) || !assertInside(mediaRoot, targetPath)) {
      return c.json({ error: 'Unsafe upload path' }, 400);
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetPath, buffer, { flag: 'wx' });
    await mirrorPublicMediaToDist(projectRoot, mediaRoot, targetPath);

    return c.json({
      success: true,
      file: await toMediaFile(targetPath, mediaRoot),
    } satisfies UploadMediaResponse);
  } catch (error) {
    console.error('[CMS Media API] Upload error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to upload media file' }, 500);
  }
}

/**
 * POST /api/cms/media/delete
 */
export async function deleteMediaHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;
  const mediaRoot = path.join(projectRoot, 'public', 'img');
  const trashRoot = getMediaTrashRoot(projectRoot);

  try {
    const rawBody = await c.req.json();
    const parseResult = deleteMediaSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return c.json({ error: 'Invalid delete media request', details: parseResult.error.flatten() }, 400);
    }

    const requestedPath = parseResult.data.publicPath.trim();
    if (!requestedPath.startsWith('/img/')) {
      return c.json({ error: 'Media path must start with /img/' }, 400);
    }

    const relativePath = normalizeRelativePath(requestedPath.slice('/img/'.length));
    const sourcePath = path.join(mediaRoot, relativePath);

    if (!assertInside(mediaRoot, sourcePath) || !(await pathExists(sourcePath))) {
      return c.json({ error: 'Media file not found' }, 404);
    }

    const stat = await fs.stat(sourcePath);
    if (!stat.isFile()) {
      return c.json({ error: 'Media path is not a file' }, 400);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const trashPath = path.join(trashRoot, timestamp, relativePath);
    await fs.mkdir(path.dirname(trashPath), { recursive: true });
    await fs.rename(sourcePath, trashPath);
    await removeDistMedia(projectRoot, relativePath);

    return c.json({
      success: true,
      deleted: true,
      publicPath: requestedPath,
      trashPath: path.relative(projectRoot, trashPath).split(path.sep).join('/'),
    } satisfies DeleteMediaResponse);
  } catch (error) {
    console.error('[CMS Media API] Delete error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete media file' }, 500);
  }
}

/**
 * GET /api/cms/media/trash
 */
export async function listMediaTrashHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;
  const trashRoot = getMediaTrashRoot(projectRoot);

  try {
    if (!(await pathExists(trashRoot))) {
      return c.json({ success: true, root: '.cache/cms/media-trash', files: [] } satisfies MediaTrashListResponse);
    }

    const files = await collectMediaTrashFiles(trashRoot, trashRoot);
    files.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt) || a.publicPath.localeCompare(b.publicPath));

    return c.json({
      success: true,
      root: '.cache/cms/media-trash',
      files,
    } satisfies MediaTrashListResponse);
  } catch (error) {
    console.error('[CMS Media API] Trash list error:', error);
    return c.json({ error: 'Failed to list media trash files' }, 500);
  }
}

/**
 * POST /api/cms/media/trash/restore
 */
export async function restoreMediaTrashHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;
  const mediaRoot = path.join(projectRoot, 'public', 'img');
  const trashRoot = getMediaTrashRoot(projectRoot);

  try {
    const rawBody = await c.req.json();
    const parseResult = mediaTrashActionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return c.json({ error: 'Invalid media trash restore request', details: parseResult.error.flatten() }, 400);
    }

    const resolved = await resolveMediaTrashFile(projectRoot, parseResult.data.trashPath);
    if ('error' in resolved) {
      return c.json({ error: resolved.error }, resolved.status);
    }

    const targetPath = await getUniquePath(path.resolve(mediaRoot, resolved.trashFile.relativePath));
    if (!assertInside(path.resolve(mediaRoot), targetPath)) {
      return c.json({ error: 'Unsafe media restore path' }, 400);
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.rename(resolved.sourcePath, targetPath);
    await mirrorPublicMediaToDist(projectRoot, mediaRoot, targetPath);
    await removeEmptyParents(trashRoot, path.dirname(resolved.sourcePath));

    return c.json({
      success: true,
      restored: true,
      trashPath: resolved.trashFile.trashPath,
      file: await toMediaFile(targetPath, mediaRoot),
    } satisfies RestoreMediaResponse);
  } catch (error) {
    console.error('[CMS Media API] Trash restore error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to restore media trash file' }, 500);
  }
}

/**
 * POST /api/cms/media/trash/purge
 */
export async function purgeMediaTrashHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;
  const trashRoot = getMediaTrashRoot(projectRoot);

  try {
    const rawBody = await c.req.json();
    const parseResult = mediaTrashActionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return c.json({ error: 'Invalid media trash purge request', details: parseResult.error.flatten() }, 400);
    }

    const resolved = await resolveMediaTrashFile(projectRoot, parseResult.data.trashPath);
    if ('error' in resolved) {
      return c.json({ error: resolved.error }, resolved.status);
    }

    await fs.rm(resolved.sourcePath, { force: true });
    await removeEmptyParents(trashRoot, path.dirname(resolved.sourcePath));

    return c.json({
      success: true,
      purged: true,
      trashPath: resolved.trashFile.trashPath,
    } satisfies PurgeMediaResponse);
  } catch (error) {
    console.error('[CMS Media API] Trash purge error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to purge media trash file' }, 500);
  }
}
