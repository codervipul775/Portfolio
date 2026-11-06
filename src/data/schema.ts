import { z } from 'zod';

// All site content is one JSON document validated by this schema. The build and
// the /admin editor share it, so the admin can never publish something the site
// can't render.

const id = z.string().regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes only');

/** Iconify name such as "lucide:brain" or "simple-icons:react". */
const icon = z.string().regex(/^[a-z0-9-]+:[a-z0-9-]+$/, 'Use an Iconify name like "lucide:brain"');

/** Short markdown: **bold**, *italic*, [links](https://…) and blank lines between paragraphs. */
const markdown = z.string();

/** Non-empty text, with a message the admin can show as-is. */
const required = z.string().trim().min(1, 'Required');

const url = z.url({ error: 'Must be a full link starting with https://' });

/** https://…, mailto:…, tel:…, #section or /path */
const href = required;

export const imageSchema = z.object({
  url,
  alt: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const linkSchema = z.object({
  label: required,
  href,
  icon: icon.optional(),
  variant: z.enum(['primary', 'secondary']).default('secondary'),
});

export const socialSchema = z.object({
  id,
  label: required,
  href,
  icon,
});

const sectionBase = {
  /** Also the #anchor in the URL. */
  id,
  visible: z.boolean().default(true),
  /** When set, the section gets a link in the nav bar. */
  navLabel: z.string().optional(),
};

export const heroSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('hero'),
  /** Line breaks are kept. */
  title: z.string(),
  avatar: imageSchema.optional(),
  ctas: z.array(linkSchema),
  /** What the 3D laptop types. Empty fields fall back to the rest of the content (see scene/code.ts). */
  screen: z
    .object({
      fileName: z.string().default('developer.ts'),
      comment: z.string().default('hello, world'),
      name: z.string().optional(),
      role: z.string().optional(),
      skills: z.array(z.string()).optional(),
      projects: z.number().int().min(0, 'Must be 0 or more').optional(),
      openToWork: z.boolean().default(true),
      buildTarget: z.string().default('the future'),
    })
    .optional(),
});

export const aboutSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('about'),
  heading: z.string(),
  body: markdown,
  portrait: imageSchema.optional(),
  interestsHeading: z.string().optional(),
  interests: z.array(z.object({ id, label: required, icon: icon.optional() })),
  quote: z.object({ text: z.string(), author: z.string() }).optional(),
});

export const statusCardSchema = z.object({
  id,
  title: required,
  icon: icon.optional(),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i, 'Hex colour like #11a9eb').optional(),
  body: markdown.default(''),
  chips: z.array(z.string()).default([]),
  /** Ids from site.socials to show as icon links on the card. */
  socialIds: z.array(id).default([]),
});

export const statusSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('status'),
  heading: z.string().optional(),
  cards: z.array(statusCardSchema),
});

export const skillSchema = z.object({
  id,
  name: required,
  icon: icon.optional(),
  highlight: z.boolean().default(false),
});

export const skillCategorySchema = z.object({
  id,
  name: required,
  skills: z.array(skillSchema),
});

export const skillsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('skills'),
  heading: z.string(),
  categories: z.array(skillCategorySchema),
});

export const projectSchema = z.object({
  id,
  title: required,
  description: z.string(),
  image: imageSchema.optional(),
  tags: z.array(z.string()),
  links: z.array(linkSchema),
  /** Featured projects get the large showcase; the rest go in the grid. */
  featured: z.boolean().default(false),
  visible: z.boolean().default(true),
});

export const projectsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('projects'),
  heading: z.string(),
  moreHeading: z.string().optional(),
  projects: z.array(projectSchema),
  cta: linkSchema.optional(),
});

export const contactSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('contact'),
  heading: z.string(),
  body: markdown,
  showSocials: z.boolean().default(true),
  ctas: z.array(linkSchema),
});

/** Free-form section for anything the other types don't cover. */
export const customSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('custom'),
  heading: z.string(),
  body: markdown,
  image: imageSchema.optional(),
  links: z.array(linkSchema).default([]),
});

export const sectionSchema = z.discriminatedUnion('type', [
  heroSectionSchema,
  aboutSectionSchema,
  statusSectionSchema,
  skillsSectionSchema,
  projectsSectionSchema,
  contactSectionSchema,
  customSectionSchema,
]);

export const contentSchema = z
  .object({
    version: z.literal(1),
    site: z.object({
      name: required,
      initials: required.max(3, 'Up to 3 letters'),
      seo: z.object({
        title: z.string(),
        description: z.string(),
        ogImage: imageSchema.optional(),
      }),
      /** Copied into the build and served at /resume.pdf, so resume links never change. */
      resumeUrl: url.optional(),
      footer: z.string(),
      socials: z.array(socialSchema),
    }),
    sections: z.array(sectionSchema),
  })
  .superRefine((content, ctx) => {
    const seen = new Set<string>();
    content.sections.forEach((section, i) => {
      if (seen.has(section.id)) {
        ctx.addIssue({ code: 'custom', path: ['sections', i, 'id'], message: `Duplicate section id "${section.id}"` });
      }
      seen.add(section.id);
    });
  });

export type Content = z.infer<typeof contentSchema>;
export type Site = Content['site'];
export type Section = z.infer<typeof sectionSchema>;
export type SectionOf<T extends Section['type']> = Extract<Section, { type: T }>;
export type ImageRef = z.infer<typeof imageSchema>;
export type Link = z.infer<typeof linkSchema>;
export type Social = z.infer<typeof socialSchema>;
export type Project = z.infer<typeof projectSchema>;
