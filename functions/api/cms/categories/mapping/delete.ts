import { deleteCategoryMapping, errorMessage } from '../../../../_lib/cms';
import { json, requireSession } from '../../../../_lib/github';

export const onRequestPost = async (context: any) => {
  try {
    await requireSession(context);
    const { categoryName } = await context.request.json();
    const result = await deleteCategoryMapping(context, categoryName);
    return json({
      success: true,
      ...result,
      buildSync: {
        started: true,
        queued: true,
        failed: false,
        message: '分类 URL 映射已删除，Cloudflare Pages 正在自动部署。',
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 400);
  }
};
