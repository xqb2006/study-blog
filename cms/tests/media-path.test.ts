import assert from 'node:assert/strict';
import { getImagePreviewSrc, isPreviewableImagePath } from '../src/lib/media-path';

assert.equal(isPreviewableImagePath('/img/avatar.webp'), true);
assert.equal(isPreviewableImagePath('/img/cover/home.png?version=1'), true);
assert.equal(isPreviewableImagePath('https://example.com/avatar.jpg'), true);
assert.equal(isPreviewableImagePath('https://api.dicebear.com/7.x/avataaars/svg?seed=Alice'), true);
assert.equal(isPreviewableImagePath('data:image/webp;base64,aaaa'), true);

assert.equal(isPreviewableImagePath(''), false);
assert.equal(isPreviewableImagePath('   '), false);
assert.equal(isPreviewableImagePath('/posts/hello-world'), false);
assert.equal(isPreviewableImagePath('https://example.com/profile'), false);

assert.equal(getImagePreviewSrc('/img/avatar.webp'), '/img/avatar.webp');
assert.equal(getImagePreviewSrc('  https://example.com/avatar.jpg  '), 'https://example.com/avatar.jpg');
assert.equal(getImagePreviewSrc('https://api.dicebear.com/7.x/avataaars/svg?seed=Alice'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice');
assert.equal(getImagePreviewSrc('/posts/hello-world'), undefined);
