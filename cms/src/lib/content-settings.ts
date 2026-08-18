import type { SiteContentSettings } from '@/types';

export type BooleanContentKey =
  | 'addBlankTarget'
  | 'smoothScroll'
  | 'addHeadingLevel'
  | 'enhanceCodeBlock'
  | 'enableCodeCopy'
  | 'enableCodeFullscreen'
  | 'enableLinkEmbed'
  | 'enableCodePenEmbed'
  | 'enableTweetEmbed'
  | 'enableOGPreview'
  | 'lazyLoadEmbeds'
  | 'enableShokaContainers'
  | 'enableShokaAttrs'
  | 'enableShokaEffects'
  | 'enableShokaSpoiler'
  | 'enableShokaRuby'
  | 'enableShokaHexoTags'
  | 'enableMath'
  | 'enableCodeMeta'
  | 'enableQuiz'
  | 'enableEncryptedBlock';

export const BOOLEAN_CONTENT_KEYS: BooleanContentKey[] = [
  'addBlankTarget',
  'smoothScroll',
  'addHeadingLevel',
  'enhanceCodeBlock',
  'enableCodeCopy',
  'enableCodeFullscreen',
  'enableLinkEmbed',
  'enableCodePenEmbed',
  'enableTweetEmbed',
  'enableOGPreview',
  'lazyLoadEmbeds',
  'enableShokaContainers',
  'enableShokaAttrs',
  'enableShokaEffects',
  'enableShokaSpoiler',
  'enableShokaRuby',
  'enableShokaHexoTags',
  'enableMath',
  'enableCodeMeta',
  'enableQuiz',
  'enableEncryptedBlock',
];

const IMAGE_POSITION_LABELS: Record<NonNullable<SiteContentSettings['postCardImagePosition']>, string> = {
  alternating: '交替显示',
  left: '封面在左',
  right: '封面在右',
};

function normalizeCacheDays(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return undefined;
  return Math.min(365, Math.max(0, Math.round(numericValue)));
}

export function normalizePostCardImagePosition(value: unknown): NonNullable<SiteContentSettings['postCardImagePosition']> {
  return value === 'left' || value === 'right' || value === 'alternating' ? value : 'alternating';
}

export function normalizeContentSettings(value: SiteContentSettings): SiteContentSettings {
  const next: SiteContentSettings = {};

  for (const key of BOOLEAN_CONTENT_KEYS) {
    if (value[key] !== undefined) next[key] = value[key] === true;
  }

  const previewCacheTime = normalizeCacheDays(value.previewCacheTime);
  if (previewCacheTime !== undefined) next.previewCacheTime = previewCacheTime;
  next.postCardImagePosition = normalizePostCardImagePosition(value.postCardImagePosition);

  return next;
}

export function getContentSummary(value: SiteContentSettings) {
  const enabledCount = BOOLEAN_CONTENT_KEYS.filter((key) => value[key] === true).length;
  const cacheDays = normalizeCacheDays(value.previewCacheTime) ?? 30;
  const imagePosition = normalizePostCardImagePosition(value.postCardImagePosition);

  return {
    enabledCount,
    disabledCount: BOOLEAN_CONTENT_KEYS.length - enabledCount,
    cacheDays,
    imagePositionLabel: IMAGE_POSITION_LABELS[imagePosition],
  };
}
