/**
 * CMS Type Definitions
 */

/**
 * Configuration for a single editor
 */
export interface EditorConfig {
  /** Unique identifier for the editor */
  id: string;
  /** Display name */
  name: string;
  /** Lucide / AppIcon name (legacy ri: ids still accepted) */
  icon: string;
  /** URL template with placeholders: {path}, {line}, {column} */
  urlTemplate: string;
}

/**
 * CMS configuration from cms.yaml
 */
export interface CMSConfig {
  /** Whether CMS features are enabled (dev only) */
  enabled: boolean;
  /** Absolute path to the local project directory */
  localProjectPath: string;
  /** Relative path from project root to content directory (default: 'src/content/blog') */
  contentRelativePath: string;
  /** List of configured editors */
  editors: EditorConfig[];
}

/**
 * Blog post frontmatter schema
 */
export interface BlogSchema {
  title: string;
  date?: Date;
  updated?: Date;
  description?: string;
  categories?: string | string[] | string[][];
  tags?: string[];
  cover?: string;
  link?: string;
  subtitle?: string;
  draft?: boolean;
  sticky?: boolean;
  tocNumbering?: boolean;
  excludeFromSummary?: boolean;
  math?: boolean;
  quiz?: boolean;
}

/**
 * Result from reading a post
 */
export interface ReadPostResult {
  frontmatter: BlogSchema;
  content: string;
}

/**
 * Post list item for dashboard display
 */
export interface PostListItem {
  id: string;
  slug: string;
  title: string;
  date: string;
  updated?: string;
  categories: string[];
  tags: string[];
  draft: boolean;
  sticky: boolean;
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  total: number;
  published: number;
  draft: number;
  categoryStats: { name: string; count: number }[];
  tagStats: { name: string; count: number }[];
  recentPosts: PostListItem[];
}

/**
 * Response from list posts API
 */
export interface ListPostsResponse {
  posts: PostListItem[];
  total: number;
  stats: DashboardStats;
  categories: string[];
  tags: string[];
}

/**
 * Parameters for listing posts
 */
export interface ListPostsParams {
  category?: string;
  tag?: string;
  status?: 'all' | 'draft' | 'published';
  search?: string;
  sort?: 'date' | 'title' | 'updated';
  order?: 'asc' | 'desc';
}

/**
 * Parameters for creating a post
 */
export interface CreatePostParams {
  title: string;
  categories?: string[];
  tags?: string[];
  draft?: boolean;
  categoryMappings?: Record<string, string>;
}

/**
 * Response from create post API
 */
export interface CreatePostResponse {
  success: boolean;
  postId: string;
  message?: string;
  buildSync?: BuildSyncSummary;
}

/**
 * Parameters for importing a Markdown document.
 */
export interface ImportMarkdownParams {
  file?: File;
  url?: string;
  title?: string;
  category?: string;
  tags?: string;
  draft?: boolean;
}

/**
 * Response from Markdown import API.
 */
export interface ImportMarkdownResponse {
  success: boolean;
  postId: string;
  source: 'upload' | 'url';
  frontmatter: BlogSchema;
  buildSync?: BuildSyncSummary;
}

/**
 * Response from write post API
 */
export interface WritePostResponse {
  success: boolean;
  buildSync?: BuildSyncSummary;
}

/**
 * Response from toggle draft API
 */
export interface ToggleDraftResponse {
  success: boolean;
  draft: boolean;
  buildSync?: BuildSyncSummary;
}

/**
 * Response from toggle sticky API
 */
export interface ToggleStickyResponse {
  success: boolean;
  sticky: boolean;
  buildSync?: BuildSyncSummary;
}

/**
 * Response from delete post API
 */
export interface DeletePostResponse {
  success: boolean;
  deleted: boolean;
  buildSync?: BuildSyncSummary;
}

export interface DeleteCategoryResponse {
  success: boolean;
  categoryName: string;
  updatedPostIds: string[];
  removedMapping: boolean;
  removedFeaturedCategories: number;
  removedFeaturedSeries: number;
  buildSync?: BuildSyncSummary;
}

export interface DeleteCategoryMappingResponse {
  success: boolean;
  categoryName: string;
  removed: boolean;
  buildSync?: BuildSyncSummary;
}

/**
 * Site settings exposed to the CMS dashboard.
 */
export interface SiteBasicSettings {
  title?: string;
  alternate?: string;
  subtitle?: string;
  name?: string;
  description?: string;
  avatar?: string;
  showLogo?: boolean;
  author?: string;
  url?: string;
  defaultOgImage?: string;
  startYear?: number;
  timezone?: string;
  keywords?: string[];
}

export interface SiteSocialLink {
  url: string;
  icon: string;
  color?: string;
}

export interface SiteNavigationItem {
  name: string;
  nameKey?: string;
  path?: string;
  icon?: string;
  children?: SiteNavigationItem[];
}

export interface SiteContentSettings {
  addBlankTarget?: boolean;
  smoothScroll?: boolean;
  addHeadingLevel?: boolean;
  enhanceCodeBlock?: boolean;
  enableCodeCopy?: boolean;
  enableCodeFullscreen?: boolean;
  enableLinkEmbed?: boolean;
  enableCodePenEmbed?: boolean;
  enableTweetEmbed?: boolean;
  enableOGPreview?: boolean;
  previewCacheTime?: number;
  lazyLoadEmbeds?: boolean;
  postCardImagePosition?: 'alternating' | 'left' | 'right';
  enableShokaContainers?: boolean;
  enableShokaAttrs?: boolean;
  enableShokaEffects?: boolean;
  enableShokaSpoiler?: boolean;
  enableShokaRuby?: boolean;
  enableShokaHexoTags?: boolean;
  enableMath?: boolean;
  enableCodeMeta?: boolean;
  enableQuiz?: boolean;
  enableEncryptedBlock?: boolean;
}

export type CategoryMapSettings = Record<string, string>;

export interface FeaturedCategoryItem {
  link: string;
  label: string;
  image: string;
  description: string;
}

export interface FeaturedSeriesItem {
  slug: string;
  categoryName: string;
  label?: string;
  fullName?: string;
  description?: string;
  cover?: string;
  enabled?: boolean;
  icon?: string;
  highlightOnHome?: boolean;
  links?: Record<string, string>;
}

export interface FriendIntroSettings {
  title?: string;
  subtitle?: string;
  applyTitle?: string;
  applyDesc?: string;
  exampleYaml?: string;
}

export interface FriendLinkItem {
  site: string;
  url: string;
  owner: string;
  desc: string;
  image: string;
  color?: string;
}

export interface FriendsSettings {
  intro: FriendIntroSettings;
  data: FriendLinkItem[];
}

export interface AnnouncementLink {
  url: string;
  text: string;
  external?: boolean;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority?: number;
  color?: string;
  publishDate?: string;
  startDate?: string;
  endDate?: string;
  link?: AnnouncementLink;
}

export type CommentProvider = 'none' | 'remark42' | 'giscus' | 'waline' | 'twikoo';

export interface Remark42Settings {
  host?: string;
  siteId?: string;
}

export interface GiscusSettings {
  repo?: string;
  repoId?: string;
  category?: string;
  categoryId?: string;
  mapping?: string;
  reactionsEnabled?: '0' | '1' | string;
  emitMetadata?: '0' | '1' | string;
  inputPosition?: 'top' | 'bottom' | string;
  lang?: string;
  host?: string;
  theme?: string;
  loading?: 'lazy' | 'eager' | string;
}

export interface WalineSettings {
  serverURL?: string;
  lang?: string;
  dark?: string | boolean;
  meta?: string[];
  requiredMeta?: string[];
  login?: 'enable' | 'disable' | 'force' | string;
  wordLimit?: number | [number, number];
  pageSize?: number;
  imageUploader?: boolean;
  highlighter?: boolean;
  texRenderer?: boolean;
  search?: boolean;
  reaction?: boolean | string[];
  emoji?: boolean | string[] | Record<string, unknown>[];
  commentSorting?: 'latest' | 'oldest' | 'hottest' | string;
  noCopyright?: boolean;
  comment?: boolean;
  pageview?: boolean;
  recaptchaV3Key?: string;
  turnstileKey?: string;
  locale?: Record<string, string>;
}

export interface TwikooSettings {
  envId?: string;
  region?: string;
  path?: string;
  lang?: string;
}

export interface CommentSettings {
  provider: CommentProvider;
  remark42?: Remark42Settings;
  giscus?: GiscusSettings;
  waline?: WalineSettings;
  twikoo?: TwikooSettings;
}

export interface UmamiStatisticsDisplay {
  token?: string;
  article_page_views?: boolean;
  footer_site_stats?: boolean;
}

export interface UmamiSettings {
  enabled?: boolean;
  id?: string;
  endpoint?: string;
  statistics_display?: UmamiStatisticsDisplay;
}

export interface AnalyticsSettings {
  umami: UmamiSettings;
}

export interface RobotsPolicy {
  userAgent: string;
  allow?: string | string[];
  disallow?: string | string[];
}

export interface SeoSettings {
  robots: {
    host?: boolean;
    policy?: RobotsPolicy[];
  };
}

export interface BgmPlaylist {
  title: string;
  list: string[];
}

export interface BgmSettings {
  enabled?: boolean;
  metingApi?: string;
  audio: BgmPlaylist[];
}

export interface SiteSettings {
  site: SiteBasicSettings;
  social: Record<string, SiteSocialLink>;
  navigation: SiteNavigationItem[];
  content: SiteContentSettings;
  categoryMap: CategoryMapSettings;
  featuredCategories: FeaturedCategoryItem[];
  featuredSeries: FeaturedSeriesItem[];
  friends: FriendsSettings;
  announcements: AnnouncementItem[];
  comment: CommentSettings;
  analytics: AnalyticsSettings;
  seo: SeoSettings;
  bgm: BgmSettings;
}

export interface SiteSettingsResponse {
  success: boolean;
  configPath: string;
  settings: SiteSettings;
  runtimeSync?: RuntimeSyncSummary;
}

export interface SaveSiteSettingsResponse {
  success: boolean;
  settings: SiteSettings;
  rebuildStarted?: boolean;
  rebuildMessage?: string;
  runtimeSync?: RuntimeSyncSummary;
  buildSync?: BuildSyncSummary;
}

export interface MediaFile {
  name: string;
  publicPath: string;
  previewUrl?: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
  extension: string;
}

export interface MediaListResponse {
  success: boolean;
  root: string;
  files: MediaFile[];
}

export interface UploadMediaResponse {
  success: boolean;
  file: MediaFile;
  overwritten?: boolean;
}

export interface DeleteMediaResponse {
  success: boolean;
  deleted: boolean;
  publicPath: string;
}

export interface BuildSyncSummary {
  started: boolean;
  queued: boolean;
  failed: boolean;
  message: string;
}

export interface RuntimeSyncSummary {
  success: boolean;
  path: string;
  updatedAt?: string;
  message: string;
}
