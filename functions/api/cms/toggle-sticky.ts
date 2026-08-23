import { errorMessage, getPost, toPostPath } from '../../_lib/cms';
import { json, makeMarkdown, putFile } from '../../_lib/github';

export const onRequestPost = async (context: any) => {
  try {
    const { postId } = await context.request.json();
    const post = await getPost(context, postId);
    const sticky = post.frontmatter.sticky !== true;
    await putFile(
      context,
      toPostPath(post.id),
      makeMarkdown({ ...post.frontmatter, sticky }, post.content),
      `cms: ${sticky ? '置顶' : '取消置顶'} ${post.id}`,
      post.file.sha,
    );
    return json({
      success: true,
      sticky,
      buildSync: { started: true, queued: true, failed: false, message: '置顶状态已保存，Cloudflare Pages 正在更新。' },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
