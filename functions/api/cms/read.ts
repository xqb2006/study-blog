import { errorMessage, getPost } from '../../_lib/cms';
import { json } from '../../_lib/github';

export const onRequestGet = async (context: any) => {
  try {
    const post = await getPost(context, new URL(context.request.url).searchParams.get('postId'));
    return json({ frontmatter: post.frontmatter, content: post.content });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
