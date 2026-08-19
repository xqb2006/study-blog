import { json, readSession } from '../../_lib/github';

export const onRequestGet = async (context: any) => {
  const user = await readSession(context, context.request);
  return json({ authenticated: Boolean(user), user });
};
