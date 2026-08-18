const IMAGE_EXTENSION_RE = /\.(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
const IMAGE_ROUTE_RE = /\/(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

export function isPreviewableImagePath(value: string): boolean {
  const path = value.trim();
  if (!path) return false;
  if (/^data:image\//i.test(path)) return true;
  return IMAGE_EXTENSION_RE.test(path) || IMAGE_ROUTE_RE.test(path);
}

export function getImagePreviewSrc(value: string): string | undefined {
  const path = value.trim();
  return isPreviewableImagePath(path) ? path : undefined;
}

export function isPublicImageReference(value: string): boolean {
  const path = value.trim();
  if (!path) return true;
  return path.startsWith('/img/') || /^https?:\/\//i.test(path);
}

export function getPublicImageReferenceError(value: string): string | undefined {
  if (isPublicImageReference(value)) return undefined;
  return '只能保存 /img/... 或公开 http(s) 图片地址';
}
