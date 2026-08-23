import { errorMessage, updatePost } from '../../_lib/cms';
import { json, requireSession } from '../../_lib/github';

export const onRequestPost = async (context: any) => {
  try {
    await requireSession(context);
    const body = await context.request.json();
    const postId = await updatePost(
      context,
      body.postId,
      body.frontmatter,
      body.content,
      `cms: 更新文章 ${body.postId}`,
      body.categoryMappings,
    );
    return json({
      success: true,
      postId,
      buildSync: { started: true, queued: true, failed: false, message: '文章已提交，Cloudflare Pages 正在自动部署。' },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
