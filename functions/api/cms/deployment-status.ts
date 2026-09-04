import { getLatestDeploymentStatus } from '../../_lib/github';
import { errorMessage } from '../../_lib/cms';
import { json, requireSession } from '../../_lib/github';

export const onRequestGet = async (context: any) => {
  try {
    await requireSession(context);
    return json(await getLatestDeploymentStatus(context));
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
