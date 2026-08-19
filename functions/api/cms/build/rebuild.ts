import { json, requireSession } from '../../../_lib/github';

export const onRequestPost = async (context: any) => {
  try {
    await requireSession(context);
    return json({ success: true, isRunning: false, isPending: false, lastResult: 'success', log: 'Cloudflare 会在下一次 GitHub 提交后自动部署。', logPath: 'Cloudflare Pages → Deployments', message: '静态网站无需手动重建；保存文章后会自动发布。' });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: '未登录。' }, 401);
  }
};
