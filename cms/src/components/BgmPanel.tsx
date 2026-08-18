import { AppIcon } from '@/components/ui/app-icon';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getSiteSettings, saveSiteSettings } from '@/lib/api';
import type { BgmPlaylist, BgmSettings } from '@/types';
import { Field, inputClassName, Panel } from './dashboard/Panel';

const EMPTY_PLAYLIST: BgmPlaylist = {
  title: '',
  list: [''],
};

const DEFAULT_BGM: BgmSettings = {
  enabled: false,
  metingApi: '',
  audio: [],
};

function cloneBgm(value?: BgmSettings): BgmSettings {
  return JSON.parse(JSON.stringify(value || DEFAULT_BGM)) as BgmSettings;
}

function normalizeBgm(value: BgmSettings): BgmSettings {
  return {
    enabled: value.enabled === true,
    ...(value.metingApi?.trim() ? { metingApi: value.metingApi.trim() } : {}),
    audio: value.audio
      .map((playlist) => ({
        title: playlist.title.trim(),
        list: playlist.list.map((item) => item.trim()).filter(Boolean),
      }))
      .filter((playlist) => playlist.title && playlist.list.length),
  };
}

export function BgmPanel() {
  const [bgm, setBgm] = useState<BgmSettings>(DEFAULT_BGM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadBgm = async () => {
    setIsLoading(true);
    try {
      const response = await getSiteSettings();
      setBgm(cloneBgm(response.settings.bgm));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取 BGM 配置失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBgm();
  }, []);

  const updatePlaylist = (index: number, patch: Partial<BgmPlaylist>) => {
    setBgm((current) => ({
      ...current,
      audio: current.audio.map((playlist, itemIndex) => (itemIndex === index ? { ...playlist, ...patch } : playlist)),
    }));
  };

  const updatePlaylistUrl = (playlistIndex: number, urlIndex: number, value: string) => {
    setBgm((current) => ({
      ...current,
      audio: current.audio.map((playlist, itemIndex) =>
        itemIndex === playlistIndex
          ? {
              ...playlist,
              list: playlist.list.map((url, currentUrlIndex) => (currentUrlIndex === urlIndex ? value : url)),
            }
          : playlist,
      ),
    }));
  };

  const handleSave = async () => {
    const normalized = normalizeBgm(bgm);

    if (normalized.enabled && normalized.audio.length === 0) {
      toast.error('启用 BGM 前至少添加一个歌单链接');
      return;
    }

    setIsSaving(true);
    try {
      const response = await saveSiteSettings({ bgm: normalized });
      setBgm(cloneBgm(response.settings.bgm));
      toast.success('BGM 配置已保存');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存 BGM 配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <AppIcon name="ri:loader-4-line" className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const playlistCount = bgm.audio.length;
  const urlCount = bgm.audio.reduce((sum, playlist) => sum + playlist.list.filter((item) => item.trim()).length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">BGM 管理</h1>
          <p className="mt-1 text-muted-foreground text-sm">管理博客全局音乐播放器、Meting API 和歌单链接。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadBgm} disabled={isSaving}>
            <AppIcon name="ri:refresh-line" className="mr-1.5 size-4" />
            重新读取
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <AppIcon name={isSaving ? 'ri:loader-4-line' : 'ri:save-line'} className={isSaving ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
            保存 BGM
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <AppIcon name={bgm.enabled ? 'ri:music-2-line' : 'ri:volume-mute-line'} className="size-6" />
            </span>
            <div>
              <p className="font-semibold text-xl">{bgm.enabled ? '已启用' : '已关闭'}</p>
              <p className="text-muted-foreground text-sm">播放器状态</p>
            </div>
          </div>
        </Panel>
        <Panel>
          <div>
            <p className="font-semibold text-xl">{playlistCount}</p>
            <p className="text-muted-foreground text-sm">歌单分组</p>
          </div>
        </Panel>
        <Panel>
          <div>
            <p className="font-semibold text-xl">{urlCount}</p>
            <p className="text-muted-foreground text-sm">音乐链接</p>
          </div>
        </Panel>
      </div>

      <Panel title="播放器设置" description="保存后会进入发布同步，可在发布同步查看播放器更新状态。">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
            <input
              type="checkbox"
              checked={bgm.enabled === true}
              onChange={(event) => setBgm((current) => ({ ...current, enabled: event.target.checked }))}
              className="size-4"
            />
            <span className="text-sm">启用全局 BGM</span>
          </label>
          <Field label="Meting API 地址" description="留空时使用博客默认配置；自建服务可填完整 URL。">
            <input
              value={bgm.metingApi || ''}
              onChange={(event) => setBgm((current) => ({ ...current, metingApi: event.target.value }))}
              placeholder="https://163.hyc.moe/"
              className={inputClassName}
            />
          </Field>
        </div>
      </Panel>

      <Panel
        title={`歌单列表（${playlistCount} 组）`}
        description="每组可以填多个网易云歌单或单曲链接，播放器会按配置读取。"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBgm((current) => ({ ...current, audio: [...current.audio, { ...EMPTY_PLAYLIST, list: [...EMPTY_PLAYLIST.list] }] }))}
          >
            <AppIcon name="ri:add-line" className="mr-1.5 size-4" />
            添加歌单
          </Button>
        }
      >
        <div className="space-y-4">
          {bgm.audio.map((playlist, playlistIndex) => (
            <article key={`${playlist.title}-${playlistIndex}`} className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="line-clamp-1 font-medium">{playlist.title || `歌单 ${playlistIndex + 1}`}</h2>
                  <p className="text-muted-foreground text-xs">{playlist.list.filter((item) => item.trim()).length} 个链接</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setBgm((current) => ({ ...current, audio: current.audio.filter((_, itemIndex) => itemIndex !== playlistIndex) }))}
                  title="删除歌单"
                >
                  <AppIcon name="ri:delete-bin-line" className="size-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <Field label="分组标题">
                  <input value={playlist.title} onChange={(event) => updatePlaylist(playlistIndex, { title: event.target.value })} className={inputClassName} />
                </Field>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">链接</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePlaylist(playlistIndex, { list: [...playlist.list, ''] })}
                    >
                      <AppIcon name="ri:add-line" className="mr-1.5 size-4" />
                      添加链接
                    </Button>
                  </div>
                  {playlist.list.map((url, urlIndex) => (
                    <div key={`${playlistIndex}-${urlIndex}`} className="grid gap-2 md:grid-cols-[1fr_auto]">
                      <input
                        value={url}
                        onChange={(event) => updatePlaylistUrl(playlistIndex, urlIndex, event.target.value)}
                        placeholder="https://music.163.com/playlist?id=..."
                        className={inputClassName}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updatePlaylist(playlistIndex, { list: playlist.list.filter((_, itemIndex) => itemIndex !== urlIndex) })}
                        title="删除链接"
                      >
                        <AppIcon name="ri:close-line" className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
          {bgm.audio.length === 0 && <p className="text-muted-foreground text-sm">暂无歌单。启用 BGM 前请先添加一个链接。</p>}
        </div>
      </Panel>
    </div>
  );
}
