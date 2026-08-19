import { env, redirect, cookieHeader } from '../../_lib/github';

export const onRequestGet = async (context: any) => {
  const state = crypto.randomUUID();
  const clientId = env(context, 'GITHUB_CLIENT_ID');
  const callback = new URL('/api/admin/callback', context.request.url).toString();
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callback);
  url.searchParams.set('scope', 'public_repo user');
  url.searchParams.set('state', state);
  const response = redirect(url.toString());
  response.headers.append('set-cookie', cookieHeader('admin_oauth_state', state, 600));
  return response;
};
