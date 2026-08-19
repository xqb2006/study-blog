import { errorMessage, removePost } from '../../_lib/cms';
import { json } from '../../_lib/github';

export const onRequestPost = async (context: any) => {
  try {
    const { postId } = await context.request.json();
    await removePost(context, postId);
    return json({ success: true, deleted: true, trashId: null, buildSync: { success: true, status: 'pending' } });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
