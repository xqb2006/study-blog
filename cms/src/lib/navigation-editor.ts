import type { SiteNavigationItem } from '@/types';

type NavigationPath = [number] | [number, number];

export function createEmptyNavigationItem(): SiteNavigationItem {
  return {
    name: '新菜单',
    path: '/',
    icon: 'ri:links-line',
  };
}

function cloneNavigation(navigation: SiteNavigationItem[]): SiteNavigationItem[] {
  return JSON.parse(JSON.stringify(navigation || [])) as SiteNavigationItem[];
}

export function addNavigationItem(navigation: SiteNavigationItem[], item = createEmptyNavigationItem()): SiteNavigationItem[] {
  return [...cloneNavigation(navigation), { ...item }];
}

export function addNavigationChild(navigation: SiteNavigationItem[], parentIndex: number, item = createEmptyNavigationItem()): SiteNavigationItem[] {
  const next = cloneNavigation(navigation);
  const parent = next[parentIndex];
  if (!parent) return next;
  parent.children = [...(parent.children || []), { ...item }];
  return next;
}

export function updateNavigationItem(
  navigation: SiteNavigationItem[],
  path: NavigationPath,
  patch: Partial<SiteNavigationItem>,
): SiteNavigationItem[] {
  const next = cloneNavigation(navigation);
  const [parentIndex, childIndex] = path;
  const target = childIndex === undefined ? next[parentIndex] : next[parentIndex]?.children?.[childIndex];
  if (!target) return next;
  Object.assign(target, patch);
  return next;
}

export function removeNavigationItem(navigation: SiteNavigationItem[], path: NavigationPath): SiteNavigationItem[] {
  const next = cloneNavigation(navigation);
  const [parentIndex, childIndex] = path;
  if (childIndex === undefined) {
    return next.filter((_, index) => index !== parentIndex);
  }
  const parent = next[parentIndex];
  if (!parent?.children) return next;
  parent.children = parent.children.filter((_, index) => index !== childIndex);
  if (parent.children.length === 0) delete parent.children;
  return next;
}

export function moveNavigationItem(navigation: SiteNavigationItem[], path: NavigationPath, direction: -1 | 1): SiteNavigationItem[] {
  const next = cloneNavigation(navigation);
  const [parentIndex, childIndex] = path;
  const siblings = childIndex === undefined ? next : next[parentIndex]?.children;
  const itemIndex = childIndex === undefined ? parentIndex : childIndex;
  if (!siblings) return next;

  const swapIndex = itemIndex + direction;
  if (swapIndex < 0 || swapIndex >= siblings.length) return next;

  const current = siblings[itemIndex];
  const swap = siblings[swapIndex];
  if (!current || !swap) return next;

  siblings[itemIndex] = swap;
  siblings[swapIndex] = current;
  return next;
}

function cleanNavigationItem(item: SiteNavigationItem): SiteNavigationItem {
  const children = normalizeNavigation(item.children || []);
  return {
    name: item.name.trim(),
    ...(item.nameKey?.trim() ? { nameKey: item.nameKey.trim() } : {}),
    ...(item.path?.trim() ? { path: item.path.trim() } : {}),
    ...(item.icon?.trim() ? { icon: item.icon.trim() } : {}),
    ...(children.length ? { children } : {}),
  };
}

export function normalizeNavigation(navigation: SiteNavigationItem[]): SiteNavigationItem[] {
  return navigation.filter((item) => item.name?.trim()).map(cleanNavigationItem);
}

function validateNavigationItem(item: unknown, label: string): string | undefined {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return `${label} 必须是对象`;
  const value = item as Partial<SiteNavigationItem>;
  if (typeof value.name !== 'string' || !value.name.trim()) return `${label}缺少菜单名称`;
  if (value.nameKey !== undefined && typeof value.nameKey !== 'string') return `${label}的 nameKey 必须是字符串`;
  if (value.path !== undefined && typeof value.path !== 'string') return `${label}的 path 必须是字符串`;
  if (value.icon !== undefined && typeof value.icon !== 'string') return `${label}的 icon 必须是字符串`;
  if (value.children !== undefined) {
    if (!Array.isArray(value.children)) return `${label}的 children 必须是数组`;
    for (const [childIndex, child] of value.children.entries()) {
      const childError = validateNavigationItem(child, `${label}.${childIndex + 1} 子项`);
      if (childError) return childError;
    }
  }
  return undefined;
}

export function parseNavigationJson(text: string): { navigation?: SiteNavigationItem[]; error?: string } {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return { error: '导航必须是数组' };

    for (const [index, item] of parsed.entries()) {
      const error = validateNavigationItem(item, `第 ${index + 1} 项`);
      if (error) return { error };
    }

    return { navigation: normalizeNavigation(parsed as SiteNavigationItem[]) };
  } catch {
    return { error: '导航 JSON 格式不正确' };
  }
}
