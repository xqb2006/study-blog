import { ensurePostId, errorMessage, toPostPath } from '../../_lib/cms';
import { json, makeMarkdown, putFile, requireSession } from '../../_lib/github';

function slugify(title: string): string {
  const latin = title.toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '');
  return latin || `post-${Date.now()}`;
}

export const onRequestPost = async (context: any) => {
  try {
    await requireSession(context);
    const body = await context.request.json();
    if (typeof body.title !== 'string' || !body.title.trim()) throw new Error('请输入文章标题。');
    const postId = ensurePostId(`${slugify(body.title)}.md`);
    const date = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace('T', ' ');
    const frontmatter = { title: body.title.trim(), date, categories: Array.isArray(body.categories) ? body.categories : [], tags: Array.isArray(body.tags) ? body.tags : [], draft: body.draft !== false, cover: '/img/cover/10.webp' };
    await putFile(context, toPostPath(postId), makeMarkdown(frontmatter, ''), `cms: 新建文章 ${body.title.trim()}`);
    return json({ success: true, postId, message: '文章已创建并提交到 GitHub。' });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
