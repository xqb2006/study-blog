import assert from 'node:assert/strict';
import { getContentSummary, normalizeContentSettings } from '../src/lib/content-settings';
import type { SiteContentSettings } from '../src/types';

const content: SiteContentSettings = {
  addBlankTarget: true,
  smoothScroll: true,
  addHeadingLevel: true,
  enhanceCodeBlock: true,
  enableCodeCopy: true,
  enableCodeFullscreen: true,
  enableLinkEmbed: true,
  enableCodePenEmbed: true,
  enableTweetEmbed: false,
  enableOGPreview: true,
  previewCacheTime: 30,
  lazyLoadEmbeds: true,
  postCardImagePosition: 'alternating',
  enableShokaContainers: true,
  enableShokaAttrs: true,
  enableShokaEffects: false,
  enableShokaSpoiler: true,
  enableShokaRuby: true,
  enableShokaHexoTags: true,
  enableMath: true,
  enableCodeMeta: true,
  enableQuiz: false,
  enableEncryptedBlock: true,
};

assert.deepEqual(normalizeContentSettings(content), content);

assert.equal(normalizeContentSettings({ previewCacheTime: -8 }).previewCacheTime, 0);
assert.equal(normalizeContentSettings({ previewCacheTime: 999 }).previewCacheTime, 365);
assert.equal(normalizeContentSettings({ previewCacheTime: 12.8 }).previewCacheTime, 13);
assert.equal(normalizeContentSettings({ postCardImagePosition: 'left' }).postCardImagePosition, 'left');
assert.equal(normalizeContentSettings({ postCardImagePosition: 'invalid' as SiteContentSettings['postCardImagePosition'] }).postCardImagePosition, 'alternating');

assert.deepEqual(getContentSummary(content), {
  enabledCount: 18,
  disabledCount: 3,
  cacheDays: 30,
  imagePositionLabel: '交替显示',
});

assert.deepEqual(getContentSummary({ previewCacheTime: 0, postCardImagePosition: 'right' }), {
  enabledCount: 0,
  disabledCount: 21,
  cacheDays: 0,
  imagePositionLabel: '封面在右',
});
