/**
 * CMS Markdown Import API
 *
 * Imports Markdown from an uploaded .md/.mdx file or a public Markdown URL.
 */

import { lookup } from 'node:dns/promises';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { format, isValid, parse, parseISO } from 'date-fns';
import matter from 'gray-matter';
import type { Context } from 'hono';
import yaml from 'js-yaml';
import { z } from 'zod';
import { getCategoryMap } from '@/lib/category';
import { addCategoryMappings } from '@/lib/config';
import { serializeFrontmatter } from '@/lib/frontmatter';
import { CONTENT_DIR } from '@/lib/paths';
import { generateSlug } from '@/lib/slug';
import { hasValidMarkdownExtension, isPathSafe } from '@/lib/validation';
import type { ImportMarkdownResponse } from '@/types';
import { requestBuildSync } from './build';

const MAX_MARKDOWN_SIZE = 2 * 1024 * 1024;
const DEFAULT_CATEGORY = '笔记';
const MAX_REDIRECTS = 4;

const importMarkdownJsonSchema = z
  .object({
    url: z.string().url().optional(),
    markdown: z.string().optional(),
    filename: z.string().optional(),
    title: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).or(z.string()).optional(),
    draft: z.boolean().optional(),
    categoryMappings: z.record(z.string(), z.string()).optional(),
  })
  .strict();

interface ImportMarkdownRequest {
  markdown?: string;
  url?: string;
  filename?: string;
  title?: string;
  category?: string;
  tags?: string[];
  draft: boolean;
  categoryMappings?: Record<string, string>;
}

interface MarkdownSource {
  markdown: string;
  filename?: string;
  source: ImportMarkdownResponse['source'];
}

function parseBoolean(value: FormDataEntryValue | null | undefined, defaultValue: boolean): boolean {
  if (typeof value !== 'string') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function parseTags(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const tags = value.map((item) => String(item).trim()).filter(Boolean);
    return tags.length > 0 ? tags : undefined;
  }

  if (typeof value !== 'string') return undefined;
  const tags = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

function normalizeMarkdownExtension(filename?: string): '.md' | '.mdx' {
  const extension = path.extname(filename || '').toLowerCase();
  return extension === '.mdx' ? '.mdx' : '.md';
}

function sanitizeFilenameBase(value: string): string {
  return generateSlug(value).replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `imported-${Date.now()}`;
}

function firstHeading(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

function titleFromFilename(filename?: string): string | undefined {
  if (!filename) return undefined;
  const parsed = path.parse(filename);
  return parsed.name.replace(/[-_]+/g, ' ').trim() || undefined;
}

function normalizeCategories(value: unknown, fallbackCategory?: string): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()];

  if (Array.isArray(value)) {
    const names = value
      .flatMap((item) => (Array.isArray(item) ? item : [item]))
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
    if (names.length > 0) return [...new Set(names)];
  }

  return [fallbackCategory?.trim() || DEFAULT_CATEGORY];
}

function normalizeDateValue(value: unknown, fallback: Date): Date {
  if (value instanceof Date && isValid(value)) return value;

  if (typeof value === 'string' && value.trim()) {
    const localDate = parse(value.trim(), 'yyyy-MM-dd HH:mm:ss', new Date());
    if (isValid(localDate)) return localDate;

    const isoDate = parseISO(value.trim());
    if (isValid(isoDate)) return isoDate;
  }

  return fallback;
}

function isPrivateAddress(address: string): boolean {
  const ipVersion = net.isIP(address);
  if (ipVersion === 0) return false;

  if (ipVersion === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
  }

  const octets = address.split('.').map((part) => Number(part));
  const [a = 0, b = 0] = octets;
  return a === 10 || a === 127 || a === 0 || a === 169 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

async function assertPublicMarkdownUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Markdown 链接只支持 HTTP(S)');
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Markdown 链接不能指向本机地址');
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error('Markdown 链接不能指向内网地址');
  }

  return url;
}

function normalizeMarkdownUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (url.hostname === 'github.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const [owner, repo, marker, branch, ...fileParts] = parts;
    if (owner && repo && marker === 'blob' && branch && fileParts.length > 0) {
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fileParts.join('/')}`;
    }
  }

  return rawUrl;
}

async function fetchMarkdownUrl(rawUrl: string): Promise<MarkdownSource> {
  let currentUrl = await assertPublicMarkdownUrl(normalizeMarkdownUrl(rawUrl));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      const response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          accept: 'text/markdown,text/plain,text/*;q=0.9,application/octet-stream;q=0.6,*/*;q=0.1',
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Markdown 链接重定向缺少 Location');
        currentUrl = await assertPublicMarkdownUrl(new URL(location, currentUrl).toString());
        continue;
      }

      if (!response.ok) {
        throw new Error(`Markdown 链接读取失败：HTTP ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && Number(contentLength) > MAX_MARKDOWN_SIZE) {
        throw new Error('Markdown 文档太大，最大支持 2 MB');
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_MARKDOWN_SIZE) {
        throw new Error('Markdown 文档太大，最大支持 2 MB');
      }

      return {
        markdown: buffer.toString('utf-8'),
        filename: path.basename(currentUrl.pathname) || undefined,
        source: 'url',
      };
    }
  } finally {
    clearTimeout(timeout);
  }

  throw new Error('Markdown 链接重定向次数过多');
}

async function readImportRequest(c: Context): Promise<ImportMarkdownRequest> {
  const contentType = c.req.header('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('file');
    const url = typeof formData.get('url') === 'string' ? String(formData.get('url')).trim() : undefined;
    const markdown = typeof formData.get('markdown') === 'string' ? String(formData.get('markdown')) : undefined;

    if (file instanceof File) {
      if (!hasValidMarkdownExtension(file.name)) {
        throw new Error('只支持 .md 或 .mdx Markdown 文档');
      }

      if (file.size > MAX_MARKDOWN_SIZE) {
        throw new Error('Markdown 文档太大，最大支持 2 MB');
      }

      return {
        markdown: await file.text(),
        filename: file.name,
        title: typeof formData.get('title') === 'string' ? String(formData.get('title')).trim() : undefined,
        category: typeof formData.get('category') === 'string' ? String(formData.get('category')).trim() : undefined,
        tags: parseTags(formData.get('tags')),
        draft: parseBoolean(formData.get('draft'), true),
      };
    }

    return {
      markdown,
      url,
      filename: typeof formData.get('filename') === 'string' ? String(formData.get('filename')).trim() : undefined,
      title: typeof formData.get('title') === 'string' ? String(formData.get('title')).trim() : undefined,
      category: typeof formData.get('category') === 'string' ? String(formData.get('category')).trim() : undefined,
      tags: parseTags(formData.get('tags')),
      draft: parseBoolean(formData.get('draft'), true),
    };
  }

  const rawBody = await c.req.json();
  const parseResult = importMarkdownJsonSchema.safeParse(rawBody);
  if (!parseResult.success) {
    throw new Error(parseResult.error.errors.map((error) => error.message).join(', '));
  }

  const data = parseResult.data;
  return {
    markdown: data.markdown,
    url: data.url,
    filename: data.filename,
    title: data.title,
    category: data.category,
    tags: parseTags(data.tags),
    draft: data.draft ?? true,
    categoryMappings: data.categoryMappings,
  };
}

async function resolveMarkdownSource(request: ImportMarkdownRequest): Promise<MarkdownSource> {
  if (typeof request.markdown === 'string' && request.markdown.trim()) {
    return {
      markdown: request.markdown,
      filename: request.filename,
      source: 'upload',
    };
  }

  if (request.url) {
    return fetchMarkdownUrl(request.url);
  }

  throw new Error('请上传 Markdown 文档，或填写 Markdown 链接');
}

async function getUniquePostId(projectRoot: string, postId: string): Promise<string> {
  const parsed = path.parse(postId);

  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? '' : `-${index}`;
    const candidate = path.join(parsed.dir, `${parsed.name}${suffix}${parsed.ext}`).split(path.sep).join('/');
    const candidatePath = path.join(projectRoot, CONTENT_DIR, candidate);
    try {
      await fs.access(candidatePath);
    } catch {
      return candidate;
    }
  }

  throw new Error('同名文章太多，无法生成安全文件名');
}

function buildPostId(categories: string[], title: string, filename?: string): string {
  const categoryMap = getCategoryMap();
  const pathSegments = categories.map((category) => categoryMap[category] || generateSlug(category)).filter(Boolean);
  const slug = sanitizeFilenameBase(title);
  const extension = normalizeMarkdownExtension(filename);
  return [...pathSegments, `${slug}${extension}`].join('/');
}

function stringifyMarkdownPost(content: string, frontmatter: Record<string, unknown>): string {
  return matter.stringify(content, serializeFrontmatter(frontmatter), {
    engines: {
      yaml: {
        parse: (input: string) => yaml.load(input) as object,
        stringify: (obj: object) => {
          const yamlStr = yaml.dump(obj, {
            flowLevel: 2,
            lineWidth: -1,
            quotingType: "'",
            forceQuotes: false,
          });
          return yamlStr.replace(/^(date|updated): '(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})'$/gm, '$1: $2');
        },
      },
    },
  });
}

export async function importMarkdownDocument(
  projectRoot: string,
  request: ImportMarkdownRequest,
): Promise<Omit<ImportMarkdownResponse, 'success' | 'buildSync'>> {
  const resolved = await resolveMarkdownSource(request);
  const parsed = matter(resolved.markdown, {
    engines: {
      yaml: (input) => yaml.load(input) as object,
    },
  });
  const now = new Date();
  const data = parsed.data as Record<string, unknown>;
  const title =
    request.title?.trim() ||
    (typeof data.title === 'string' ? data.title.trim() : undefined) ||
    firstHeading(parsed.content) ||
    titleFromFilename(resolved.filename) ||
    `Imported ${format(now, 'yyyy-MM-dd HH:mm')}`;
  const categories = normalizeCategories(data.categories, request.category || DEFAULT_CATEGORY);
  const tags = request.tags || parseTags(data.tags);
  const frontmatter: Record<string, unknown> = {
    ...data,
    title,
    date: normalizeDateValue(data.date, now),
    updated: normalizeDateValue(data.updated, now),
    categories: [categories],
    draft: request.draft,
    catalog: data.catalog ?? true,
  };

  if (tags?.length) frontmatter.tags = tags;

  const postId = await getUniquePostId(projectRoot, buildPostId(categories, title, resolved.filename || request.filename));
  if (!isPathSafe(postId) || !hasValidMarkdownExtension(postId)) {
    throw new Error('生成的文章路径不安全');
  }

  const contentRoot = path.resolve(projectRoot, CONTENT_DIR);
  const filePath = path.resolve(contentRoot, postId);
  const relative = path.relative(contentRoot, filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('生成的文章路径越界');
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, stringifyMarkdownPost(parsed.content.trimStart(), frontmatter), { encoding: 'utf-8', flag: 'wx' });

  return {
    postId,
    frontmatter: frontmatter as unknown as ImportMarkdownResponse['frontmatter'],
    source: resolved.source,
  };
}

/**
 * POST /api/cms/import-markdown
 */
export async function importMarkdownHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const request = await readImportRequest(c);

    if (request.categoryMappings && Object.keys(request.categoryMappings).length > 0) {
      await addCategoryMappings(projectRoot, request.categoryMappings);
    }

    const imported = await importMarkdownDocument(projectRoot, request);
    const buildSync = await requestBuildSync(projectRoot);

    return c.json(
      {
        success: true,
        ...imported,
        buildSync,
      } satisfies ImportMarkdownResponse,
      201,
    );
  } catch (error) {
    console.error('[CMS Import Markdown API] Error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to import Markdown' }, 400);
  }
}
