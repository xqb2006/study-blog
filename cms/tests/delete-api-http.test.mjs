import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';

const apiBase = 'http://localhost:4322/api/cms';
const projectRoot = path.resolve(process.cwd(), '..');

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

const title = `cms-soft-delete-verify-${Date.now()}`;
let postId;

try {
  const createBody = await jsonFetch(`${apiBase}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, draft: true }),
  });
  postId = createBody.postId;
  assert.equal(createBody.success, true);
  assert.equal(typeof postId, 'string');

  const originalPath = path.join(projectRoot, 'src/content/blog', postId);
  assert.equal(await exists(originalPath), true);

  const beforeList = await jsonFetch(`${apiBase}/list`);
  assert.equal(beforeList.posts.some((post) => post.id === postId), true);

  const deleteBody = await jsonFetch(`${apiBase}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId }),
  });
  assert.equal(deleteBody.success, true);
  assert.equal(deleteBody.deleted, true);
  assert.match(deleteBody.trashPath, /^\.trash\/cms\/\d{8}-\d{6}\//);

  const trashPath = path.join(projectRoot, deleteBody.trashPath);
  assert.equal(await exists(originalPath), false);
  assert.equal(await exists(trashPath), true);

  const afterList = await jsonFetch(`${apiBase}/list`);
  assert.equal(afterList.posts.some((post) => post.id === postId), false);

  console.log(
    JSON.stringify({
      success: true,
      postId,
      trashPath: deleteBody.trashPath,
      listedBefore: true,
      listedAfter: false,
    }),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
