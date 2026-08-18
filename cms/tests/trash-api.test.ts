import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { listTrashHandler, purgeTrashHandler, restoreTrashHandler } from '../src/api/trash';
import { CONTENT_DIR } from '../src/lib/paths';

type AppVariables = {
  projectRoot: string;
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

function createTestApp(projectRoot: string) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('projectRoot', projectRoot);
    await next();
  });
  app.get('/api/cms/trash', listTrashHandler);
  app.post('/api/cms/trash/restore', restoreTrashHandler);
  app.post('/api/cms/trash/purge', purgeTrashHandler);
  return app;
}

async function createTrashFile(projectRoot: string, trashId: string, postId: string, title: string) {
  const filePath = path.join(projectRoot, '.trash', 'cms', trashId, postId);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    [
      '---',
      `title: ${title}`,
      'date: 2026-06-20 12:00:00',
      'draft: true',
      'tags:',
      '  - cms',
      '---',
      '',
      'Trash test post.',
    ].join('\n'),
    'utf-8',
  );
  return filePath;
}

async function runListAndRestore() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-trash-restore-'));
  const trashId = '20260620-120000';
  const postId = 'tools/restore-me.md';

  try {
    const trashPath = await createTrashFile(projectRoot, trashId, postId, 'Restore me');
    const restorePath = path.join(projectRoot, CONTENT_DIR, postId);
    const app = createTestApp(projectRoot);

    const listResponse = await app.request('/api/cms/trash');
    const listBody = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listBody.success, true);
    assert.equal(listBody.entries.length, 1);
    assert.equal(listBody.entries[0].trashId, trashId);
    assert.equal(listBody.entries[0].primaryTitle, 'Restore me');
    assert.deepEqual(
      listBody.entries[0].files.map((file: { postId: string }) => file.postId),
      [postId],
    );

    const restoreResponse = await app.request('/api/cms/trash/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashId }),
    });
    const restoreBody = await restoreResponse.json();

    assert.equal(restoreResponse.status, 200);
    assert.equal(restoreBody.success, true);
    assert.deepEqual(restoreBody.restoredPostIds, [postId]);
    assert.equal(await pathExists(restorePath), true);
    assert.equal(await pathExists(trashPath), false);
    assert.equal(await pathExists(path.join(projectRoot, '.trash', 'cms', trashId)), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function runRestoreConflict() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-trash-conflict-'));
  const trashId = '20260620-120001';
  const postId = 'tools/conflict.md';

  try {
    await createTrashFile(projectRoot, trashId, postId, 'Conflict post');
    const existingPath = path.join(projectRoot, CONTENT_DIR, postId);
    await mkdir(path.dirname(existingPath), { recursive: true });
    await writeFile(existingPath, 'existing post', 'utf-8');
    const app = createTestApp(projectRoot);

    const response = await app.request('/api/cms/trash/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashId }),
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.match(body.error, /already exists/i);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function runPurge() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-trash-purge-'));
  const trashId = '20260620-120002';

  try {
    await createTrashFile(projectRoot, trashId, 'tools/purge-me.md', 'Purge me');
    const app = createTestApp(projectRoot);

    const response = await app.request('/api/cms/trash/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashId }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.purged, true);
    assert.equal(await pathExists(path.join(projectRoot, '.trash', 'cms', trashId)), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

Promise.all([runListAndRestore(), runRestoreConflict(), runPurge()]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
