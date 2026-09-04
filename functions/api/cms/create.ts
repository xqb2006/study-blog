import { createPost, createPostId, errorMessage } from '../../_lib/cms';
import { json, requireSession } from '../../_lib/github';

export const onRequestPost = async (context: any) => {
  try {
    await requireSession(context);
    const body = await context.request.json();
    if (typeof body.title !== 'string' || !body.title.trim()) throw new Error('请输入文章标题。');
    const postId = createPostId(body.title);
    const date = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace('T', ' ');
    const frontmatter = {
      title: body.title.trim(),
      date,
      categories: Array.isArray(body.categories) ? body.categories : [],
      tags: Array.isArray(body.tags) ? body.tags : [],
      draft: body.draft === true,
      cover: '/img/cover/10.webp',
    };
    await createPost(context, postId, frontmatter, '', `cms: 新建文章 ${body.title.trim()}`, body.categoryMappings);
    return json({
      success: true,
      postId,
      message: '文章已创建并提交到 GitHub。',
      buildSync: { started: true, queued: true, failed: false, message: '文章已提交到 GitHub，正在等待 Cloudflare Pages 部署。' },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
