import { errorMessage } from '../../../_lib/cms';
import { githubRawFileUrl, json, putBase64File, requireSession } from '../../../_lib/github';

const IMAGE_FILE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

export const onRequestPost = async (context: any) => {
  try {
    await requireSession(context);
    const form = await context.request.formData();
    const file = form.get('file');
    const requestedDirectory = String(form.get('directory') || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!(file instanceof File) || !file.name || !IMAGE_FILE.test(file.name)) throw new Error('请上传 PNG、JPG、WebP、GIF、SVG 或 AVIF 图片。');
    if (requestedDirectory.includes('..')) throw new Error('图片目录无效。');
    const filename = file.name.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, '-');
    const path = `public/img${requestedDirectory ? `/${requestedDirectory}` : ''}/${filename}`;
    await putBase64File(context, path, toBase64(new Uint8Array(await file.arrayBuffer())), `cms: 上传图片 ${filename}`);
    return json({ success: true, file: { name: filename, publicPath: path.replace(/^public/, ''), previewUrl: githubRawFileUrl(context, path), relativePath: path.slice('public/img/'.length), size: file.size, modifiedAt: new Date().toISOString(), extension: filename.split('.').pop()?.toLowerCase() ?? '' } });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
