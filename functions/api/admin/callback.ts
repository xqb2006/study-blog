import { clearCookieHeader, cookieHeader, env, redirect, getCookie, createSession } from '../../_lib/github';

export const onRequestGet = async (context: any) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || state !== getCookie(context.request, 'admin_oauth_state')) {
    return new Response('登录验证失败，请重新登录。', { status: 400 });
  }

  const callback = new URL('/api/admin/callback', context.request.url).toString();
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env(context, 'GITHUB_CLIENT_ID'),
      client_secret: env(context, 'GITHUB_CLIENT_SECRET'),
      code,
      redirect_uri: callback,
    }),
  });
  const tokenText = await tokenResponse.text();
  let tokenData: any;
  try {
    tokenData = JSON.parse(tokenText);
  } catch {
    tokenData = Object.fromEntries(new URLSearchParams(tokenText));
  }
  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error('[admin] GitHub OAuth token exchange failed:', tokenResponse.status, tokenText.slice(0, 300));
    return new Response('GitHub 登录失败，请检查 OAuth App 的 Client ID、Client Secret 和回调地址。', { status: 401 });
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${tokenData.access_token}` },
  });
  const userText = await userResponse.text();
  let user: any;
  try {
    user = JSON.parse(userText);
  } catch {
    console.error('[admin] GitHub user request returned non-JSON:', userResponse.status, userText.slice(0, 300));
    return new Response('GitHub 用户信息读取失败，请稍后重试。', { status: 502 });
  }
  if (!userResponse.ok) {
    console.error('[admin] GitHub user request failed:', userResponse.status, user.message ?? userText.slice(0, 300));
    return new Response('GitHub 用户信息读取失败，请稍后重试。', { status: 502 });
  }
  if (user.login !== 'xqb2006') return new Response('此账号没有博客管理权限。', { status: 403 });

  const response = redirect(new URL('/admin/', context.request.url).toString());
  response.headers.append('set-cookie', cookieHeader('admin_session', await createSession(context, user, tokenData.access_token), 7 * 24 * 60 * 60));
  response.headers.append('set-cookie', clearCookieHeader('admin_oauth_state'));
  return response;
};
