export const isExternal = (href: string) => /^https?:\/\//i.test(href);

/** Extra attributes so external links and PDFs open in a new tab. */
export const linkAttrs = (href: string) =>
  isExternal(href) || /\.pdf$/i.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
