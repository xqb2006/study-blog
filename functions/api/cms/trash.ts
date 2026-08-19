import { json, requireSession } from '../../_lib/github';

export const onRequestGet = async (context: any) => {
  try {
    await requireSession(context);
    return json({ success: true, root: 'GitHub', items: [] });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: '未登录。' }, 401);
  }
};
