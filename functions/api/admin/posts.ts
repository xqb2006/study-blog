import { deleteFile, getFile, json, listPostFiles, makeMarkdown, parseMarkdown, putFile, requireSession } from '../../_lib/github';

export const onRequestGet = async (context: any) => {
  try {
    await requireSession(context);
    const files = await listPostFiles(context);
    const posts = await Promise.all(files.map(async (file: any) => {
      const source = await getFile(context, file.path);
      const parsed = parseMarkdown(source.content);
      return { path: file.path, sha: source.sha, ...parsed };
    }));
    posts.sort((a: any, b: any) => String(b.frontmatter.date ?? '').localeCompare(String(a.frontmatter.date ?? '')));
    return json({ posts });
  } catch (error: any) {
    if (error instanceof Response) return error;
    return json({ error: error.message ?? '读取文章失败' }, 500);
  }
};

export const onRequestPost = async (context: any) => {
  try {
    await requireSession(context);
    const body = await context.request.json();
    const title = String(body.frontmatter?.title ?? '').trim();
    const requestedPath = String(body.path ?? '').trim();
    const path = requestedPath || `src/content/blog/${String(body.slug ?? title).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '') || 'new-post'}.md`;
    if (!path.startsWith('src/content/blog/') || !/\.mdx?$/.test(path)) return json({ error: '文章路径无效' }, 400);
    if (!title) return json({ error: '文章标题不能为空' }, 400);
    const result = await putFile(context, path, makeMarkdown(body.frontmatter, String(body.content ?? '')), `${body.sha ? '更新' : '新建'}文章：${title}`, body.sha);
    return json({ success: true, path, commit: result.commit?.html_url });
  } catch (error: any) {
    if (error instanceof Response) return error;
    return json({ error: error.message ?? '保存文章失败' }, 500);
  }
};

export const onRequestDelete = async (context: any) => {
  try {
    await requireSession(context);
    const body = await context.request.json();
    if (!String(body.path).startsWith('src/content/blog/') || !body.sha) return json({ error: '删除参数无效' }, 400);
    await deleteFile(context, body.path, body.sha, `删除文章：${body.path}`);
    return json({ success: true });
  } catch (error: any) {
    if (error instanceof Response) return error;
    return json({ error: error.message ?? '删除文章失败' }, 500);
  }
};
