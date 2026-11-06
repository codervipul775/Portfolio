// The code snippet the 3D laptop types. Kept free of three.js so the admin can
// preview it without loading the 3D engine.
import type { Content, SectionOf } from '../data/schema';

/** Everything the laptop screen shows, with the admin's choices and fallbacks applied. */
export type SceneData = {
  fileName: string;
  comment: string;
  name: string;
  role: string;
  skills: string[];
  projects: number;
  openToWork: boolean;
  buildTarget: string;
};

export const DEFAULT_SCREEN = { fileName: 'developer.ts', comment: 'hello, world', openToWork: true, buildTarget: 'the future' };

/** Fills empty screen fields from the rest of the content (name, hero title, first skills, project count). */
export function resolveScreen(content: Content): SceneData {
  const sections = content.sections.filter((s) => s.visible);
  const hero = sections.find((s): s is SectionOf<'hero'> => s.type === 'hero');
  const screen = { ...DEFAULT_SCREEN, ...hero?.screen };
  const skills = sections.flatMap((s) => (s.type === 'skills' ? s.categories.flatMap((c) => c.skills.map((k) => k.name)) : []));
  const projects = sections.flatMap((s) => (s.type === 'projects' ? s.projects.filter((p) => p.visible) : [])).length;
  return {
    fileName: screen.fileName || DEFAULT_SCREEN.fileName,
    comment: screen.comment,
    name: screen.name || content.site.name,
    role: screen.role || (hero ? hero.title.split('\n').join(' ') : ''),
    skills: screen.skills?.length ? screen.skills : skills.slice(0, 3),
    projects: screen.projects ?? projects,
    openToWork: screen.openToWork,
    buildTarget: screen.buildTarget,
  };
}

export const CODE_COLORS = {
  text: '#c9d1d9',
  keyword: '#ff7b72',
  string: '#a5d6ff',
  prop: '#79c0ff',
  fn: '#d2a8ff',
  number: '#79c0ff',
  bool: '#ffa657',
  comment: '#8b949e',
};

export type Token = [text: string, color: keyof typeof CODE_COLORS];

const quote = (s: string) => `'${s.replace(/'/g, "\\'")}'`;

/** The snippet as lines of coloured tokens. */
export function codeLines(data: SceneData): Token[][] {
  const skillTokens = data.skills.flatMap((skill, i): Token[] => [
    [quote(skill), 'string'],
    ...(i < data.skills.length - 1 ? ([[', ', 'text']] as Token[]) : []),
  ]);
  return [
    ...(data.comment.trim() ? [[[`// ${data.comment.trim()}`, 'comment']] as Token[]] : []),
    [['const ', 'keyword'], ['developer', 'prop'], [' = {', 'text']],
    [['  name', 'prop'], [': ', 'text'], [quote(data.name), 'string'], [',', 'text']],
    [['  role', 'prop'], [': ', 'text'], [quote(data.role), 'string'], [',', 'text']],
    [['  skills', 'prop'], [': [', 'text'], ...skillTokens, ['],', 'text']],
    [['  projects', 'prop'], [': ', 'text'], [String(data.projects), 'number'], [',', 'text']],
    [['  openToWork', 'prop'], [': ', 'text'], [String(data.openToWork), 'bool'], [',', 'text']],
    [['};', 'text']],
    [],
    [['developer', 'prop'], ['.', 'text'], ['build', 'fn'], ['(', 'text'], [quote(data.buildTarget), 'string'], [');', 'text']],
  ];
}
