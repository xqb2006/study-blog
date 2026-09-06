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

function normalizeLegacyDisplayMath(segment: string): string {
  return segment.replace(
    /(^|\r?\n)([\t ]*)\[[\t ]*\\[\t ]*\r?\n([\s\S]*?)\r?\n[\t ]*\][\t ]*(?=\r?\n|$)/g,
    (_match, lineStart: string, indentation: string, expression: string) => {
      const normalizedExpression = expression.replace(/\\[\t ]*(?=\r?\n|$)/g, '');
      return `${lineStart}${indentation}$$\n${normalizedExpression}\n${indentation}$$`;
    },
  );
}

function normalizeInlineMath(segment: string): string {
  return segment.replace(/(^|[^\\])\\\(([^\r\n]+?)\\\)/g, (_match, prefix: string, expression: string) => {
    return `${prefix}$${expression}$`;
  });
}

function normalizeLegacyInlineMath(segment: string): string {
  return segment.replace(/\(([^()\r\n]*\\[A-Za-z]+[^()\r\n]*)\)/g, (_match, expression: string) => {
    return `$${expression}$`;
  });
}

/**
 * Converts common and legacy LaTeX delimiters to remark-math syntax.
 *
 * In addition to `\(...\)` and `\[...\]`, older CMS content may contain
 * display formulas written as `[\` / `]`, with a trailing slash on each line.
 * Code fences, inline code, and formulas already using dollar delimiters are
 * deliberately left untouched.
 */
export function normalizeLatexMathDelimiters(source: string): string {
  return transformOutsideProtectedRegions(source, (segment) =>
    normalizeLegacyInlineMath(normalizeInlineMath(normalizeLegacyDisplayMath(normalizeDisplayMath(segment)))),
  );
}
