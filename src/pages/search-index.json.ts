import { buildSearchIndex } from '@lib/search-index';

export async function GET() {
  const index = await buildSearchIndex();

  return new Response(JSON.stringify(index), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
