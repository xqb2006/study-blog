import { clearCookieHeader, cookieHeader, env, redirect, getCookie, createSession } from '../../_lib/github';

export const onRequestGet = async (context: any) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || state !== getCookie(context.request, 'admin_oauth_state')) {
    return new Response('登录验证失败，请重新登录。', { status: 400 });
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: env(context, 'GITHUB_CLIENT_ID'), client_secret: env(context, 'GITHUB_CLIENT_SECRET'), code }),
  });
  const tokenData = (await tokenResponse.json()) as any;
  if (!tokenData.access_token) return new Response('GitHub 登录失败。', { status: 401 });

  const userResponse = await fetch('https://api.github.com/user', {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = (await userResponse.json()) as any;
  if (user.login !== 'xqb2006') return new Response('此账号没有博客管理权限。', { status: 403 });

  const response = redirect(new URL('/admin', context.request.url).toString());
  response.headers.append('set-cookie', cookieHeader('admin_session', await createSession(context, user, tokenData.access_token), 7 * 24 * 60 * 60));
  response.headers.append('set-cookie', clearCookieHeader('admin_oauth_state'));
  return response;
};
