import assert from 'node:assert/strict';
import { getPostReadiness } from '../src/lib/post-readiness';
import type { BlogSchema } from '../src/types';

const frontmatter: BlogSchema = {
  title: '写作工作台优化记录',
  description: '记录 CMS 写作体验优化的设计、实现和验证过程。',
  categories: [['笔记', '前端']],
  tags: ['CMS', 'Astro'],
  cover: '/img/cover/cms.webp',
  draft: false,
};

const content = [
  '# 开始',
  '这里是一段用于测试阅读统计的正文内容。',
  '它需要足够长，才能让编辑器判断文章不是空白草稿。',
  '发布检查会把标题、摘要、分类、标签、封面和正文完整度合在一起判断。',
  '作者在保存前可以快速发现缺失项，避免文章已经发布却没有封面或摘要。',
  '这段文字只是测试夹具，用来保证正文长度达到发布建议门槛。',
].join('\n\n');

const ready = getPostReadiness(frontmatter, content);
assert.equal(ready.score, 100);
assert.equal(ready.status, 'ready');
assert.equal(ready.statusLabel, '可以发布');
assert.equal(ready.missingItems.length, 0);
assert.equal(ready.summary.requiredDone, 6);
assert.equal(ready.summary.requiredTotal, 6);
assert.equal(ready.stats.words > 0, true);
assert.equal(ready.stats.minutes, 1);

const draft = getPostReadiness({ ...frontmatter, draft: true }, content);
assert.equal(draft.status, 'draft');
assert.equal(draft.statusLabel, '草稿检查');
assert.equal(draft.warnings.some((item) => item.key === 'draft'), true);

const missingDraftFlag = getPostReadiness({ ...frontmatter, draft: undefined }, content);
assert.equal(missingDraftFlag.status, 'ready');
assert.equal(missingDraftFlag.warnings.some((item) => item.key === 'draft'), false);

const incomplete = getPostReadiness(
  {
    title: '  ',
    description: '',
    categories: [],
    tags: [],
    draft: false,
  },
  '太短',
);
assert.equal(incomplete.status, 'blocked');
assert.equal(incomplete.statusLabel, '还差几项');
assert.deepEqual(
  incomplete.missingItems.map((item) => item.key),
  ['title', 'description', 'categories', 'tags', 'cover', 'content'],
);
assert.equal(incomplete.summary.requiredDone, 0);
assert.equal(incomplete.score, 0);

const categoryString = getPostReadiness({ ...frontmatter, categories: '生活', tags: ['随笔'] }, content);
assert.equal(categoryString.items.find((item) => item.key === 'categories')?.done, true);
