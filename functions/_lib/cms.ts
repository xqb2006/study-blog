import { deleteFile, getFile, listRepositoryFiles, makeMarkdown, parseMarkdown, putFile, putFiles, requireSession } from './github';
import { parse, stringify } from 'yaml';

const CONTENT_DIR = 'src/content/blog';
const CONFIG_PATH = 'config/site.yaml';
const RUNTIME_SETTINGS_PATH = 'public/runtime/site-settings.json';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '请求失败，请稍后重试。';
}

export function ensurePostId(postId: unknown): string {
  if (typeof postId !== 'string') throw new Error('文章路径无效。');
  const normalized = postId.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || !/\.mdx?$/.test(normalized)) throw new Error('文章路径无效。');
  return normalized;
}

export function toPostPath(postId: string): string {
  return `${CONTENT_DIR}/${ensurePostId(postId)}`;
}

export function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flat(Infinity).filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' ? [value] : [];
}

export function postIdFromPath(path: string): string {
  return path.slice(`${CONTENT_DIR}/`.length);
}

export function slugFromPostId(postId: string): string {
  return postId.replace(/\.mdx?$/, '').replace(/\/index$/, '');
}

export async function getPost(context: any, postId: unknown) {
  await requireSession(context);
  const id = ensurePostId(postId);
  const file = await getFile(context, toPostPath(id));
  return { id, file, ...parseMarkdown(file.content) };
}

export async function listPosts(context: any) {
  await requireSession(context);
  const files = await listRepositoryFiles(context, CONTENT_DIR, /\.mdx?$/);
  const posts = await Promise.all(
    files.map(async (file) => {
      const source = await getFile(context, file.path);
      const { frontmatter } = parseMarkdown(source.content);
      const id = postIdFromPath(file.path);
      return {
        id,
        slug: slugFromPostId(id),
        title: typeof frontmatter.title === 'string' ? frontmatter.title : id,
        date: typeof frontmatter.date === 'string' ? frontmatter.date : '',
        updated: typeof frontmatter.updated === 'string' ? frontmatter.updated : undefined,
        categories: normalizeStringList(frontmatter.categories),
        tags: normalizeStringList(frontmatter.tags),
        draft: frontmatter.draft === true,
        sticky: frontmatter.sticky === true,
      };
    }),
  );
  return posts;
}

export async function updatePost(context: any, postId: unknown, frontmatter: unknown, content: unknown, message: string) {
  const post = await getPost(context, postId);
  if (!frontmatter || typeof frontmatter !== 'object' || typeof content !== 'string') throw new Error('文章内容格式无效。');
  await putFile(context, toPostPath(post.id), makeMarkdown(frontmatter as Record<string, unknown>, content), message, post.file.sha);
  return post.id;
}

export async function getSettings(context: any) {
  await requireSession(context);
  const file = await getFile(context, CONFIG_PATH);
  return { file, settings: (parse(file.content) as Record<string, unknown>) ?? {} };
}

export async function saveSettings(context: any, patch: unknown) {
  const { settings } = await getSettings(context);
  if (!patch || typeof patch !== 'object') throw new Error('设置内容格式无效。');
  const merged = mergeSettings(settings, patch as Record<string, unknown>);
  const updatedAt = new Date().toISOString();
  const runtimeSettings = buildRuntimeSettings(merged, updatedAt);
  await putFiles(
    context,
    [
      { path: CONFIG_PATH, content: stringify(merged) },
      { path: RUNTIME_SETTINGS_PATH, content: `${JSON.stringify(runtimeSettings, null, 2)}\n` },
    ],
    'cms: 更新站点设置',
  );
  return { settings: merged, runtimeSync: { success: true, path: '/runtime/site-settings.json', updatedAt, message: '首页资料已同步，Cloudflare 正在更新静态页面。' } };
}

function mergeSettings(current: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    const existing = merged[key];
    merged[key] = isPlainObject(existing) && isPlainObject(value) ? mergeSettings(existing, value) : value;
  }
  return merged;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildRuntimeSettings(config: Record<string, unknown>, updatedAt: string) {
  const site = isPlainObject(config.site) ? config.site : {};
  const social = isPlainObject(config.social) ? config.social : {};
  return {
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
}

export async function removePost(context: any, postId: unknown) {
  const post = await getPost(context, postId);
  await deleteFile(context, toPostPath(post.id), post.file.sha, `cms: 删除文章 ${post.id}`);
}
