import { Routes } from '@constants/router';
import { getPostLocale } from '@lib/content/locale';
import { getPostDescriptionWithSummary, getSortedPosts } from '@lib/content/posts';
import { routeBuilder } from '@lib/route';
import { extractTextFromMarkdown } from '@lib/sanitize';

export interface SearchIndexItem {
  title: string;
  description: string;
  url: string;
  locale: string;
  categories: string[];
  tags: string[];
  date: string;
  content: string;
}

function flattenCategories(categories?: string[] | string[][]): string[] {
  if (!categories?.length) return [];
  return categories.flatMap((category) => (Array.isArray(category) ? category : [category]));
}

export async function buildSearchIndex(): Promise<SearchIndexItem[]> {
  const posts = await getSortedPosts();

  return posts
    .filter((post) => post.data.draft !== true && !post.data.password)
    .map((post) => {
      const locale = getPostLocale(post);
      const categories = flattenCategories(post.data.categories);
      const tags = post.data.tags ?? [];
      const description = getPostDescriptionWithSummary(post, locale, 180);

      return {
        title: post.data.title,
        description,
        url: routeBuilder(Routes.Post, post),
        locale,
        categories,
        tags,
        date: post.data.date.toISOString(),
        content: extractTextFromMarkdown(post.body ?? '', 4000),
      };
    });
}
