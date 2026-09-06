/**
 * Normalizes common LaTeX delimiters into the syntax understood by remark-math.
 *
 * KaTeX's browser auto-render supports `\(...\)` and `\[...\]`, but remark-math
 * only parses `$...$` and `$$...$$`. Without this normalization, Markdown treats
 * the backslashes as escapes and shows the formula source as plain text.
 */

const protectedRegionPattern =
  /(^`{3,}.*\n[\s\S]*?^`{3,}\s*$|^~{3,}.*\n[\s\S]*?^~{3,}\s*$|^(?:(?: {4}|\t).*(?:\n|$))+|`[^`\n]+`|\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/gm;

function transformOutsideProtectedRegions(source: string, transform: (segment: string) => string): string {
  let lastIndex = 0;
  const parts: string[] = [];

  for (let match = protectedRegionPattern.exec(source); match !== null; match = protectedRegionPattern.exec(source)) {
    if (match.index > lastIndex) {
      parts.push(transform(source.slice(lastIndex, match.index)));
    }

    parts.push(match[0]);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < source.length) {
    parts.push(transform(source.slice(lastIndex)));
  }

  return parts.length > 0 ? parts.join('') : transform(source);
}

function normalizeDisplayMath(segment: string): string {
  return segment
    .replace(
      /(^|\r?\n)([\t ]*)\\\[[\t ]*\r?\n([\s\S]*?)\r?\n[\t ]*\\\][\t ]*(?=\r?\n|$)/g,
      (_match, lineStart: string, indentation: string, expression: string) =>
        `${lineStart}${indentation}$$\n${expression}\n${indentation}$$`,
    )
    .replace(
      /(^|\r?\n)([\t ]*)\\\[[\t ]*([^\r\n]+?)[\t ]*\\\][\t ]*(?=\r?\n|$)/g,
      (_match, lineStart: string, indentation: string, expression: string) =>
        `${lineStart}${indentation}$$\n${expression}\n${indentation}$$`,
    );
}

function normalizeInlineMath(segment: string): string {
  return segment.replace(/(^|[^\\])\\\(([^\r\n]+?)\\\)/g, (_match, prefix: string, expression: string) => {
    return `${prefix}$${expression}$`;
  });
}

/**
 * Converts `\(...\)` to `$...$` and `\[...\]` to `$$...$$`.
 * Code fences, inline code, and formulas already using dollar delimiters are
 * deliberately left untouched.
 */
export function normalizeLatexMathDelimiters(source: string): string {
  return transformOutsideProtectedRegions(source, (segment) => normalizeInlineMath(normalizeDisplayMath(segment)));
}
