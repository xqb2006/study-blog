import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { importMarkdownHandler } from '../src/api/import-markdown';
import { setCategoryMap } from '../src/lib/category';
import { CONTENT_DIR } from '../src/lib/paths';

type AppVariables = {
  projectRoot: string;
};

function createTestApp(projectRoot: string) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('projectRoot', projectRoot);
    await next();
  });
  app.post('/api/cms/import-markdown', importMarkdownHandler);
  return app;
}

async function runUploadImport() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-import-'));

  try {
    await mkdir(path.join(projectRoot, CONTENT_DIR), { recursive: true });
    setCategoryMap({ 笔记: 'note' });

    const formData = new FormData();
    formData.append(
      'file',
      new File(
        [
          [
            '---',
            'title: Imported Markdown',
            'date: 2026-07-02 12:00:00',
            'tags: [ML, Notes]',
            '---',
            '',
            '# Imported Markdown',
            '',
            'Imported body.',
          ].join('\n'),
        ],
        'imported.md',
        { type: 'text/markdown' },
      ),
    );
    formData.append('category', '笔记');
    formData.append('draft', 'false');

    const app = createTestApp(projectRoot);
    const response = await app.request('/api/cms/import-markdown', {
      method: 'POST',
      body: formData,
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.postId, 'note/imported-markdown.md');
    assert.equal(body.source, 'upload');
    assert.equal(body.frontmatter.title, 'Imported Markdown');
    assert.equal(body.frontmatter.draft, false);
    assert.equal(body.buildSync.failed, true);

    const imported = await readFile(path.join(projectRoot, CONTENT_DIR, body.postId), 'utf-8');
    assert.match(imported, /^title: Imported Markdown$/m);
    assert.match(imported, /^date: 2026-07-02 12:00:00$/m);
    assert.match(imported, /^draft: false$/m);
    assert.match(imported, /  - \[笔记\]/);
    assert.match(imported, /Imported body\./);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function runRejectsLocalUrl() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'koharu-cms-import-url-'));

  try {
    const app = createTestApp(projectRoot);
    const response = await app.request('/api/cms/import-markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1/post.md' }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /内网地址|本机地址/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

await runUploadImport();
await runRejectsLocalUrl();
console.log('import-markdown-api tests passed');
