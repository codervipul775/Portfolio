import type { Content, Link, Section } from '../data/schema';

export const replaceAt = <T,>(list: T[], index: number, item: T) => list.map((x, i) => (i === index ? item : x));

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/** Readable, practically unique id, e.g. "my-project-k3f9". */
export const newId = (base = 'item') => `${slugify(base) || 'item'}-${Math.random().toString(36).slice(2, 6)}`;

export const TYPE_INFO: Record<Section['type'], { label: string; icon: string; description: string }> = {
  hero: { label: 'Hero', icon: 'lucide:sparkles', description: 'The big opening: avatar, title and buttons.' },
  about: { label: 'About', icon: 'lucide:user-round', description: 'Bio, portrait, interests and a quote.' },
  status: { label: 'Status cards', icon: 'lucide:activity', description: 'Small cards: what you are doing, learning, and so on.' },
  skills: { label: 'Skills', icon: 'lucide:cpu', description: 'Skill categories, the 3D sphere and the marquee.' },
  projects: { label: 'Projects', icon: 'lucide:folder-kanban', description: 'Featured projects and a grid of the rest.' },
  contact: { label: 'Contact', icon: 'lucide:mail', description: 'Closing call to action with your social links.' },
  custom: { label: 'Custom', icon: 'lucide:layout-template', description: 'Heading, text, an image and links: for anything else.' },
};

export const sectionTitle = (section: Section) =>
  ('heading' in section && section.heading) || (section.type === 'hero' ? section.title.split('\n').join(' ') : '') || TYPE_INFO[section.type].label;

export const newLink = (): Link => ({ label: 'New link', href: 'https://', variant: 'secondary' });

/** A new section of the given type with sensible starter content and a free id. */
export function newSection(type: Section['type'], content: Content): Section {
  const taken = new Set(content.sections.map((s) => s.id));
  const id = taken.has(type) ? newId(type) : type;
  const base = { id, visible: true } as const;
  switch (type) {
    case 'hero':
      return { ...base, type, title: 'Hello', ctas: [] };
    case 'about':
      return { ...base, type, heading: 'About', body: '', interests: [] };
    case 'status':
      return { ...base, type, cards: [] };
    case 'skills':
      return { ...base, type, heading: 'Skills', categories: [] };
    case 'projects':
      return { ...base, type, heading: 'Projects', projects: [] };
    case 'contact':
      return { ...base, type, heading: 'Get in touch', body: '', showSocials: true, ctas: [] };
    case 'custom':
      return { ...base, type, heading: 'New section', body: '', links: [] };
  }
}

const humanize = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

/** "Projects › Safar › Links › #2 › Href" for a validation issue's path. */
export function describePath(content: unknown, path: PropertyKey[]) {
  const parts: string[] = [];
  let node = content as Record<PropertyKey, unknown> | undefined;
  for (const key of path) {
    const next = node?.[key] as Record<string, unknown> | undefined;
    if (typeof key === 'number') {
      const name = next?.title ?? next?.name ?? next?.label ?? next?.heading ?? (next?.type && TYPE_INFO[next.type as Section['type']]?.label);
      parts.push(typeof name === 'string' && name.trim() ? name.split('\n')[0] : `#${key + 1}`);
    } else if (key !== 'sections') {
      parts.push(humanize(String(key)));
    }
    node = next;
  }
  return parts.join(' › ');
}
