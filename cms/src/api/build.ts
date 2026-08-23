/**
 * CMS Build API
 *
 * Exposes rebuild status, logs, and a manual rebuild trigger.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';
import type { BuildStatusResponse, BuildSyncSummary } from '@/types';

const LOG_RELATIVE_PATH = path.join('.cache', 'cms', 'rebuild-blog.log');
const LOCK_RELATIVE_PATH = path.join('.cache', 'cms-rebuild.lock');
const PENDING_RELATIVE_PATH = path.join('.cache', 'cms-rebuild.pending');

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTail(filePath: string, maxBytes = 80_000): Promise<string> {
  try {
    const stat = await fs.stat(filePath);
    const start = Math.max(0, stat.size - maxBytes);
    const fileHandle = await fs.open(filePath, 'r');

    try {
      const buffer = Buffer.alloc(stat.size - start);
      await fileHandle.read(buffer, 0, buffer.length, start);
      return buffer.toString('utf-8');
    } finally {
      await fileHandle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

function inferLastResult(log: string): BuildStatusResponse['lastResult'] {
  const normalized = log.toLowerCase();
  const completeIndex = normalized.lastIndexOf('rebuild complete');
  const failIndex = Math.max(normalized.lastIndexOf('rebuild failed'), normalized.lastIndexOf('error:'));

  if (completeIndex === -1 && failIndex === -1) return 'unknown';
  return completeIndex > failIndex ? 'success' : 'failed';
}

async function getDistUpdatedAt(projectRoot: string): Promise<string | undefined> {
  try {
    const stat = await fs.stat(path.join(projectRoot, 'dist'));
    return stat.mtime.toISOString();
  } catch {
    return undefined;
  }
}

async function getBuildStatus(projectRoot: string): Promise<BuildStatusResponse> {
  const lockPath = path.join(projectRoot, LOCK_RELATIVE_PATH);
  const pendingPath = path.join(projectRoot, PENDING_RELATIVE_PATH);
  const logPath = path.join(projectRoot, LOG_RELATIVE_PATH);
  const log = await readTail(logPath);
  const isRunning = await pathExists(lockPath);
  const isPending = await pathExists(pendingPath);
  const pendingSince = isPending ? await fs.readFile(pendingPath, 'utf-8').catch(() => undefined) : undefined;

  return {
    success: true,
    isRunning,
    isPending,
    lastResult: isRunning ? 'running' : inferLastResult(log),
    log,
    logPath: LOG_RELATIVE_PATH.split(path.sep).join('/'),
    distUpdatedAt: await getDistUpdatedAt(projectRoot),
    pendingSince: pendingSince?.trim() || undefined,
  };
}

export async function requestBuildSync(projectRoot: string): Promise<BuildSyncSummary> {
  try {
    const rebuild = await startBlogRebuild(projectRoot);
    return {
      started: rebuild.started,
      queued: !rebuild.started,
      failed: false,
      message: rebuild.message,
      status: rebuild.status,
    };
  } catch (error) {
    console.error('[CMS Build API] Failed to request build sync:', error);
    return {
      started: false,
      queued: false,
      failed: true,
      message: '内容已保存；博客前台自动同步启动失败，请到“发布同步”手动重新同步。',
    };
  }
}

export async function startBlogRebuild(projectRoot: string): Promise<{
  status: BuildStatusResponse;
  started: boolean;
  message: string;
}> {
  const scriptPath = path.join(projectRoot, 'cms', 'scripts', 'rebuild-blog.sh');
  const lockPath = path.join(projectRoot, LOCK_RELATIVE_PATH);
  const pendingPath = path.join(projectRoot, PENDING_RELATIVE_PATH);

  if (await pathExists(lockPath)) {
    await fs.mkdir(path.dirname(pendingPath), { recursive: true });
    await fs.writeFile(pendingPath, new Date().toISOString(), 'utf-8');
    return {
      status: await getBuildStatus(projectRoot),
      started: false,
      message: '发布同步正在运行，已排队同步最新修改',
    };
  }

  if (!(await pathExists(scriptPath))) {
    throw new Error('未找到博客重新构建脚本');
  }

  const child = spawn('sh', [scriptPath], {
    cwd: projectRoot,
    detached: true,
    stdio: 'ignore',
  });

  child.on('error', (error) => {
    console.error('[CMS Build API] Failed to start rebuild:', error);
  });
  child.unref();

  const status = await getBuildStatus(projectRoot);

  return {
    status: {
      ...status,
      isRunning: true,
      lastResult: 'running',
    },
    started: true,
    message: '资料和素材已尽量即时同步；文章页面正在后台同步博客前台。',
  };
}

/**
 * GET /api/cms/build/status
 */
export async function buildStatusHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    return c.json(await getBuildStatus(projectRoot));
  } catch (error) {
    console.error('[CMS Build API] Status error:', error);
    return c.json({ error: 'Failed to read build status' }, 500);
  }
}

/**
 * POST /api/cms/build/rebuild
 */
export async function rebuildBlogHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const rebuild = await startBlogRebuild(projectRoot);

    return c.json({
      ...rebuild.status,
      started: rebuild.started,
      message: rebuild.message,
    });
  } catch (error) {
    console.error('[CMS Build API] Rebuild error:', error);
    return c.json({ error: 'Failed to start rebuild' }, 500);
  }
}
