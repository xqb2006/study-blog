import { errorMessage, removePost } from '../../_lib/cms';
import { json } from '../../_lib/github';

export const onRequestPost = async (context: any) => {
  try {
    const { postId } = await context.request.json();
    await removePost(context, postId);
    return json({
      success: true,
      deleted: true,
      buildSync: {
        started: true,
        queued: true,
        failed: false,
        message: '文章已从 GitHub 仓库永久删除，Cloudflare Pages 正在自动部署。',
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
