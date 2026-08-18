import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import {
  deleteMediaHandler,
  listMediaTrashHandler,
  purgeMediaTrashHandler,
  restoreMediaTrashHandler,
  uploadMediaHandler,
} from '../src/api/media';

type AppVariables = {
  projectRoot: string;
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
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
  app.get('/api/cms/media/trash', listMediaTrashHandler);
  app.post('/api/cms/media/upload', uploadMediaHandler);
  app.post('/api/cms/media/delete', deleteMediaHandler);
  app.post('/api/cms/media/trash/restore', restoreMediaTrashHandler);
  app.post('/api/cms/media/trash/purge', purgeMediaTrashHandler);
  return app;
}

async function createTrashImage(projectRoot: string, trashId: string, relativePath: string) {
  const filePath = path.join(projectRoot, '.cache', 'cms', 'media-trash', trashId, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>', 'utf-8');
  return filePath;
}

async function runListAndRestore() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-media-trash-restore-'));
  const trashId = '2026-06-20T13-10-21-506Z';
  const relativePath = 'cms-uploads/restore-me.svg';

  try {
    const trashFile = await createTrashImage(projectRoot, trashId, relativePath);
    const app = createTestApp(projectRoot);

    const listResponse = await app.request('/api/cms/media/trash');
    const listBody = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listBody.success, true);
    assert.equal(listBody.files.length, 1);
    assert.equal(listBody.files[0].trashId, trashId);
    assert.equal(listBody.files[0].relativePath, relativePath);
    assert.equal(listBody.files[0].publicPath, `/img/${relativePath}`);
    assert.equal(listBody.files[0].trashPath, `.cache/cms/media-trash/${trashId}/${relativePath}`);

    const restoreResponse = await app.request('/api/cms/media/trash/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashPath: listBody.files[0].trashPath }),
    });
    const restoreBody = await restoreResponse.json();
    const restoredPath = path.join(projectRoot, 'public', 'img', relativePath);
    const restoredDistPath = path.join(projectRoot, 'dist', 'img', relativePath);

    assert.equal(restoreResponse.status, 200);
    assert.equal(restoreBody.success, true);
    assert.equal(restoreBody.restored, true);
    assert.equal(restoreBody.file.publicPath, `/img/${relativePath}`);
    assert.equal(await pathExists(restoredPath), true);
    assert.equal(await pathExists(restoredDistPath), false);
    assert.equal(await pathExists(trashFile), false);
    assert.match(await readFile(restoredPath, 'utf-8'), /svg/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function runUploadMirrorsExistingDist() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-media-dist-upload-'));
  const relativePath = 'cms-uploads/upload-dist.svg';

  try {
    await mkdir(path.join(projectRoot, 'dist'), { recursive: true });
    const app = createTestApp(projectRoot);
    const formData = new FormData();
    formData.set('directory', 'cms-uploads');
    formData.set('file', new File(['<svg>upload</svg>'], 'upload-dist.svg', { type: 'image/svg+xml' }));

    const response = await app.request('/api/cms/media/upload', {
      method: 'POST',
      body: formData,
    });
    const body = await response.json();
    const publicPath = path.join(projectRoot, 'public', 'img', relativePath);
    const distPath = path.join(projectRoot, 'dist', 'img', relativePath);

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.file.publicPath, `/img/${relativePath}`);
    assert.equal(await pathExists(publicPath), true);
    assert.equal(await pathExists(distPath), true);
    assert.equal(await readFile(distPath, 'utf-8'), await readFile(publicPath, 'utf-8'));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function runRestoreUsesUniqueNameOnConflict() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-media-trash-conflict-'));
  const trashId = '2026-06-20T13-10-22-506Z';
  const relativePath = 'cms-uploads/conflict.svg';

  try {
    await createTrashImage(projectRoot, trashId, relativePath);
    const existingPath = path.join(projectRoot, 'public', 'img', relativePath);
    await mkdir(path.dirname(existingPath), { recursive: true });
    await writeFile(existingPath, 'existing image', 'utf-8');
    const app = createTestApp(projectRoot);

    const response = await app.request('/api/cms/media/trash/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashPath: `.cache/cms/media-trash/${trashId}/${relativePath}` }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.file.publicPath, '/img/cms-uploads/conflict-1.svg');
    assert.equal(await pathExists(existingPath), true);
    assert.equal(await pathExists(path.join(projectRoot, 'public', 'img', 'cms-uploads', 'conflict-1.svg')), true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function runRestoreMirrorsExistingDist() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-media-trash-dist-restore-'));
  const trashId = '2026-06-20T13-10-24-506Z';
  const relativePath = 'cms-uploads/restore-dist.svg';

  try {
    await mkdir(path.join(projectRoot, 'dist'), { recursive: true });
    await createTrashImage(projectRoot, trashId, relativePath);
    const app = createTestApp(projectRoot);

    const response = await app.request('/api/cms/media/trash/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashPath: `.cache/cms/media-trash/${trashId}/${relativePath}` }),
    });
    const body = await response.json();
    const publicPath = path.join(projectRoot, 'public', 'img', relativePath);
    const distPath = path.join(projectRoot, 'dist', 'img', relativePath);

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(await pathExists(publicPath), true);
    assert.equal(await pathExists(distPath), true);
    assert.equal(await readFile(distPath, 'utf-8'), await readFile(publicPath, 'utf-8'));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function runDeleteRemovesExistingDist() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-media-trash-dist-delete-'));
  const relativePath = 'cms-uploads/delete-dist.svg';
  const publicPath = path.join(projectRoot, 'public', 'img', relativePath);
  const distPath = path.join(projectRoot, 'dist', 'img', relativePath);

  try {
    await mkdir(path.dirname(publicPath), { recursive: true });
    await mkdir(path.dirname(distPath), { recursive: true });
    await writeFile(publicPath, '<svg>public</svg>', 'utf-8');
    await writeFile(distPath, '<svg>dist</svg>', 'utf-8');
    const app = createTestApp(projectRoot);

    const response = await app.request('/api/cms/media/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicPath: `/img/${relativePath}` }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(await pathExists(publicPath), false);
    assert.equal(await pathExists(distPath), false);
    assert.equal(await pathExists(path.join(projectRoot, body.trashPath)), true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function runPurge() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-media-trash-purge-'));
  const trashId = '2026-06-20T13-10-23-506Z';
  const relativePath = 'cms-uploads/purge-me.svg';

  try {
    const trashFile = await createTrashImage(projectRoot, trashId, relativePath);
    const app = createTestApp(projectRoot);

    const response = await app.request('/api/cms/media/trash/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashPath: `.cache/cms/media-trash/${trashId}/${relativePath}` }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.purged, true);
    assert.equal(await pathExists(trashFile), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

Promise.all([
  runListAndRestore(),
  runUploadMirrorsExistingDist(),
  runRestoreUsesUniqueNameOnConflict(),
  runRestoreMirrorsExistingDist(),
  runDeleteRemovesExistingDist(),
  runPurge(),
]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
