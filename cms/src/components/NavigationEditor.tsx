import { AppIcon } from '@/components/ui/app-icon';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  addNavigationChild,
  addNavigationItem,
  createEmptyNavigationItem,
  moveNavigationItem,
  normalizeNavigation,
  parseNavigationJson,
  removeNavigationItem,
  updateNavigationItem,
} from '@/lib/navigation-editor';
import type { SiteNavigationItem } from '@/types';
import { Field, inputClassName, textareaClassName } from './dashboard/Panel';

interface NavigationEditorProps {
  value: SiteNavigationItem[];
  rawText: string;
  onChange: (navigation: SiteNavigationItem[]) => void;
  onRawTextChange: (text: string) => void;
}

type NavigationPath = [number] | [number, number];

const EMPTY_CHILD: SiteNavigationItem = {
  name: '子菜单',
  path: '/',
  icon: 'ri:arrow-right-s-line',
};

function formatNavigation(navigation: SiteNavigationItem[]): string {
  return JSON.stringify(navigation || [], null, 2);
}

function NavIcon({ icon }: { icon?: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <AppIcon name={icon?.trim() || 'ri:links-line'} className="size-5" />
    </span>
  );
}

export function NavigationEditor({ value, rawText, onChange, onRawTextChange }: NavigationEditorProps) {
  const [showJson, setShowJson] = useState(false);
  const navigationItems = useMemo(() => value || [], [value]);

  const commit = (nextNavigation: SiteNavigationItem[]) => {
    onChange(nextNavigation);
    onRawTextChange(formatNavigation(nextNavigation));
  };

  const updateItem = (path: NavigationPath, patch: Partial<SiteNavigationItem>) => {
    commit(updateNavigationItem(navigationItems, path, patch));
  };

  const handleApplyJson = () => {
    const result = parseNavigationJson(rawText);
    if (result.error || !result.navigation) {
      toast.error(result.error || '导航 JSON 格式不正确');
      return;
    }
    commit(result.navigation);
    toast.success('导航 JSON 已同步到可视化编辑器');
  };

  const renderFields = (item: SiteNavigationItem, path: NavigationPath) => (
    <div className="grid gap-2 md:grid-cols-[1.1fr_1.1fr_1fr_1fr]">
      <Field label="显示名称">
        <input value={item.name || ''} onChange={(event) => updateItem(path, { name: event.target.value })} placeholder="首页" className={inputClassName} />
      </Field>
      <Field label="路径">
        <input value={item.path || ''} onChange={(event) => updateItem(path, { path: event.target.value })} placeholder="/" className={inputClassName} />
      </Field>
      <Field label="图标">
        <input value={item.icon || ''} onChange={(event) => updateItem(path, { icon: event.target.value })} placeholder="ri:home-heart-fill" className={inputClassName} />
      </Field>
      <Field label="翻译 Key">
        <input value={item.nameKey || ''} onChange={(event) => updateItem(path, { nameKey: event.target.value })} placeholder="nav.home" className={inputClassName} />
      </Field>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
        <div>
          <p className="font-medium text-sm">当前 {navigationItems.length} 个一级菜单</p>
          <p className="text-muted-foreground text-xs">保存后会进入发布同步，可在“发布同步”查看博客前台的更新状态。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => commit(addNavigationItem(navigationItems, createEmptyNavigationItem()))}>
            <AppIcon name="ri:add-line" className="mr-1.5 size-4" />
            添加一级菜单
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowJson((current) => !current)}>
            <AppIcon name={showJson ? 'ri:code-s-slash-line' : 'ri:code-line'} className="mr-1.5 size-4" />
            {showJson ? '收起 JSON' : '高级 JSON'}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {navigationItems.map((item, index) => (
          <article key={`${item.name}-${index}`} className="rounded-xl border border-border/80 bg-white/52 p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <NavIcon icon={item.icon} />
                <div className="min-w-0">
                  <h3 className="line-clamp-1 font-medium">{item.name || `菜单 ${index + 1}`}</h3>
                  <p className="line-clamp-1 text-muted-foreground text-xs">{item.path || `${item.children?.length || 0} 个子菜单`}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <Button variant="ghost" size="icon" title="上移" onClick={() => commit(moveNavigationItem(navigationItems, [index], -1))} disabled={index === 0}>
                  <AppIcon name="ri:arrow-up-s-line" className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" title="下移" onClick={() => commit(moveNavigationItem(navigationItems, [index], 1))} disabled={index === navigationItems.length - 1}>
                  <AppIcon name="ri:arrow-down-s-line" className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" title="添加子菜单" onClick={() => commit(addNavigationChild(navigationItems, index, EMPTY_CHILD))}>
                  <AppIcon name="ri:node-tree" className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" title="删除菜单" onClick={() => commit(removeNavigationItem(navigationItems, [index]))}>
                  <AppIcon name="ri:delete-bin-line" className="size-4" />
                </Button>
              </div>
            </div>

            {renderFields(item, [index])}

            {item.children?.length ? (
              <div className="mt-4 space-y-3 border-border/70 border-l-2 pl-3">
                {item.children.map((child, childIndex) => (
                  <article key={`${child.name}-${childIndex}`} className="rounded-lg border border-border/70 bg-white/55 p-3">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <NavIcon icon={child.icon} />
                        <div className="min-w-0">
                          <h4 className="line-clamp-1 font-medium text-sm">{child.name || `子菜单 ${childIndex + 1}`}</h4>
                          <p className="line-clamp-1 text-muted-foreground text-xs">{child.path || '未填写路径'}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <Button variant="ghost" size="icon" title="上移子菜单" onClick={() => commit(moveNavigationItem(navigationItems, [index, childIndex], -1))} disabled={childIndex === 0}>
                          <AppIcon name="ri:arrow-up-s-line" className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="下移子菜单" onClick={() => commit(moveNavigationItem(navigationItems, [index, childIndex], 1))} disabled={childIndex === (item.children?.length || 0) - 1}>
                          <AppIcon name="ri:arrow-down-s-line" className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="删除子菜单" onClick={() => commit(removeNavigationItem(navigationItems, [index, childIndex]))}>
                          <AppIcon name="ri:delete-bin-line" className="size-4" />
                        </Button>
                      </div>
                    </div>
                    {renderFields(child, [index, childIndex])}
                  </article>
                ))}
              </div>
            ) : null}
          </article>
        ))}
        {navigationItems.length === 0 && <p className="text-muted-foreground text-sm">暂无导航菜单。</p>}
      </div>

      {showJson && (
        <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm">高级 JSON 编辑</p>
              <p className="text-muted-foreground text-xs">适合批量粘贴；应用后会同步回上面的可视化菜单。</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleApplyJson}>
              <AppIcon name="ri:check-line" className="mr-1.5 size-4" />
              应用 JSON
            </Button>
          </div>
          <textarea value={rawText} onChange={(event) => onRawTextChange(event.target.value)} rows={12} spellCheck={false} className={`${textareaClassName} font-mono`} />
        </div>
      )}
    </div>
  );
}
