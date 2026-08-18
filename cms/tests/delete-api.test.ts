import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { deleteHandler } from '../src/api/delete';
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

async function run() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-delete-'));
  const postId = 'cms-delete-test.md';
  const originalPath = path.join(projectRoot, CONTENT_DIR, postId);

  try {
    await mkdir(path.dirname(originalPath), { recursive: true });
    await writeFile(
      originalPath,
      [
        '---',
        'title: CMS delete test',
        'date: 2026-06-20 12:00:00',
        'draft: true',
        '---',
        '',
        'Temporary test post.',
      ].join('\n'),
      'utf-8',
    );

    const app = new Hono<{ Variables: AppVariables }>();
    app.use('*', async (c, next) => {
      c.set('projectRoot', projectRoot);
      await next();
    });
    app.post('/api/cms/delete', deleteHandler);

    const response = await app.request('/api/cms/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.deleted, true);
    assert.equal(await pathExists(originalPath), false);
    assert.match(body.trashPath, /^\.trash\/cms\/\d{8}-\d{6}\/cms-delete-test\.md$/);
    assert.equal(await pathExists(path.join(projectRoot, body.trashPath)), true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function runDeleteTranslationsByLink() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-delete-i18n-'));
  const postIds = ['tools/demo.md', 'en/tools/demo.md', 'ja/tools/demo.md'];
  const originalPaths = postIds.map((id) => path.join(projectRoot, CONTENT_DIR, id));

  try {
    for (const [index, filePath] of originalPaths.entries()) {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(
        filePath,
        [
          '---',
          'link: shared-demo',
          `title: CMS delete i18n test ${index}`,
          'date: 2026-06-20 12:00:00',
          'draft: true',
          '---',
          '',
          'Temporary translated test post.',
        ].join('\n'),
        'utf-8',
      );
    }

    const app = new Hono<{ Variables: AppVariables }>();
    app.use('*', async (c, next) => {
      c.set('projectRoot', projectRoot);
      await next();
    });
    app.post('/api/cms/delete', deleteHandler);

    const response = await app.request('/api/cms/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: postIds[0] }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.deleted, true);
    assert.deepEqual(body.deletedPostIds.sort(), postIds.sort());

    for (const filePath of originalPaths) {
      assert.equal(await pathExists(filePath), false);
    }

    for (const deletedPostId of postIds) {
      const trashPath = path.join(projectRoot, '.trash', 'cms', body.trashId, deletedPostId);
      assert.equal(await pathExists(trashPath), true);
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function runClearPublishedPostPages() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-delete-dist-'));
  const postIds = ['tools/fast-delete.md', 'en/tools/fast-delete.md', 'ja/tools/fast-delete.md'];
  const distPagePaths = [
    path.join(projectRoot, 'dist', 'post', 'fast-delete', 'index.html'),
    path.join(projectRoot, 'dist', 'en', 'post', 'fast-delete', 'index.html'),
    path.join(projectRoot, 'dist', 'ja', 'post', 'fast-delete', 'index.html'),
  ];

  try {
    for (const [index, postId] of postIds.entries()) {
      const filePath = path.join(projectRoot, CONTENT_DIR, postId);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(
        filePath,
        [
          '---',
          'link: fast-delete',
          `title: CMS fast delete test ${index}`,
          'date: 2026-06-20 12:00:00',
          'draft: false',
          '---',
          '',
          'Temporary published test post.',
        ].join('\n'),
        'utf-8',
      );
    }

    for (const distPagePath of distPagePaths) {
      await mkdir(path.dirname(distPagePath), { recursive: true });
      await writeFile(distPagePath, '<html>stale page</html>', 'utf-8');
    }

    const app = new Hono<{ Variables: AppVariables }>();
    app.use('*', async (c, next) => {
      c.set('projectRoot', projectRoot);
      await next();
    });
    app.post('/api/cms/delete', deleteHandler);

    const response = await app.request('/api/cms/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: postIds[0] }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(body.deletedPostIds.sort(), postIds.sort());

    for (const distPagePath of distPagePaths) {
      assert.equal(await pathExists(distPagePath), false);
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function runClearPublishedPostPageWithCaseSensitiveLink() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-delete-dist-case-'));
  const postId = 'tools/fast-delete-case.md';
  const originalPath = path.join(projectRoot, CONTENT_DIR, postId);
  const distPagePath = path.join(projectRoot, 'dist', 'post', 'FastDeleteCase', 'index.html');

  try {
    await mkdir(path.dirname(originalPath), { recursive: true });
    await writeFile(
      originalPath,
      [
        '---',
        'link: FastDeleteCase',
        'title: CMS fast delete case test',
        'date: 2026-06-20 12:00:00',
        'draft: false',
        '---',
        '',
        'Temporary published test post with a mixed-case link.',
      ].join('\n'),
      'utf-8',
    );

    await mkdir(path.dirname(distPagePath), { recursive: true });
    await writeFile(distPagePath, '<html>stale mixed-case page</html>', 'utf-8');

    const app = new Hono<{ Variables: AppVariables }>();
    app.use('*', async (c, next) => {
      c.set('projectRoot', projectRoot);
      await next();
    });
    app.post('/api/cms/delete', deleteHandler);

    const response = await app.request('/api/cms/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    });

    assert.equal(response.status, 200);
    assert.equal(await pathExists(distPagePath), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function runRecordDeletedRoutesManifest() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-delete-manifest-'));
  const postIds = ['tools/manifest-delete.md', 'en/tools/manifest-delete.md'];

  try {
    for (const [index, postId] of postIds.entries()) {
      const filePath = path.join(projectRoot, CONTENT_DIR, postId);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(
        filePath,
        [
          '---',
          'link: manifest-delete',
          `title: CMS manifest delete test ${index}`,
          'date: 2026-06-20 12:00:00',
          'draft: false',
          '---',
          '',
          'Temporary post for deleted routes manifest.',
        ].join('\n'),
        'utf-8',
      );
    }

    const app = new Hono<{ Variables: AppVariables }>();
    app.use('*', async (c, next) => {
      c.set('projectRoot', projectRoot);
      await next();
    });
    app.post('/api/cms/delete', deleteHandler);

    const response = await app.request('/api/cms/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: postIds[0] }),
    });
    const body = await response.json();
    const manifestPath = path.join(projectRoot, 'dist', 'deleted-posts.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as { routes: string[] };

    assert.equal(response.status, 200);
    assert.deepEqual(body.deletedRoutes.sort(), ['/en/post/manifest-delete/', '/ja/post/manifest-delete/', '/post/manifest-delete/'].sort());
    assert.deepEqual(manifest.routes.sort(), ['/en/post/manifest-delete/', '/ja/post/manifest-delete/', '/post/manifest-delete/'].sort());
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

Promise.all([
  run(),
  runDeleteTranslationsByLink(),
  runClearPublishedPostPages(),
  runClearPublishedPostPageWithCaseSensitiveLink(),
  runRecordDeletedRoutesManifest(),
]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
