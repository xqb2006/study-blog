import assert from 'node:assert/strict';
import { createMarkdownImageSnippet, getMediaAltText } from '../src/lib/media-markdown';

assert.equal(getMediaAltText({ name: 'weekly_header.webp', publicPath: '/img/weekly_header.webp' }), 'weekly header');
assert.equal(getMediaAltText({ name: '个人博客-封面.png', publicPath: '/img/cover/mu.png' }), '个人博客 封面');
assert.equal(getMediaAltText({ name: '', publicPath: '/img/cover/1.webp' }), '1');

assert.equal(
  createMarkdownImageSnippet({ name: 'weekly_header.webp', publicPath: '/img/weekly_header.webp' }),
  '![weekly header](/img/weekly_header.webp)',
);

assert.equal(
  createMarkdownImageSnippet({ name: 'needs ] escape.png', publicPath: '/img/cms-uploads/needs%20space.png' }),
  '![needs \\] escape](/img/cms-uploads/needs%20space.png)',
);

