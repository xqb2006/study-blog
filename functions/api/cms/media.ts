import { errorMessage } from '../../_lib/cms';
import { json, listRepositoryFiles, requireSession } from '../../_lib/github';

const MEDIA_ROOT = 'public/img';
const IMAGE_FILE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
const RAW_BASE = 'https://raw.githubusercontent.com/xqb2006/study-blog/main/';

export const onRequestGet = async (context: any) => {
  try {
    await requireSession(context);
    const files = await listRepositoryFiles(context, MEDIA_ROOT, IMAGE_FILE);
    return json({
      success: true,
      root: MEDIA_ROOT,
      files: files.map((file) => ({
        name: file.path.split('/').pop(),
        publicPath: file.path.replace(/^public/, ''),
        previewUrl: `${RAW_BASE}${file.path}`,
        relativePath: file.path.slice(`${MEDIA_ROOT}/`.length),
        size: file.size,
        modifiedAt: '',
        extension: file.path.split('.').pop()?.toLowerCase() ?? '',
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
