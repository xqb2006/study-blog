import { deleteCategory, errorMessage } from '../../../_lib/cms';
import { json } from '../../../_lib/github';

export const onRequestPost = async (context: any) => {
  try {
    const { categoryName } = await context.request.json();
    const result = await deleteCategory(context, categoryName);
    return json({
      success: true,
      ...result,
      buildSync: {
        started: true,
        queued: true,
        failed: false,
        message: '分类及关联文章已提交到 GitHub，Cloudflare Pages 正在自动部署。',
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 400);
  }
};
