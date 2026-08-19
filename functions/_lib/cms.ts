import { deleteFile, getFile, listRepositoryFiles, makeMarkdown, parseMarkdown, putFile, requireSession } from './github';
import { parse, stringify } from 'yaml';

const CONTENT_DIR = 'src/content/blog';
const CONFIG_PATH = 'config/site.yaml';

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
  const { file, settings } = await getSettings(context);
  if (!patch || typeof patch !== 'object') throw new Error('设置内容格式无效。');
  const merged = { ...settings, ...(patch as Record<string, unknown>) };
  await putFile(context, CONFIG_PATH, stringify(merged), 'cms: 更新站点设置', file.sha);
  return merged;
}

export async function removePost(context: any, postId: unknown) {
  const post = await getPost(context, postId);
  await deleteFile(context, toPostPath(post.id), post.file.sha, `cms: 删除文章 ${post.id}`);
}
