import { errorMessage, getSettings, saveSettings } from '../../_lib/cms';
import { json, requireSession } from '../../_lib/github';

export const onRequestGet = async (context: any) => {
  try {
    await requireSession(context);
    const { settings } = await getSettings(context);
    return json({ success: true, configPath: 'config/site.yaml', settings });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};

export const onRequestPost = async (context: any) => {
  try {
    await requireSession(context);
    const result = await saveSettings(context, await context.request.json());
    return json({
      success: true,
      settings: result.settings,
      runtimeSync: result.runtimeSync,
      rebuildStarted: true,
      rebuildMessage: '首页资料已同步；Cloudflare 正在自动部署静态页面。',
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
