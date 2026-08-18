export interface MediaPathLike {
  name?: string;
  publicPath: string;
}

function stripExtension(value: string): string {
  return value.replace(/\.[a-zA-Z0-9]+$/, '');
}

function normalizeAltText(value: string): string {
  return stripExtension(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeMarkdownAltText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
}

export function getMediaAltText(file: MediaPathLike): string {
  const nameAlt = file.name ? normalizeAltText(file.name) : '';
  if (nameAlt) return nameAlt;

  const pathName = file.publicPath.split('/').pop() || 'image';
  return normalizeAltText(pathName) || 'image';
}

export function createMarkdownImageSnippet(file: MediaPathLike): string {
  return `![${escapeMarkdownAltText(getMediaAltText(file))}](${file.publicPath})`;
}
