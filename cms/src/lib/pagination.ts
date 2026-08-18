export interface PageWindow<T> {
  items: T[];
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  start: number;
  end: number;
}

function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

export function getPageWindow<T>(items: T[], requestedPage: number, requestedPageSize: number): PageWindow<T> {
  const pageSize = normalizePositiveInteger(requestedPageSize, 10);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = normalizePositiveInteger(requestedPage, 1);
  const page = Math.min(Math.max(normalizedPage, 1), pageCount);
  const offset = (page - 1) * pageSize;
  const end = total === 0 ? 0 : Math.min(offset + pageSize, total);

  return {
    items: items.slice(offset, offset + pageSize),
    page,
    pageSize,
    pageCount,
    total,
    start: total === 0 ? 0 : offset + 1,
    end,
  };
}
