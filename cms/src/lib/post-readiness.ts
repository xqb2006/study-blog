import type { BlogSchema } from '@/types';

export type PostReadinessKey = 'title' | 'description' | 'categories' | 'tags' | 'cover' | 'content';
export type PostReadinessStatus = 'ready' | 'draft' | 'blocked';

export interface PostReadinessItem {
  key: PostReadinessKey;
  label: string;
  description: string;
  done: boolean;
}

export interface PostReadinessWarning {
  key: 'draft' | 'short-description' | 'long-title';
  label: string;
  description: string;
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function flattenCategories(categories: BlogSchema['categories']): string[] {
  if (!categories) return [];
  if (typeof categories === 'string') return categories.trim() ? [categories.trim()] : [];
  return categories.flatMap((item) => (Array.isArray(item) ? item : [item])).filter((item) => item.trim().length > 0);
}

function countWords(content: string): number {
  const cjkMatches = content.match(/[\u3400-\u9fff]/g) || [];
  const latinMatches = content.match(/[A-Za-z0-9]+(?:[-_'][A-Za-z0-9]+)*/g) || [];
  return cjkMatches.length + latinMatches.length;
}

function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/[#>*_~|[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getPostReadiness(frontmatter: BlogSchema, content: string) {
  const plainContent = stripMarkdown(content);
  const wordCount = countWords(plainContent);
  const categories = flattenCategories(frontmatter.categories);
  const tags = frontmatter.tags?.filter((tag) => tag.trim().length > 0) || [];

  const items: PostReadinessItem[] = [
    {
      key: 'title',
      label: '标题',
      description: '用于文章列表、分享卡片和搜索结果。',
      done: hasText(frontmatter.title),
    },
    {
      key: 'description',
      label: '摘要',
      description: '建议写清文章主题，方便首页和 SEO 展示。',
      done: hasText(frontmatter.description),
    },
    {
      key: 'categories',
      label: '分类',
      description: '至少设置一个分类，便于归档和导航。',
      done: categories.length > 0,
    },
    {
      key: 'tags',
      label: '标签',
      description: '至少设置一个标签，便于相关推荐。',
      done: tags.length > 0,
    },
    {
      key: 'cover',
      label: '封面',
      description: '封面会影响首页卡片和分享视觉。',
      done: hasText(frontmatter.cover),
    },
    {
      key: 'content',
      label: '正文',
      description: '正文至少写到 80 字，避免误发布空文章。',
      done: wordCount >= 80,
    },
  ];

  const missingItems = items.filter((item) => !item.done);
  const warnings: PostReadinessWarning[] = [];

  if (frontmatter.draft === true) {
    warnings.push({
      key: 'draft',
      label: '仍是草稿',
      description: '当前文章不会在前台发布展示。',
    });
  }

  if (hasText(frontmatter.description) && String(frontmatter.description).trim().length < 30) {
    warnings.push({
      key: 'short-description',
      label: '摘要偏短',
      description: '建议摘要写到 30 字以上，首页展示会更完整。',
    });
  }

  if (hasText(frontmatter.title) && String(frontmatter.title).trim().length > 48) {
    warnings.push({
      key: 'long-title',
      label: '标题偏长',
      description: '长标题在移动端卡片里可能换行过多。',
    });
  }

  const requiredDone = items.length - missingItems.length;
  const score = Math.round((requiredDone / items.length) * 100);
  const status: PostReadinessStatus = missingItems.length > 0 ? 'blocked' : frontmatter.draft === true ? 'draft' : 'ready';

  return {
    status,
    statusLabel: status === 'ready' ? '可以发布' : status === 'draft' ? '草稿检查' : '还差几项',
    score,
    items,
    missingItems,
    warnings,
    stats: {
      words: wordCount,
      minutes: Math.max(1, Math.ceil(wordCount / 350)),
    },
    summary: {
      requiredDone,
      requiredTotal: items.length,
      categories: categories.length,
      tags: tags.length,
    },
  };
}
