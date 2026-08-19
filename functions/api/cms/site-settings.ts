import { errorMessage, getSettings, saveSettings } from '../../_lib/cms';
import { json } from '../../_lib/github';

export const onRequestGet = async (context: any) => {
  try {
    const { settings } = await getSettings(context);
    return json({ success: true, configPath: 'config/site.yaml', settings });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};

export const onRequestPost = async (context: any) => {
  try {
    const settings = await saveSettings(context, await context.request.json());
    return json({ success: true, settings, rebuildStarted: true, rebuildMessage: '已提交到 GitHub，Cloudflare 正在自动部署。' });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
