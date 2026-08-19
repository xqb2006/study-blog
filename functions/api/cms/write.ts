import { errorMessage, updatePost } from '../../_lib/cms';
import { json } from '../../_lib/github';

export const onRequestPost = async (context: any) => {
  try {
    const body = await context.request.json();
    const postId = await updatePost(context, body.postId, body.frontmatter, body.content, `cms: 更新文章 ${body.postId}`);
    return json({ success: true, postId, buildSync: { success: true, status: 'pending', message: '已提交到 GitHub，Cloudflare 正在自动部署。' } });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
