import { getIconData, iconToHTML, iconToSVG, replaceIDs } from '@iconify/utils';
import { icons as lucide } from '@iconify-json/lucide';
import { icons as simpleIcons } from '@iconify-json/simple-icons';

const sets = { lucide, 'simple-icons': simpleIcons };

/**
 * Inline SVG markup for an Iconify name like "lucide:brain". Returns null for an
 * unknown icon instead of throwing, so a typo in /admin can't break a publish.
 */
export function iconSvg(name: string, attributes: Record<string, string> = {}) {
  const [prefix, iconName] = name.split(':');
  const set = sets[prefix as keyof typeof sets];
  const data = set && getIconData(set, iconName);
  if (!data) {
    console.warn(`[icons] Unknown icon "${name}"`);
    return null;
  }
  const svg = iconToSVG(data, { height: '1em' });
  return iconToHTML(replaceIDs(svg.body), { ...svg.attributes, ...attributes });
}
