import { parse, stringify } from 'yaml';

const DEFAULT_OWNER = 'xqb2006';
const DEFAULT_REPOSITORY = 'study-blog';
const DEFAULT_BRANCH = 'main';
const DEFAULT_ADMIN = 'xqb2006';

export type SessionUser = { login: string; avatar_url?: string; name?: string; access_token?: string };

export function env(context: any, key: string): string {
  const value = context.env?.[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

function optionalEnv(context: any, key: string, fallback: string): string {
  const value = context.env?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function githubConfig(context: any) {
  return {
    owner: optionalEnv(context, 'GITHUB_REPOSITORY_OWNER', DEFAULT_OWNER),
    repository: optionalEnv(context, 'GITHUB_REPOSITORY_NAME', DEFAULT_REPOSITORY),
    branch: optionalEnv(context, 'GITHUB_REPOSITORY_BRANCH', DEFAULT_BRANCH),
    admin: optionalEnv(context, 'GITHUB_ADMIN_USERNAME', DEFAULT_ADMIN),
  };
}

export function githubRawFileUrl(context: any, filePath: string): string {
  const { owner, repository, branch } = githubConfig(context);
  const encodedPath = filePath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${encodeURIComponent(branch)}/${encodedPath}`;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function redirect(url: string, status = 302): Response {
  return new Response(null, { status, headers: { location: url } });
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie') ?? '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function cookieHeader(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookieHeader(name: string): string {
  return cookieHeader(name, '', 0);
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createSession(context: any, user: SessionUser, accessToken: string): Promise<string> {
  const payload = encodeBase64(
    JSON.stringify({
      user: { login: user.login, avatar_url: user.avatar_url, name: user.name },
      token: accessToken,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${payload}.${await hmac(env(context, 'SESSION_SECRET'), payload)}`;
}

export async function readSession(context: any, request: Request): Promise<SessionUser | null> {
  const token = getCookie(request, 'admin_session');
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = await hmac(env(context, 'SESSION_SECRET'), payload);
  if (signature !== expected) return null;
  try {
    const data = JSON.parse(decodeBase64(payload));
    if (data.exp < Date.now() || data.user?.login !== githubConfig(context).admin) return null;
    return { ...data.user, access_token: data.token };
  } catch {
    return null;
  }
}

export async function requireSession(context: any): Promise<SessionUser> {
  const user = await readSession(context, context.request);
  if (!user) throw new Response('Unauthorized', { status: 401 });
  return user;
}

function decodeBase64(value: string): string {
  const bytes = Uint8Array.from(atob(value.replace(/\n/g, '')), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function githubFetch(context: any, path: string, init: RequestInit = {}): Promise<any> {
  const session = await readSession(context, context.request);
  const { owner, repository } = githubConfig(context);
  const response = await fetch(`https://api.github.com/repos/${owner}/${repository}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${session?.access_token ?? env(context, 'GITHUB_TOKEN')}`,
      'user-agent': 'study-blog-admin',
      'x-github-api-version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 401) throw new Error('GitHub 登录已失效，请重新登录后台。');
    if (response.status === 403) throw new Error('GitHub 拒绝了本次操作，请检查 OAuth 授权和仓库写入权限。');
    if (response.status === 409) throw new Error('内容刚刚被其他保存操作更新，请刷新后台后再试。');
    if (response.status === 422) throw new Error('GitHub 未接受本次保存：文件可能已存在或内容格式无效。请刷新后重试。');
    console.error('[github] API request failed', response.status, path, detail.slice(0, 500));
    throw new Error(`GitHub 服务请求失败（HTTP ${response.status}），请稍后重试。`);
  }
  return response.status === 204 ? null : response.json();
}

export async function getFile(context: any, filePath: string): Promise<{ content: string; sha: string }> {
  const data = await githubFetch(context, `/contents/${filePath}?ref=${githubConfig(context).branch}`);
  return { content: decodeBase64(data.content), sha: data.sha };
}

export async function listPostFiles(context: any): Promise<any[]> {
  return listRepositoryFiles(context, 'src/content/blog', /\.mdx?$/);
}

export async function listRepositoryFiles(
  context: any,
  directory: string,
  matcher?: RegExp,
): Promise<{ path: string; size: number; sha: string }[]> {
  const data = await githubFetch(context, `/git/trees/${githubConfig(context).branch}?recursive=1`);
  const prefix = directory.replace(/^\/+|\/+$/g, '') + '/';
  return (data.tree as { path: string; type: string; size?: number; sha: string }[])
    .filter((file) => file.type === 'blob' && file.path.startsWith(prefix) && (!matcher || matcher.test(file.path)))
    .map((file) => ({ path: file.path, size: file.size ?? 0, sha: file.sha }));
}

export function parseMarkdown(source: string): { frontmatter: Record<string, unknown>; content: string } {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content: source };
  return { frontmatter: (parse(match[1]) as Record<string, unknown>) ?? {}, content: match[2] };
}

export function makeMarkdown(frontmatter: Record<string, unknown>, content: string): string {
  return `---\n${stringify(frontmatter).trim()}\n---\n\n${content.trim()}\n`;
}

export async function putFile(context: any, filePath: string, content: string, message: string, sha?: string) {
  return githubFetch(context, `/contents/${filePath}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message,
      content: encodeBase64(content),
      branch: githubConfig(context).branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

export async function putBase64File(context: any, filePath: string, base64Content: string, message: string, sha?: string) {
  return githubFetch(context, `/contents/${filePath}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, content: base64Content, branch: githubConfig(context).branch, ...(sha ? { sha } : {}) }),
  });
}

export async function putFiles(context: any, files: { path: string; content: string }[], message: string): Promise<void> {
  if (!files.length) return;

  const branch = githubConfig(context).branch;
  const ref = await githubFetch(context, `/git/ref/heads/${branch}`);
  const parentSha = ref.object.sha as string;
  const parentCommit = await githubFetch(context, `/git/commits/${parentSha}`);
  const tree = await Promise.all(
    files.map(async (file) => {
      const blob = await githubFetch(context, '/git/blobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: encodeBase64(file.content), encoding: 'base64' }),
      });
      return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha };
    }),
  );
  const nextTree = await githubFetch(context, '/git/trees', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree }),
  });
  const commit = await githubFetch(context, '/git/commits', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, tree: nextTree.sha, parents: [parentSha] }),
  });
  await githubFetch(context, `/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
}

export async function deleteFile(context: any, filePath: string, sha: string, message: string) {
  return githubFetch(context, `/contents/${filePath}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: githubConfig(context).branch }),
  });
}
