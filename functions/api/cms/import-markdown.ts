import { createPost, ensurePostId, errorMessage } from '../../_lib/cms';
import { json, parseMarkdown, requireSession } from '../../_lib/github';

export const onRequestPost = async (context: any) => {
  try {
    await requireSession(context);
    const form = await context.request.formData();
    const file = form.get('file');
    const url = String(form.get('url') || '').trim();
    const requestedTitle = String(form.get('title') || '').trim();
    let source = '';
    if (file instanceof File) source = await file.text();
    else if (url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error('无法下载该 Markdown 链接。');
      source = await response.text();
    } else throw new Error('请选择 Markdown 文件或填写公开链接。');
    const imported = parseMarkdown(source);
    const title =
      requestedTitle || (typeof imported.frontmatter.title === 'string' ? imported.frontmatter.title.trim() : '') || '导入文章';
    const postId = ensurePostId(
      `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '') || `import-${Date.now()}`}.md`,
    );
    const categories = String(form.get('category') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const tags = String(form.get('tags') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const draft = String(form.get('draft') || 'false') === 'true';
    const frontmatter = {
      ...imported.frontmatter,
      title,
      date: imported.frontmatter.date ?? new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace('T', ' '),
      ...(categories.length ? { categories } : {}),
      ...(tags.length ? { tags } : {}),
      draft,
      cover: typeof imported.frontmatter.cover === 'string' ? imported.frontmatter.cover : '/img/cover/10.webp',
    };
    await createPost(context, postId, frontmatter, imported.content, `cms: 导入文章 ${title}`);
    return json(
      {
        success: true,
        postId,
        frontmatter,
        content: imported.content,
        source: file instanceof File ? 'upload' : 'url',
        buildSync: { started: true, queued: true, failed: false, message: '文章已导入，Cloudflare Pages 正在自动部署。' },
      },
      201,
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 400);
  }
};
