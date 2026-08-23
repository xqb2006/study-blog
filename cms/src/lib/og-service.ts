/**
 * OG Data Service
 *
 * Provides a client-side fallback for link previews in the static CMS.
 */

export interface OGData {
  originUrl: string;
  url: string;
  title?: string;
  description?: string;
  image?: string | null;
  logo?: string | null;
  error?: string;
}

interface CacheEntry {
  data: OGData;
  timestamp: number;
}

interface CacheData {
  [url: string]: CacheEntry;
}

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// In-memory cache for client-side
let memoryCache: CacheData = {};

/**
 * Returns the in-memory cache.
 */
export async function loadCache(): Promise<CacheData> {
  return memoryCache;
}

/**
 * Get cached OG data if valid
 */
export function getCachedOGData(url: string): OGData | null {
  const entry = memoryCache[url];

  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }

  return null;
}

/**
 * Update memory cache with new data
 */
export function updateMemoryCache(url: string, data: OGData): void {
  memoryCache[url] = {
    data,
    timestamp: Date.now(),
  };
}

/**
 * Builds a local fallback when server-side OG extraction is unavailable.
 */
export async function fetchOGData(url: string): Promise<OGData> {
  let title = url;
  try {
    title = new URL(url).hostname;
  } catch {}

  const data = { originUrl: url, url, title };
  updateMemoryCache(url, data);
  return data;
}

/**
 * Get OG data with cache-first strategy
 */
export async function getOGData(url: string): Promise<OGData> {
  // Check memory cache first
  const cached = getCachedOGData(url);
  if (cached) {
    return cached;
  }

  return fetchOGData(url);
}

/**
 * Batch load OG data for multiple URLs
 */
export async function batchLoadOGData(urls: string[]): Promise<Map<string, OGData>> {
  const results = new Map<string, OGData>();

  // First, check cache for all URLs
  const uncachedUrls: string[] = [];
  for (const url of urls) {
    const cached = getCachedOGData(url);
    if (cached) {
      results.set(url, cached);
    } else {
      uncachedUrls.push(url);
    }
  }

  if (uncachedUrls.length > 0) {
    const fetchPromises = uncachedUrls.map(async (url) => {
      const data = await fetchOGData(url);
      return { url, data };
    });

    const fetchedResults = await Promise.all(fetchPromises);
    for (const { url, data } of fetchedResults) {
      results.set(url, data);
    }
  }

  return results;
}
