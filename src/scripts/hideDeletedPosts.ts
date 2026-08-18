type DeletedPostsManifest = {
  routes?: string[];
  updatedAt?: string;
};

const MANIFEST_PATH = '/deleted-posts.json';
const POST_CARD_SELECTOR = '.post-item-card';
const POST_LINK_SELECTOR = 'a[href*="/post/"]';
const HIDDEN_ATTRIBUTE = 'data-cms-deleted-hidden';
const MAX_MANIFEST_AGE_MS = 2 * 60 * 60 * 1000;
let deletedRoutesPromise: Promise<Set<string> | null> | null = null;

function normalizePath(path: string): string {
  const cleanPath = path.split('#')[0]?.split('?')[0] ?? path;
  if (!cleanPath.startsWith('/')) return `/${cleanPath}`;
  return cleanPath.endsWith('/') ? cleanPath : `${cleanPath}/`;
}

function getPostCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(POST_CARD_SELECTOR));
}

async function loadDeletedRouteSet(): Promise<Set<string> | null> {
  const response = await fetch(`${MANIFEST_PATH}?v=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'same-origin',
  });

  if (!response.ok) return null;

  const manifest = (await response.json()) as DeletedPostsManifest;
  if (!Array.isArray(manifest.routes) || manifest.routes.length === 0) return null;
  if (manifest.updatedAt) {
    const updatedAt = Date.parse(manifest.updatedAt);
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt > MAX_MANIFEST_AGE_MS) return null;
  }

  return new Set(manifest.routes.filter((route): route is string => typeof route === 'string').map(normalizePath));
}

function getDeletedRoutesPromise(): Promise<Set<string> | null> {
  deletedRoutesPromise ??= loadDeletedRouteSet();
  return deletedRoutesPromise;
}

function hideDeletedCards(deletedRoutes: Set<string>): void {
  const cards = getPostCards();
  if (!cards.length) return;

  for (const card of cards) {
    if (card.hasAttribute(HIDDEN_ATTRIBUTE)) continue;

    const links = Array.from(card.querySelectorAll<HTMLAnchorElement>(POST_LINK_SELECTOR));
    const shouldHide = links.some((link) => {
      const href = link.getAttribute('href');
      if (!href) return false;

      try {
        return deletedRoutes.has(normalizePath(new URL(href, window.location.origin).pathname));
      } catch {
        return deletedRoutes.has(normalizePath(href));
      }
    });

    if (shouldHide) {
      card.setAttribute(HIDDEN_ATTRIBUTE, 'true');
      card.hidden = true;
    }
  }
}

async function applyDeletedPostFilter(): Promise<void> {
  if (!getPostCards().length) return;

  try {
    const deletedRoutes = await getDeletedRoutesPromise();
    if (deletedRoutes?.size) {
      hideDeletedCards(deletedRoutes);
    }
  } catch {
    // Deleted-post filtering is a progressive enhancement; rebuild still removes stale cards.
  }
}

if (!window.location.pathname.includes('/post/')) {
  void getDeletedRoutesPromise();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyDeletedPostFilter, { once: true });
} else {
  void applyDeletedPostFilter();
}

document.addEventListener('astro:page-load', () => {
  void applyDeletedPostFilter();
});

