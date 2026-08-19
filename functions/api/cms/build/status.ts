import { json, requireSession } from '../../../_lib/github';

export const onRequestGet = async (context: any) => {
  try {
    await requireSession(context);
    return json({ success: true, isRunning: false, isPending: false, lastResult: 'success', log: '文章修改会提交到 GitHub；Cloudflare Pages 随后自动构建并发布。', logPath: 'Cloudflare Pages → Deployments' });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: '未登录。' }, 401);
  }
};
