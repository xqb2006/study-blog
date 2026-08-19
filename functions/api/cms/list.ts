import { errorMessage, listPosts, normalizeStringList } from '../../_lib/cms';
import { json } from '../../_lib/github';

export const onRequestGet = async (context: any) => {
  try {
    const requestUrl = new URL(context.request.url);
    const status = requestUrl.searchParams.get('status');
    const category = requestUrl.searchParams.get('category')?.trim();
    const tag = requestUrl.searchParams.get('tag')?.trim();
    const search = requestUrl.searchParams.get('search')?.trim().toLowerCase();
    const sort = requestUrl.searchParams.get('sort') ?? 'date';
    const order = requestUrl.searchParams.get('order') === 'asc' ? 1 : -1;
    const allPosts = await listPosts(context);
    const posts = allPosts
      .filter((post) => (!status || status === 'all' || (status === 'draft' ? post.draft : !post.draft)))
      .filter((post) => (!category || post.categories.includes(category)) && (!tag || post.tags.includes(tag)))
      .filter((post) => !search || [post.title, post.id, ...post.categories, ...post.tags].join(' ').toLowerCase().includes(search))
      .sort((left, right) => String(left[sort === 'title' ? 'title' : sort === 'updated' ? 'updated' : 'date'] ?? '').localeCompare(String(right[sort === 'title' ? 'title' : sort === 'updated' ? 'updated' : 'date'] ?? '')) * order);
    const categoryCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    for (const post of allPosts) {
      normalizeStringList(post.categories).forEach((item) => categoryCounts.set(item, (categoryCounts.get(item) ?? 0) + 1));
      normalizeStringList(post.tags).forEach((item) => tagCounts.set(item, (tagCounts.get(item) ?? 0) + 1));
    }
    return json({
      posts,
      total: posts.length,
      categories: [...categoryCounts.keys()].sort(),
      tags: [...tagCounts.keys()].sort(),
      stats: {
        total: allPosts.length,
        published: allPosts.filter((post) => !post.draft).length,
        draft: allPosts.filter((post) => post.draft).length,
        categoryStats: [...categoryCounts].map(([name, count]) => ({ name, count })),
        tagStats: [...tagCounts].map(([name, count]) => ({ name, count })),
        recentPosts: [...allPosts].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 5),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: errorMessage(error) }, 500);
  }
};
