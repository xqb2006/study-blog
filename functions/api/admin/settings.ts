import { json, getFile, putFile, requireSession } from '../../_lib/github';
import { parse, stringify } from 'yaml';

export const onRequestGet = async (context: any) => {
  try {
    await requireSession(context);
    const file = await getFile(context, 'config/site.yaml');
    const data = parse(file.content) as any;
    return json({ sha: file.sha, site: data.site ?? {} });
  } catch (error: any) {
    if (error instanceof Response) return error;
    return json({ error: error.message ?? '读取个人信息失败' }, 500);
  }
};

export const onRequestPost = async (context: any) => {
  try {
    await requireSession(context);
    const body = await context.request.json();
    const file = await getFile(context, 'config/site.yaml');
    const data = parse(file.content) as any;
    data.site = { ...data.site, ...body.site };
    await putFile(context, 'config/site.yaml', stringify(data), '更新个人信息', file.sha);
    return json({ success: true });
  } catch (error: any) {
    if (error instanceof Response) return error;
    return json({ error: error.message ?? '保存个人信息失败' }, 500);
  }
};
