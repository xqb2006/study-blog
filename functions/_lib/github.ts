import { parse, stringify } from 'yaml';

const OWNER = 'xqb2006';
const REPO = 'study-blog';
const BRANCH = 'main';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

export type SessionUser = { login: string; avatar_url?: string; name?: string; access_token?: string };

export function env(context: any, key: string): string {
  const value = context.env?.[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
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
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createSession(context: any, user: SessionUser, accessToken: string): Promise<string> {
  const payload = btoa(JSON.stringify({ user: { login: user.login, avatar_url: user.avatar_url, name: user.name }, token: accessToken, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }))
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
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (data.exp < Date.now() || data.user?.login !== OWNER) return null;
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
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${session?.access_token ?? env(context, 'GITHUB_TOKEN')}`,
      'x-github-api-version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

export async function getFile(context: any, filePath: string): Promise<{ content: string; sha: string }> {
  const data = await githubFetch(context, `/contents/${filePath}?ref=${BRANCH}`);
  return { content: decodeBase64(data.content), sha: data.sha };
}

export async function listPostFiles(context: any): Promise<any[]> {
  const files = await githubFetch(context, `/contents/src/content/blog?ref=${BRANCH}`);
  return (files as any[]).filter((file) => file.type === 'file' && /\.mdx?$/.test(file.name));
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
    body: JSON.stringify({ message, content: encodeBase64(content), branch: BRANCH, ...(sha ? { sha } : {}) }),
  });
}

export async function deleteFile(context: any, filePath: string, sha: string, message: string) {
  return githubFetch(context, `/contents/${filePath}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: BRANCH }),
  });
}
