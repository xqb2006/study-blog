/**
 * Link Preview Component for CMS Preview
 *
 * Renders Open Graph preview cards for general links.
 */

import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { getDomain } from '@/lib/link-utils';
import { getOGData, type OGData } from '@/lib/og-service';

interface LinkPreviewProps {
  url: string;
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const [ogData, setOgData] = useState<OGData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadOGData() {
      try {
        const data = await getOGData(url);
        if (!cancelled) {
          setOgData(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setOgData({
            originUrl: url,
            url,
            error: 'Failed to load',
          });
          setLoading(false);
        }
      }
    }

    loadOGData();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <output className="my-4 block" aria-busy="true" aria-label="Loading link preview">
        <div className="animate-pulse rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
        </div>
      </output>
    );
  }

  if (!ogData) {
    return null;
  }

  const domain = getDomain(ogData.url);
  const hasError = ogData.error || !ogData.title;

  // Error or fallback state
  if (hasError) {
    return (
      <div className="link-preview-block my-4" data-state="error">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="group block rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
          aria-label={domain}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <AppIcon name="link" className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">{url}</div>
                <div className="mt-0.5 truncate text-muted-foreground text-xs">{domain}</div>
              </div>
            </div>
            <AppIcon name="arrow-right" className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
          </div>
        </a>
      </div>
    );
  }

  // Success state with full OG data
  return (
    <div className="link-preview-block my-4" data-state="success">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block overflow-hidden rounded-lg border border-border transition-all hover:border-primary/50 hover:shadow-md"
        aria-label={`${ogData.title} - ${domain}`}
      >
        <div className="flex flex-row bg-card md:flex-col">
          <div className="flex-1 p-4">
            <div className="mb-2 flex items-center gap-2">
              {ogData.logo && (
                <img
                  src={ogData.logo}
                  alt=""
                  className="h-4 w-4 shrink-0"
                  loading="lazy"
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="truncate font-medium text-muted-foreground text-xs">{domain}</span>
            </div>
            <h3 className="mb-2 line-clamp-2 font-semibold text-foreground leading-tight">{ogData.title}</h3>
            {ogData.description && <p className="mb-3 line-clamp-2 text-muted-foreground text-sm">{ogData.description}</p>}
            <div className="flex items-center gap-1 text-primary text-xs">
              <span className="truncate">{url}</span>
              <AppIcon name="external-link" className="size-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
          {ogData.image && (
            <div className="relative aspect-[1200/630] h-38 shrink-0 bg-muted md:w-full">
              <img src={ogData.image} alt={ogData.title || ''} className="h-full w-full object-cover" loading="lazy" />
            </div>
          )}
        </div>
      </a>
    </div>
  );
}
