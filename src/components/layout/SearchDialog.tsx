/**
 * SearchDialog Component
 *
 * A search dialog with keyboard navigation for searching blog posts.
 * Uses a static JSON index generated at build time to avoid runtime WASM
 * loading failures from the Pagefind UI bundle.
 */

import { Dialog, DialogPortal } from '@components/ui/dialog';
import { useIsMounted } from '@hooks/useIsMounted';
import { useEscapeKey, useKeyboardShortcut } from '@hooks/useKeyboardShortcut';
import { useSearchKeyboardNav } from '@hooks/useSearchKeyboardNav';
import { useTranslation } from '@hooks/useTranslation';
import { cn } from '@lib/utils';
import { useStore } from '@nanostores/react';
import { $isSearchOpen, closeModal, openModal } from '@store/modal';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface SearchIndexItem {
  title: string;
  description?: string;
  url: string;
  locale: string;
  categories: string[];
  tags: string[];
  date: string;
  content: string;
}

interface RankedSearchResult extends SearchIndexItem {
  score: number;
  excerpt: string;
}

const DEFAULT_LOCALE = 'zh';
const INITIAL_RESULT_COUNT = 8;

let searchIndexCache: SearchIndexItem[] | null = null;
let searchIndexPromise: Promise<SearchIndexItem[]> | null = null;

function readInlineSearchIndex(): SearchIndexItem[] | null {
  const element = document.getElementById('site-search-index');
  const text = element?.textContent;
  if (!text) return null;

  try {
    return JSON.parse(text) as SearchIndexItem[];
  } catch (error) {
    console.error('Failed to parse inline search index:', error);
    return null;
  }
}

function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase().trim();
}

function getSearchTerms(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  return normalized.split(/\s+/).filter(Boolean);
}

async function loadSearchIndex(): Promise<SearchIndexItem[]> {
  if (searchIndexCache) return searchIndexCache;

  const inlineIndex = readInlineSearchIndex();
  if (inlineIndex) {
    searchIndexCache = inlineIndex;
    return inlineIndex;
  }

  searchIndexPromise ??= fetch('/search-index.json', {
    headers: { accept: 'application/json' },
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Search index request failed: ${response.status}`);
    const data = (await response.json()) as SearchIndexItem[];
    searchIndexCache = data;
    return data;
  });
  return searchIndexPromise;
}

function getLocaleItems(items: SearchIndexItem[], locale: string): SearchIndexItem[] {
  if (locale === DEFAULT_LOCALE) return items.filter((item) => item.locale === DEFAULT_LOCALE);

  const byUrl = new Map<string, SearchIndexItem>();
  for (const item of items) {
    if (item.locale === DEFAULT_LOCALE) byUrl.set(item.url, item);
  }
  for (const item of items) {
    if (item.locale === locale) byUrl.set(item.url, item);
  }

  return Array.from(byUrl.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function scoreField(value: string, terms: string[], weight: number): number {
  const normalized = normalizeSearchText(value);
  if (!normalized) return 0;
  return terms.reduce((score, term) => (normalized.includes(term) ? score + weight : score), 0);
}

function createExcerpt(item: SearchIndexItem, terms: string[]): string {
  const source = item.description || item.content || item.title;
  const normalizedSource = normalizeSearchText(source);
  const firstMatch = terms
    .map((term) => normalizedSource.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (firstMatch === undefined) return source.slice(0, 140);

  const start = Math.max(0, firstMatch - 42);
  const end = Math.min(source.length, firstMatch + 110);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < source.length ? '...' : '';
  return `${prefix}${source.slice(start, end)}${suffix}`;
}

function searchItems(items: SearchIndexItem[], query: string, locale: string): RankedSearchResult[] {
  const terms = getSearchTerms(query);
  if (!terms.length) return [];

  return getLocaleItems(items, locale)
    .map((item) => {
      const searchable = normalizeSearchText(
        [item.title, item.description, item.categories.join(' '), item.tags.join(' '), item.content].filter(Boolean).join(' '),
      );
      if (!terms.every((term) => searchable.includes(term))) return null;

      const score =
        scoreField(item.title, terms, 12) +
        scoreField(item.tags.join(' '), terms, 8) +
        scoreField(item.categories.join(' '), terms, 6) +
        scoreField(item.description ?? '', terms, 4) +
        scoreField(item.content, terms, 1);

      return {
        ...item,
        score,
        excerpt: createExcerpt(item, terms),
      };
    })
    .filter((item): item is RankedSearchResult => item !== null)
    .sort((a, b) => b.score - a.score || new Date(b.date).getTime() - new Date(a.date).getTime());
}

function formatResultMessage(template: string, query: string, count: number): string {
  return template.replace('[SEARCH_TERM]', query).replace('[COUNT]', new Intl.NumberFormat().format(count));
}

function resolveResultUrl(item: SearchIndexItem, locale: string): string {
  if (locale === DEFAULT_LOCALE) return item.url;
  return `/${locale}${item.url.startsWith('/') ? item.url : `/${item.url}`}`;
}

// Icons
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <title>Search</title>
      <path d="M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168ZM16.0247 15.8748C17.2475 14.6146 18 12.8956 18 11C18 7.1325 14.8675 4 11 4C7.1325 4 4 7.1325 4 11C4 14.8675 7.1325 18 11 18C12.8956 18 14.6146 17.2475 15.8748 16.0247L16.0247 15.8748Z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <title>Close</title>
      <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" />
    </svg>
  );
}

export default function SearchDialog() {
  const { t, locale } = useTranslation();
  const isOpen = useStore($isSearchOpen);
  const { containerRef } = useSearchKeyboardNav(isOpen);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchIndexItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_RESULT_COUNT);

  const results = useMemo(() => searchItems(items, query, locale), [items, query, locale]);
  const visibleResults = results.slice(0, visibleCount);
  const hasQuery = query.trim().length > 0;
  const hasMore = results.length > visibleCount;

  const resultMessage = useMemo(() => {
    if (!hasQuery) return '';
    if (isLoading) return formatResultMessage(t('search.searching'), query, 0);
    if (hasLoadError) return t('search.noResults');
    if (results.length === 0) return formatResultMessage(t('search.noResults'), query, 0);
    const template = results.length === 1 ? t('search.oneResult') : t('search.manyResults');
    return formatResultMessage(template, query, results.length);
  }, [hasLoadError, hasQuery, isLoading, query, results.length, t]);

  // Cmd/Ctrl + K to open
  useKeyboardShortcut({
    key: 'k',
    modifiers: ['meta'],
    handler: () => openModal('search'),
  });

  // ESC to close
  useEscapeKey(() => {
    if (isOpen) closeModal();
  }, isOpen);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoading(true);
    setHasLoadError(false);
    loadSearchIndex()
      .then((data) => {
        if (cancelled) return;
        setItems(data);
      })
      .catch((error) => {
        console.error('Failed to load search index:', error);
        if (cancelled) return;
        setHasLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    setTimeout(() => {
      const searchInput = document.querySelector('.pagefind-ui__search-input') as HTMLInputElement;
      searchInput?.focus();
    }, 150);

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Close before page navigation
  useEffect(() => {
    const handleBeforePreparation = () => closeModal();

    document.addEventListener('astro:before-preparation', handleBeforePreparation);
    return () => {
      document.removeEventListener('astro:before-preparation', handleBeforePreparation);
    };
  }, []);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogPortal forceMount>
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Overlay */}
              <motion.div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />

              {/* Dialog */}
              <motion.div
                className="fixed inset-0 z-50 grid place-items-center px-4"
                onClick={handleBackgroundClick}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <motion.div
                  className="w-full max-w-3xl overflow-auto rounded-xl bg-gradient-start text-foreground shadow-box"
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="relative p-6 md:p-3">
                    <div className="search-dialog">
                      {/* Header */}
                      <div className="relative mb-4 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 font-semibold text-lg md:text-base">
                          <SearchIcon className="size-5 md:size-4" />
                          {t('search.dialogTitle')}
                        </h2>
                        <button
                          type="button"
                          onClick={closeModal}
                          className="flex size-8 items-center justify-center rounded-full bg-black/5 transition-colors duration-300 hover:bg-black/10 md:size-7 dark:bg-white/10 dark:hover:bg-white/20"
                          aria-label={t('search.dialogClose')}
                        >
                          <CloseIcon className="size-5 md:size-4" />
                        </button>
                      </div>

                      {/* Empty hint */}
                      <div
                        id="search-empty-hint"
                        className="search-empty-hint absolute inset-x-0 top-32 text-center text-sm opacity-60 md:top-28"
                      >
                        <p>{t('search.dialogHint')}</p>
                        <p className="mt-1 text-xs">
                          <kbd className="kbd">ESC</kbd> {t('search.dialogClose')}
                        </p>
                      </div>

                      {/* Search Content Area */}
                      <div className="vertical-scrollbar scroll-feather-mask -mx-6 h-[calc(80dvh-140px)] overflow-auto scroll-smooth px-6 pb-8 after:bottom-10 md:-mx-3 md:h-[calc(80dvh-120px)] md:px-3">
                        <div id="search-dialog-container" ref={containerRef}>
                          <div className="pagefind-ui">
                            <form
                              className="pagefind-ui__form"
                              aria-label={t('search.label')}
                              onSubmit={(event) => event.preventDefault()}
                            >
                              <input
                                className="pagefind-ui__search-input"
                                type="text"
                                placeholder={t('search.placeholder')}
                                title={t('search.placeholder')}
                                autoCapitalize="none"
                                enterKeyHint="search"
                                value={query}
                                onChange={(event) => {
                                  setQuery(event.target.value);
                                  setVisibleCount(INITIAL_RESULT_COUNT);
                                }}
                              />
                              <button
                                type="button"
                                className={cn('pagefind-ui__search-clear', !query && 'pagefind-ui__suppressed')}
                                onClick={() => setQuery('')}
                              >
                                {t('search.clear')}
                              </button>
                            </form>

                            {hasQuery && (
                              <div className="pagefind-ui__drawer">
                                <div className="pagefind-ui__results-area" aria-live="polite">
                                  <p className="pagefind-ui__message">{resultMessage}</p>
                                  {!!visibleResults.length && (
                                    <ol className="pagefind-ui__results">
                                      {visibleResults.map((result) => (
                                        <li key={`${result.locale}:${result.url}`} className="pagefind-ui__result">
                                          <div className="pagefind-ui__result-inner">
                                            <p className="pagefind-ui__result-title">
                                              <a
                                                className="pagefind-ui__result-link"
                                                href={resolveResultUrl(result, locale)}
                                                onClick={closeModal}
                                              >
                                                {result.title}
                                              </a>
                                            </p>
                                            <p className="pagefind-ui__result-excerpt">{result.excerpt}</p>
                                            {!!result.tags.length && (
                                              <ul className="pagefind-ui__result-tags">
                                                {result.tags.slice(0, 4).map((tag) => (
                                                  <li key={tag} className="pagefind-ui__result-tag">
                                                    {tag}
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
                                          </div>
                                        </li>
                                      ))}
                                    </ol>
                                  )}
                                  {hasMore && (
                                    <button
                                      type="button"
                                      className="pagefind-ui__button"
                                      onClick={() => setVisibleCount((count) => count + INITIAL_RESULT_COUNT)}
                                    >
                                      {t('search.loadMore')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Keyboard hints */}
                    <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-4 bg-gradient-start px-4 pt-1 pb-4 text-black/50 text-xs dark:border-white/10 dark:text-white/50">
                      <span>
                        <kbd className="kbd">↑↓</kbd> {t('search.dialogSelect')}
                      </span>
                      <span>
                        <kbd className="kbd">Enter</kbd> {t('search.dialogOpen')}
                      </span>
                      <span>
                        <kbd className="kbd">ESC</kbd> {t('search.dialogClose')}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </DialogPortal>
    </Dialog>
  );
}

/**
 * Search trigger button component
 */
export function SearchTrigger({ className }: { className?: string }) {
  const isMounted = useIsMounted();
  const { t } = useTranslation();

  // Only compute platform-specific shortcut after mount to avoid hydration mismatch
  const title = useMemo(() => {
    if (!isMounted) return undefined;
    const platform = navigator.userAgentData?.platform || navigator.userAgent;
    const isMac = /mac/i.test(platform);
    return t('search.searchShortcut', { shortcut: isMac ? '⌘K' : 'Ctrl+K' });
  }, [isMounted, t]);

  return (
    <button
      type="button"
      onClick={() => openModal('search')}
      className={cn('cursor-pointer transition duration-300 hover:scale-125', className)}
      aria-label={t('common.search')}
      title={title}
    >
      <SearchIcon className="size-8" />
    </button>
  );
}
