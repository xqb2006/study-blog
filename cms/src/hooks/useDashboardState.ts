/**
 * Dashboard State Hook
 *
 * Manages dashboard navigation, post data, filters, sorting, and article actions.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { deletePost, listPosts, toggleDraft, toggleSticky } from '@/lib/api';
import type { BuildSyncSummary, ListPostsResponse } from '@/types';

export type Tab =
  | 'overview'
  | 'posts'
  | 'settings'
  | 'taxonomy'
  | 'operations'
  | 'friends'
  | 'announcements'
  | 'bgm'
  | 'media';
export type StatusFilter = 'all' | 'draft' | 'published';
export type SortField = 'date' | 'updated' | 'title';
export type SortOrder = 'asc' | 'desc';
export type PendingPostDeletion = { postId: string; title: string } | null;

export interface UseDashboardStateResult {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  data: ListPostsResponse | null;
  isLoading: boolean;
  error: string | null;
  isCreateDialogOpen: boolean;
  setIsCreateDialogOpen: (open: boolean) => void;
  editingPostId: string | null;
  search: string;
  setSearch: (search: string) => void;
  category: string;
  setCategory: (category: string) => void;
  status: StatusFilter;
  setStatus: (status: StatusFilter) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  fetchData: () => Promise<void>;
  handleSort: (field: SortField) => void;
  handleToggleDraft: (postId: string) => Promise<void>;
  handleToggleSticky: (postId: string) => Promise<void>;
  handleDeletePost: (postId: string, title: string) => Promise<void>;
  pendingPostDeletion: PendingPostDeletion;
  confirmDeletePost: () => Promise<void>;
  cancelDeletePost: () => void;
  handleCreatePostSuccess: (postId: string, buildSync?: BuildSyncSummary) => void;
  handleImportPostSuccess: (postId: string, buildSync?: BuildSyncSummary) => void;
  handleEditPost: (postId: string) => void;
  handleEditorClose: () => void;
  handleEditorSaved: () => void;
}

export function useDashboardState(): UseDashboardStateResult {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [data, setData] = useState<ListPostsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [pendingPostDeletion, setPendingPostDeletion] = useState<PendingPostDeletion>(null);

  const params = useMemo(
    () => ({
      search: search || undefined,
      category: category || undefined,
      status: status === 'all' ? undefined : status,
      sort: sortField,
      order: sortOrder,
    }),
    [search, category, status, sortField, sortOrder],
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listPosts(params);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载文章失败');
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder('desc');
      }
    },
    [sortField],
  );

  const handleToggleDraft = useCallback(
    async (postId: string) => {
      try {
        const result = await toggleDraft(postId);
        toast.success(`${result.draft ? '文章已设为草稿' : '文章已提交发布'}；${result.buildSync?.message || '发布同步已请求'}`);
        if (result.buildSync) window.dispatchEvent(new CustomEvent('cms:build-sync-requested', { detail: result.buildSync }));
        fetchData();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '切换草稿状态失败');
      }
    },
    [fetchData],
  );

  const handleToggleSticky = useCallback(
    async (postId: string) => {
      try {
        const result = await toggleSticky(postId);
        toast.success(`${result.sticky ? '文章已置顶' : '已取消置顶'}；${result.buildSync?.message || '发布同步已请求'}`);
        if (result.buildSync) window.dispatchEvent(new CustomEvent('cms:build-sync-requested', { detail: result.buildSync }));
        fetchData();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '切换置顶状态失败');
      }
    },
    [fetchData],
  );

  const handleDeletePost = useCallback(
    async (postId: string, title: string) => {
      setPendingPostDeletion({ postId, title });
    },
    [],
  );

  const confirmDeletePost = useCallback(
    async () => {
      if (!pendingPostDeletion) return;
      try {
        const result = await deletePost(pendingPostDeletion.postId);
        setPendingPostDeletion(null);
        toast.success(`文章已删除；${result.buildSync?.message || 'Cloudflare Pages 正在自动部署。'}`);
        if (result.buildSync) window.dispatchEvent(new CustomEvent('cms:build-sync-requested', { detail: result.buildSync }));
        fetchData();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '删除文章失败');
      }
    },
    [fetchData, pendingPostDeletion],
  );

  const cancelDeletePost = useCallback(() => setPendingPostDeletion(null), []);

  const handleCreatePostSuccess = useCallback(
    (postId: string, buildSync?: BuildSyncSummary) => {
      toast.success(`文章创建成功；${buildSync?.message || '发布同步已请求'}`);
      if (buildSync) window.dispatchEvent(new CustomEvent('cms:build-sync-requested', { detail: buildSync }));
      setIsCreateDialogOpen(false);
      setEditingPostId(postId);
      fetchData();
    },
    [fetchData],
  );

  const handleImportPostSuccess = useCallback(
    (postId: string, buildSync?: BuildSyncSummary) => {
      toast.success(`Markdown 已导入；${buildSync?.message || '发布同步已请求'}`);
      if (buildSync) window.dispatchEvent(new CustomEvent('cms:build-sync-requested', { detail: buildSync }));
      setEditingPostId(postId);
      fetchData();
    },
    [fetchData],
  );

  const handleEditPost = useCallback((postId: string) => {
    setEditingPostId(postId);
  }, []);

  const handleEditorClose = useCallback(() => {
    setEditingPostId(null);
  }, []);

  const handleEditorSaved = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    activeTab,
    setActiveTab,
    data,
    isLoading,
    error,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    editingPostId,
    search,
    setSearch,
    category,
    setCategory,
    status,
    setStatus,
    sortField,
    sortOrder,
    fetchData,
    handleSort,
    handleToggleDraft,
    handleToggleSticky,
    handleDeletePost,
    pendingPostDeletion,
    confirmDeletePost,
    cancelDeletePost,
    handleCreatePostSuccess,
    handleImportPostSuccess,
    handleEditPost,
    handleEditorClose,
    handleEditorSaved,
  };
}
