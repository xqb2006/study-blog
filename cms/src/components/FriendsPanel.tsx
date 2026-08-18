import { AppIcon } from '@/components/ui/app-icon';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getSiteSettings, saveSiteSettings } from '@/lib/api';
import type { FriendLinkItem, FriendsSettings } from '@/types';
import { Field, inputClassName, Panel, textareaClassName } from './dashboard/Panel';
import { MediaPathField } from './MediaPathField';

const EMPTY_FRIEND: FriendLinkItem = {
  site: '',
  url: '',
  owner: '',
  desc: '',
  image: '',
  color: '',
};

const DEFAULT_FRIENDS: FriendsSettings = {
  intro: {
    title: '友情链接',
    subtitle: '欢迎交换友链！',
    applyTitle: '申请友链',
    applyDesc: '请在本页留言，格式如下',
    exampleYaml: '- site: 你的博客名称\n  url: https://your-blog.com/\n  owner: 你的昵称\n  desc: 站点简介\n  image: https://your-blog.com/avatar.jpg',
  },
  data: [],
};

function cloneFriends(value: FriendsSettings): FriendsSettings {
  return JSON.parse(JSON.stringify(value || DEFAULT_FRIENDS)) as FriendsSettings;
}

export function FriendsPanel() {
  const [friends, setFriends] = useState<FriendsSettings>(DEFAULT_FRIENDS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadFriends = async () => {
    setIsLoading(true);
    try {
      const response = await getSiteSettings();
      setFriends(cloneFriends(response.settings.friends || DEFAULT_FRIENDS));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取友链配置失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFriends();
  }, []);

  const updateIntro = (key: keyof FriendsSettings['intro'], value: string) => {
    setFriends((current) => ({
      ...current,
      intro: {
        ...current.intro,
        [key]: value,
      },
    }));
  };

  const updateFriend = (index: number, key: keyof FriendLinkItem, value: string) => {
    setFriends((current) => ({
      ...current,
      data: current.data.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    }));
  };

  const handleSave = async () => {
    const invalidIndex = friends.data.findIndex((item) => !item.site.trim() || !item.url.trim() || !item.owner.trim() || !item.desc.trim() || !item.image.trim());
    if (invalidIndex >= 0) {
      toast.error(`第 ${invalidIndex + 1} 个友链缺少必填字段`);
      return;
    }

    setIsSaving(true);
    try {
      const payload: FriendsSettings = {
        intro: {
          title: friends.intro.title?.trim(),
          subtitle: friends.intro.subtitle?.trim(),
          applyTitle: friends.intro.applyTitle?.trim(),
          applyDesc: friends.intro.applyDesc?.trim(),
          exampleYaml: friends.intro.exampleYaml || '',
        },
        data: friends.data.map((item) => ({
          site: item.site.trim(),
          url: item.url.trim(),
          owner: item.owner.trim(),
          desc: item.desc.trim(),
          image: item.image.trim(),
          ...(item.color?.trim() ? { color: item.color.trim() } : {}),
        })),
      };

      const response = await saveSiteSettings({ friends: payload });
      setFriends(cloneFriends(response.settings.friends));
      toast.success('友链已保存');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存友链失败');
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">友链管理</h1>
          <p className="mt-1 text-muted-foreground text-sm">维护朋友链接页面的介绍文案、申请说明和站点列表。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadFriends} disabled={isSaving}>
            <AppIcon name="ri:refresh-line" className="mr-1.5 size-4" />
            重新读取
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <AppIcon name={isSaving ? 'ri:loader-4-line' : 'ri:save-line'} className={isSaving ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
            保存友链
          </Button>
        </div>
      </div>

      <Panel title="页面文案" description="这些内容显示在 friends 页面顶部和申请说明区域。">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="页面标题">
            <input value={friends.intro.title || ''} onChange={(event) => updateIntro('title', event.target.value)} className={inputClassName} />
          </Field>
          <Field label="副标题">
            <input value={friends.intro.subtitle || ''} onChange={(event) => updateIntro('subtitle', event.target.value)} className={inputClassName} />
          </Field>
          <Field label="申请标题">
            <input value={friends.intro.applyTitle || ''} onChange={(event) => updateIntro('applyTitle', event.target.value)} className={inputClassName} />
          </Field>
          <Field label="申请说明">
            <input value={friends.intro.applyDesc || ''} onChange={(event) => updateIntro('applyDesc', event.target.value)} className={inputClassName} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="申请格式示例">
            <textarea value={friends.intro.exampleYaml || ''} onChange={(event) => updateIntro('exampleYaml', event.target.value)} rows={6} className={textareaClassName} />
          </Field>
        </div>
      </Panel>

      <Panel
        title={`友链列表（${friends.data.length} 个）`}
        description="保存后会进入发布同步，可在发布同步查看 friends 页面更新状态。"
        actions={
          <Button variant="outline" size="sm" onClick={() => setFriends((current) => ({ ...current, data: [...current.data, { ...EMPTY_FRIEND }] }))}>
            <AppIcon name="ri:add-line" className="mr-1.5 size-4" />
            添加友链
          </Button>
        }
      >
        <div className="space-y-4">
          {friends.data.map((friend, index) => (
            <article key={`${friend.site}-${index}`} className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {friend.image ? (
                    <img src={friend.image} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                      <AppIcon name="ri:links-line" className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="line-clamp-1 font-medium">{friend.site || `友链 ${index + 1}`}</h2>
                    <p className="line-clamp-1 text-muted-foreground text-xs">{friend.url || '未填写链接'}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFriends((current) => ({ ...current, data: current.data.filter((_, itemIndex) => itemIndex !== index) }))}
                  title="删除友链"
                >
                  <AppIcon name="ri:delete-bin-line" className="size-4" />
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Field label="站点名称">
                  <input value={friend.site} onChange={(event) => updateFriend(index, 'site', event.target.value)} className={inputClassName} />
                </Field>
                <Field label="站点地址">
                  <input value={friend.url} onChange={(event) => updateFriend(index, 'url', event.target.value)} className={inputClassName} />
                </Field>
                <Field label="站长">
                  <input value={friend.owner} onChange={(event) => updateFriend(index, 'owner', event.target.value)} className={inputClassName} />
                </Field>
                <Field label="头像">
                  <MediaPathField
                    value={friend.image}
                    onChange={(value) => updateFriend(index, 'image', value)}
                    placeholder="https://your-blog.com/avatar.jpg"
                    previewShape="avatar"
                    dialogTitle="选择友链头像"
                  />
                </Field>
                <Field label="主题色">
                  <input value={friend.color || ''} onChange={(event) => updateFriend(index, 'color', event.target.value)} placeholder="#BEDCFF" className={inputClassName} />
                </Field>
                <Field label="描述">
                  <input value={friend.desc} onChange={(event) => updateFriend(index, 'desc', event.target.value)} className={inputClassName} />
                </Field>
              </div>
            </article>
          ))}
          {friends.data.length === 0 && <p className="text-muted-foreground text-sm">暂无友链。</p>}
        </div>
      </Panel>
    </div>
  );
}
