import { errorMessage, getPost, toPostPath } from '../../_lib/cms';
import { json, makeMarkdown, putFile } from '../../_lib/github';

export const onRequestPost = async (context: any) => {
  try {
    const { postId } = await context.request.json();
    const post = await getPost(context, postId);
    const draft = post.frontmatter.draft !== true;
    await putFile(context, toPostPath(post.id), makeMarkdown({ ...post.frontmatter, draft }, post.content), `cms: ${draft ? '设为草稿' : '发布'} ${post.id}`, post.file.sha);
    return json({ success: true, draft, buildSync: { success: true, status: 'pending' } });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
