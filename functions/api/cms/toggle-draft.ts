import { errorMessage, getPost, toPostPath } from '../../_lib/cms';
import { json, makeMarkdown, putFile, requireSession } from '../../_lib/github';

export const onRequestPost = async (context: any) => {
  try {
    await requireSession(context);
    const { postId } = await context.request.json();
    const post = await getPost(context, postId);
    const draft = post.frontmatter.draft !== true;
    await putFile(
      context,
      toPostPath(post.id),
      makeMarkdown({ ...post.frontmatter, draft }, post.content),
      `cms: ${draft ? '设为草稿' : '发布'} ${post.id}`,
      post.file.sha,
    );
    return json({
      success: true,
      draft,
      buildSync: {
        started: true,
        queued: true,
        failed: false,
        message: draft
          ? '文章已设为草稿并提交到 GitHub，正在等待 Cloudflare Pages 更新。'
          : '文章已提交发布到 GitHub，正在等待 Cloudflare Pages 部署。',
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
