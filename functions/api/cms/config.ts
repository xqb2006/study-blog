import { errorMessage, getSettings } from '../../_lib/cms';
import { json } from '../../_lib/github';

export const onRequestGet = async (context: any) => {
  try {
    const { settings } = await getSettings(context);
    return json({ projectRoot: 'GitHub repository', contentDir: 'src/content/blog', categoryMap: settings.categoryMap ?? {} });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
