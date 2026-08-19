import { clearCookieHeader } from '../../_lib/github';

export const onRequestPost = async () => {
  const response = new Response(null, { status: 204 });
  response.headers.append('set-cookie', clearCookieHeader('admin_session'));
  return response;
};
