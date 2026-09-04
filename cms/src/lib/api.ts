/**
 * CMS API Client
 *
 * Client-side functions for reading and writing blog posts via the CMS API.
 */

import { format, isValid, parse, parseISO } from 'date-fns';
import type {
  BlogSchema,
  CreatePostParams,
  CreatePostResponse,
  DeleteCategoryResponse,
  DeleteCategoryMappingResponse,
  DeleteMediaResponse,
  DeletePostResponse,
  DeploymentStatusResponse,
  ImportMarkdownParams,
  ImportMarkdownResponse,
  ListPostsParams,
  ListPostsResponse,
  MediaListResponse,
  ReadPostResult,
  SaveSiteSettingsResponse,
  SiteSettings,
  SiteSettingsResponse,
  ToggleDraftResponse,
  ToggleStickyResponse,
  UploadMediaResponse,
  WritePostResponse,
} from '@/types';
import { setCategoryMap } from './category';

/**
 * Encode a slug for URL usage
 */
function encodeSlug(slug: string): string {
  return encodeURIComponent(slug);
}

/**
 * Safely parses a date string with fallback handling
 *
 * Supports multiple formats:
 * - "yyyy-MM-dd HH:mm:ss" (local time format)
 * - ISO 8601 format (e.g., "2026-01-03T12:00:00.000Z")
 *
 * @param dateStr - The date string to parse
 * @returns A valid Date object, or the current date if parsing fails
 */
function safeParseDateString(dateStr: string): Date {
  // Try ISO format first (contains 'T')
  if (dateStr.includes('T')) {
    const isoDate = parseISO(dateStr);
    if (isValid(isoDate)) {
      return isoDate;
    }
  }

  // Try local time format "yyyy-MM-dd HH:mm:ss"
  const localDate = parse(dateStr, 'yyyy-MM-dd HH:mm:ss', new Date());
  if (isValid(localDate)) {
    return localDate;
  }

  // Try date-only format "yyyy-MM-dd"
  const dateOnly = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (isValid(dateOnly)) {
    return dateOnly;
  }

  // Fallback: return current date
  console.warn(`[CMS API] Failed to parse date string: "${dateStr}", using current date`);
  return new Date();
}

/**
 * Serialize a Date object to local time string for API transmission
 * Preserves the user's intended time without UTC conversion
 *
 * @param date - Date object to serialize
 * @returns Local time string in "yyyy-MM-dd HH:mm:ss" format
 */
function serializeDateForApi(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Prepare frontmatter for API transmission
 * Converts Date objects to local time strings to prevent JSON.stringify
 * from converting them to UTC ISO format
 *
 * @param frontmatter - BlogSchema frontmatter object
 * @returns Frontmatter with Date objects converted to strings
 */
function prepareFrontmatterForApi(frontmatter: BlogSchema): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value instanceof Date) {
      result[key] = serializeDateForApi(value);
    } else if (value !== undefined && value !== null) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Reads a blog post from the CMS API
 *
 * @param postId - The post ID (e.g., 'note/front-end/theme.md')
 * @returns The frontmatter and content of the post
 * @throws Error if the request fails
 */
export async function readPost(postId: string): Promise<ReadPostResult> {
  const response = await fetch(`/api/cms/read?postId=${encodeSlug(postId)}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to read post: ${response.status}`);
  }

  const data = await response.json();

  // Convert date strings to Date objects with safe parsing
  if (data.frontmatter.date && typeof data.frontmatter.date === 'string') {
    data.frontmatter.date = safeParseDateString(data.frontmatter.date);
  }
  if (data.frontmatter.updated && typeof data.frontmatter.updated === 'string') {
    data.frontmatter.updated = safeParseDateString(data.frontmatter.updated);
  }

  return data as ReadPostResult;
}

/**
 * Read the latest Cloudflare Pages deployment status reported to GitHub.
 */
export async function getDeploymentStatus(): Promise<DeploymentStatusResponse> {
  const response = await fetch('/api/cms/deployment-status', { cache: 'no-store' });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to read deployment status: ${response.status}`);
  }

  return await response.json();
}

/**
 * Writes a blog post via the CMS API
 *
 * @param postId - The post ID (e.g., 'note/front-end/theme.md')
 * @param frontmatter - The post frontmatter
 * @param content - The post content (markdown)
 * @param categoryMappings - Optional new category mappings to add to config/site.yaml
 * @throws Error if the request fails
 */
export async function writePost(
  postId: string,
  frontmatter: BlogSchema,
  content: string,
  categoryMappings?: Record<string, string>,
): Promise<WritePostResponse> {
  const response = await fetch('/api/cms/write', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      postId,
      frontmatter: prepareFrontmatterForApi(frontmatter),
      content,
      categoryMappings,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to write post: ${response.status}`);
  }

  return response.json();
}

/**
 * Lists all blog posts with metadata and statistics
 *
 * @param params - Optional filter/sort parameters
 * @returns Posts list with statistics
 */
export async function listPosts(params?: ListPostsParams): Promise<ListPostsResponse> {
  const searchParams = new URLSearchParams();

  if (params?.category) searchParams.set('category', params.category);
  if (params?.tag) searchParams.set('tag', params.tag);
  if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.order) searchParams.set('order', params.order);

  const queryString = searchParams.toString();
  const url = `/api/cms/list${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to list posts: ${response.status}`);
  }

  return response.json();
}

/**
 * Creates a new blog post
 *
 * @param params - Post creation parameters
 * @returns The created post ID
 */
export async function createPost(params: CreatePostParams): Promise<CreatePostResponse> {
  const response = await fetch('/api/cms/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create post: ${response.status}`);
  }

  return response.json();
}

/**
 * Imports a Markdown document from an uploaded file or a public URL.
 */
export async function importMarkdown(params: ImportMarkdownParams): Promise<ImportMarkdownResponse> {
  const formData = new FormData();

  if (params.file) formData.append('file', params.file);
  if (params.url?.trim()) formData.append('url', params.url.trim());
  if (params.title?.trim()) formData.append('title', params.title.trim());
  if (params.category?.trim()) formData.append('category', params.category.trim());
  if (params.tags?.trim()) formData.append('tags', params.tags.trim());
  formData.append('draft', String(params.draft ?? false));

  const response = await fetch('/api/cms/import-markdown', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw await readJsonError(response, `Failed to import Markdown: ${response.status}`);
  }

  return response.json();
}

/**
 * Soft-deletes a blog post by moving it to the CMS trash folder.
 *
 * @param postId - The post ID (file path)
 * @returns The trash location for the deleted post
 */
export async function deletePost(postId: string): Promise<DeletePostResponse> {
  const response = await fetch('/api/cms/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ postId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete post: ${response.status}`);
  }

  return response.json();
}

export async function deleteCategory(categoryName: string): Promise<DeleteCategoryResponse> {
  const response = await fetch('/api/cms/categories/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ categoryName }),
  });

  if (!response.ok) {
    throw await readJsonError(response, `Failed to delete category: ${response.status}`);
  }

  return response.json();
}

export async function deleteCategoryMapping(categoryName: string): Promise<DeleteCategoryMappingResponse> {
  const response = await fetch('/api/cms/categories/mapping/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ categoryName }),
  });

  if (!response.ok) {
    throw await readJsonError(response, `Failed to delete category mapping: ${response.status}`);
  }

  return response.json();
}

/**
 * Toggles the draft status of a post
 *
 * @param postId - The post ID (file path)
 * @returns The new draft status
 */
export async function toggleDraft(postId: string): Promise<ToggleDraftResponse> {
  const response = await fetch('/api/cms/toggle-draft', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ postId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to toggle draft: ${response.status}`);
  }

  return response.json();
}

/**
 * Toggles the sticky status of a post
 *
 * @param postId - The post ID (file path)
 * @returns The new sticky status
 */
export async function toggleSticky(postId: string): Promise<ToggleStickyResponse> {
  const response = await fetch('/api/cms/toggle-sticky', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ postId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to toggle sticky: ${response.status}`);
  }

  return response.json();
}

/**
 * CMS configuration from server
 */
export interface CMSConfigResponse {
  projectRoot: string;
  contentDir: string;
  categoryMap: Record<string, string>;
}

// Cache for CMS config
let cachedConfig: CMSConfigResponse | null = null;

/**
 * Gets the CMS configuration from the server
 * Results are cached after the first call
 *
 * @returns The CMS configuration
 */
export async function getCMSConfig(): Promise<CMSConfigResponse> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const response = await fetch('/api/cms/config');

  if (!response.ok) {
    throw new Error('Failed to fetch CMS config');
  }

  const config: CMSConfigResponse = await response.json();
  cachedConfig = config;

  // Initialize category map for client-side detection
  setCategoryMap(config.categoryMap);

  return config;
}

async function readJsonError(response: Response, fallback: string): Promise<Error> {
  const errorData = await response.json().catch(() => ({}));
  return new Error(typeof errorData.error === 'string' ? errorData.error : fallback);
}

/**
 * Reads editable site settings from config/site.yaml.
 */
export async function getSiteSettings(): Promise<SiteSettingsResponse> {
  const response = await fetch('/api/cms/site-settings');

  if (!response.ok) {
    throw await readJsonError(response, `Failed to read site settings: ${response.status}`);
  }

  const result = (await response.json()) as SiteSettingsResponse;
  setCategoryMap(result.settings.categoryMap || {});
  return result;
}

/**
 * Saves editable site settings.
 */
export async function saveSiteSettings(settings: Partial<SiteSettings>): Promise<SaveSiteSettingsResponse> {
  const response = await fetch('/api/cms/site-settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw await readJsonError(response, `Failed to save site settings: ${response.status}`);
  }

  return response.json();
}

/**
 * Lists image assets under public/img.
 */
export async function listMedia(): Promise<MediaListResponse> {
  const response = await fetch('/api/cms/media');

  if (!response.ok) {
    throw await readJsonError(response, `Failed to list media: ${response.status}`);
  }

  return response.json();
}

/**
 * Uploads an image asset into public/img.
 */
export async function uploadMedia(file: File, directory: string): Promise<UploadMediaResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('directory', directory);

  const response = await fetch('/api/cms/media/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw await readJsonError(response, `Failed to upload media: ${response.status}`);
  }

  return response.json();
}

/**
 * Permanently deletes a media asset from the GitHub repository.
 */
export async function deleteMedia(publicPath: string): Promise<DeleteMediaResponse> {
  const response = await fetch('/api/cms/media/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ publicPath }),
  });

  if (!response.ok) {
    throw await readJsonError(response, `Failed to delete media: ${response.status}`);
  }

  return response.json();
}
