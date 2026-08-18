import { AppIcon } from '@/components/ui/app-icon';
import { getContentSummary, normalizeContentSettings, type BooleanContentKey } from '@/lib/content-settings';
import type { SiteContentSettings } from '@/types';
import { Field, inputClassName } from './dashboard/Panel';

interface ContentSettingsEditorProps {
  value: SiteContentSettings;
  onChange: (value: SiteContentSettings) => void;
}

type SwitchGroup = {
  title: string;
  icon: string;
  description: string;
  items: { key: BooleanContentKey; label: string; description?: string }[];
};

const SWITCH_GROUPS: SwitchGroup[] = [
  {
    title: '基础阅读体验',
    icon: 'ri:article-line',
    description: '控制页面滚动、标题锚点和外部链接行为。',
    items: [
      { key: 'addBlankTarget', label: '外部链接新窗口打开' },
      { key: 'smoothScroll', label: '平滑滚动' },
      { key: 'addHeadingLevel', label: '标题层级锚点' },
    ],
  },
  {
    title: '代码与数学',
    icon: 'ri:code-box-line',
    description: '控制代码块工具、代码元信息和数学公式。',
    items: [
      { key: 'enhanceCodeBlock', label: '增强代码块样式' },
      { key: 'enableCodeCopy', label: '代码复制按钮' },
      { key: 'enableCodeFullscreen', label: '代码全屏按钮' },
      { key: 'enableCodeMeta', label: '代码块元信息', description: 'title、mark、command 等增强语法。' },
      { key: 'enableMath', label: '数学公式渲染' },
    ],
  },
  {
    title: '链接与嵌入',
    icon: 'ri:links-line',
    description: '控制链接卡片、OG 预览、推文和 CodePen 嵌入。',
    items: [
      { key: 'enableLinkEmbed', label: '链接卡片预览' },
      { key: 'enableOGPreview', label: 'OG 预览卡片' },
      { key: 'enableTweetEmbed', label: '推文嵌入' },
      { key: 'enableCodePenEmbed', label: 'CodePen 嵌入' },
      { key: 'lazyLoadEmbeds', label: '嵌入内容延迟加载' },
    ],
  },
  {
    title: 'Shoka 兼容语法',
    icon: 'ri:magic-line',
    description: '兼容提醒块、标签卡、折叠块、隐藏文字、注音和 Hexo 标签。',
    items: [
      { key: 'enableShokaContainers', label: '提醒/折叠/标签卡' },
      { key: 'enableShokaAttrs', label: '属性语法' },
      { key: 'enableShokaEffects', label: '文字特效' },
      { key: 'enableShokaSpoiler', label: '隐藏文字' },
      { key: 'enableShokaRuby', label: '注音标注' },
      { key: 'enableShokaHexoTags', label: 'Hexo 媒体标签' },
    ],
  },
  {
    title: '交互块',
    icon: 'ri:shield-keyhole-line',
    description: '控制练习题和加密内容块。',
    items: [
      { key: 'enableQuiz', label: '练习题交互' },
      { key: 'enableEncryptedBlock', label: '加密内容块' },
    ],
  },
];

const POSITION_OPTIONS: { value: NonNullable<SiteContentSettings['postCardImagePosition']>; label: string }[] = [
  { value: 'alternating', label: '交替显示' },
  { value: 'left', label: '封面在左' },
  { value: 'right', label: '封面在右' },
];

export function ContentSettingsEditor({ value, onChange }: ContentSettingsEditorProps) {
  const summary = getContentSummary(value || {});

  const updateSwitch = (key: BooleanContentKey, checked: boolean) => {
    onChange(normalizeContentSettings({ ...value, [key]: checked }));
  };

  const updateContent = (patch: SiteContentSettings) => {
    onChange(normalizeContentSettings({ ...value, ...patch }));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="font-semibold text-xl">{summary.enabledCount}</p>
          <p className="text-muted-foreground text-sm">已开启功能</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="font-semibold text-xl">{summary.cacheDays} 天</p>
          <p className="text-muted-foreground text-sm">预览缓存</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="font-semibold text-xl">{summary.imagePositionLabel}</p>
          <p className="text-muted-foreground text-sm">首页封面位置</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="链接预览缓存时间" description="单位是天，范围 0-365；数值越大，请求外部链接信息越少。">
          <input
            type="number"
            min={0}
            max={365}
            value={value.previewCacheTime ?? 30}
            onChange={(event) => updateContent({ previewCacheTime: event.target.value ? Number(event.target.value) : 0 })}
            className={inputClassName}
          />
        </Field>
        <Field label="首页文章卡片封面位置">
          <select
            value={value.postCardImagePosition || 'alternating'}
            onChange={(event) => updateContent({ postCardImagePosition: event.target.value as SiteContentSettings['postCardImagePosition'] })}
            className={inputClassName}
          >
            {POSITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {SWITCH_GROUPS.map((group) => (
          <section key={group.title} className="rounded-xl border border-border/80 bg-white/52 p-4 shadow-sm">
            <div className="mb-3 flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <AppIcon name={group.icon} className="size-5" />
              </span>
              <div>
                <h3 className="font-medium">{group.title}</h3>
                <p className="mt-0.5 text-muted-foreground text-xs">{group.description}</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.items.map((item) => (
                <label key={item.key} className="flex min-h-12 items-start gap-2 rounded-lg border border-border/70 bg-white/48 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={value[item.key] === true}
                    onChange={(event) => updateSwitch(item.key, event.target.checked)}
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm">{item.label}</span>
                    {item.description && <span className="mt-0.5 block text-muted-foreground text-xs">{item.description}</span>}
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
