import { ensurePostId, errorMessage, toPostPath } from '../../_lib/cms';
import { json, makeMarkdown, putFile, requireSession } from '../../_lib/github';

export const onRequestPost = async (context: any) => {
  try {
    await requireSession(context);
    const form = await context.request.formData();
    const file = form.get('file');
    const url = String(form.get('url') || '').trim();
    const title = String(form.get('title') || '').trim() || '导入文章';
    let content = '';
    if (file instanceof File) content = await file.text();
    else if (url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error('无法下载该 Markdown 链接。');
      content = await response.text();
    } else throw new Error('请选择 Markdown 文件或填写公开链接。');
    const postId = ensurePostId(`${title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '') || `import-${Date.now()}`}.md`);
    const categories = String(form.get('category') || '').split(',').map((item) => item.trim()).filter(Boolean);
    const tags = String(form.get('tags') || '').split(',').map((item) => item.trim()).filter(Boolean);
    const draft = String(form.get('draft') || 'true') !== 'false';
    const frontmatter = { title, date: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace('T', ' '), categories, tags, draft, cover: '/img/cover/10.webp' };
    await putFile(context, toPostPath(postId), makeMarkdown(frontmatter, content), `cms: 导入文章 ${title}`);
    return json({ success: true, postId, frontmatter, content, source: file instanceof File ? 'file' : 'url' }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 400);
  }
};
