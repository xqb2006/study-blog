import { errorMessage } from '../../../_lib/cms';
import { deleteFile, getFile, json, requireSession } from '../../../_lib/github';

export const onRequestPost = async (context: any) => {
  try {
    await requireSession(context);
    const { publicPath } = await context.request.json();
    if (typeof publicPath !== 'string' || !publicPath.startsWith('/img/') || publicPath.includes('..')) throw new Error('图片路径无效。');
    const path = `public${publicPath}`;
    const file = await getFile(context, path);
    await deleteFile(context, path, file.sha, `cms: 删除图片 ${publicPath}`);
    return json({ success: true, deleted: true, publicPath, trashPath: '' });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
