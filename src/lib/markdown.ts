import { isExternal } from './links';

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => entities[c]);

const isSafeHref = (href: string) => /^(https?:|mailto:|tel:|#|\/)/i.test(href);

/**
 * Renders the small markdown subset the admin supports: paragraphs, **bold**,
 * *italic* and [links](url). Input is escaped first, so raw HTML never gets through.
 */
export function renderMarkdown(source: string) {
  return source
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((paragraph) => `<p>${renderInline(paragraph)}</p>`)
    .join('');
}

function renderInline(text: string) {
  return escapeHtml(text.trim())
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) =>
      isSafeHref(href)
        ? `<a href="${href}"${isExternal(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`
        : label,
    )
    .replace(/\n/g, '<br>');
}

