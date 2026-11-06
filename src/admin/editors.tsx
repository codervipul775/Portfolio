import { Icon } from '@iconify/react';
import type { Content, Project, Section, SectionOf, Site } from '../data/schema';
import { CODE_COLORS, DEFAULT_SCREEN, codeLines, resolveScreen, type SceneData } from '../scene/code';
import { newId, slugify } from './content';
import { IconInput, ImageInput, LinkList, MarkdownInput, markdownHint } from './inputs';
import { Card, ErrorText, Field, SortableList, TagInput, TextArea, TextInput, Toggle, cx, type Path } from './ui';

type EditorProps<T extends Section['type']> = {
  section: SectionOf<T>;
  onChange: (section: SectionOf<T>) => void;
  path: Path;
  site: Site;
  /** The whole draft, for editors whose preview depends on other sections. */
  content: Content;
};

/** Settings every section has: anchor id, nav label, visibility. */
export function SectionSettings({ section, onChange, path }: { section: Section; onChange: (s: Section) => void; path: Path }) {
  return (
    <Card title="Section settings">
      <Toggle checked={section.visible} onChange={(visible) => onChange({ ...section, visible })} label="Show on the site" hint="Hidden sections stay here but aren't published." />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Show in the nav bar as" hint="Leave empty to keep it out of the nav." path={[...path, 'navLabel']}>
          <TextInput value={section.navLabel} onChange={(v) => onChange({ ...section, navLabel: v || undefined })} placeholder="e.g. Works" />
        </Field>
        <Field label="Link id" hint={`The page link becomes #${section.id || '…'}`} path={[...path, 'id']}>
          <TextInput value={section.id} onChange={(v) => onChange({ ...section, id: slugify(v) })} spellCheck={false} />
        </Field>
      </div>
    </Card>
  );
}

type ScreenSettings = NonNullable<SectionOf<'hero'>['screen']>;

export function HeroEditor({ section, onChange, path, content }: EditorProps<'hero'>) {
  const screen = { ...DEFAULT_SCREEN, ...section.screen };
  const setScreen = (patch: Partial<ScreenSettings>) => onChange({ ...section, screen: { ...screen, ...patch } });
  // What each empty field falls back to, shown as placeholders.
  const auto = resolveScreen({ ...content, sections: content.sections.map((s) => (s === section ? { ...section, screen: undefined } : s)) });

  return (
    <>
      <Card title="Intro">
        <Field label="Title" hint="Each line is animated letter by letter; the last line gets the gradient." path={[...path, 'title']}>
          <TextArea value={section.title} onChange={(title) => onChange({ ...section, title })} rows={2} className="text-lg font-semibold" />
        </Field>
        <Field label="Avatar" group>
          <ImageInput value={section.avatar} onChange={(avatar) => onChange({ ...section, avatar })} aspect="aspect-square max-w-40" />
        </Field>
      </Card>
      <Card title="Buttons">
        <LinkList value={section.ctas} onChange={(ctas) => onChange({ ...section, ctas })} path={[...path, 'ctas']} />
      </Card>
      <Card title="Laptop screen" description="The code the 3D laptop types. Leave a field empty to fill it in automatically.">
        <ScreenPreview data={resolveScreen(content)} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="File name">
            <TextInput value={screen.fileName} onChange={(fileName) => setScreen({ fileName })} placeholder={DEFAULT_SCREEN.fileName} spellCheck={false} />
          </Field>
          <Field label="Comment on the first line" hint="Leave empty to skip the comment line.">
            <TextInput value={screen.comment} onChange={(comment) => setScreen({ comment })} />
          </Field>
          <Field label="Name" hint="Empty: your name from Site settings.">
            <TextInput value={screen.name} onChange={(v) => setScreen({ name: v || undefined })} placeholder={auto.name} />
          </Field>
          <Field label="Role" hint="Empty: the hero title.">
            <TextInput value={screen.role} onChange={(v) => setScreen({ role: v || undefined })} placeholder={auto.role} />
          </Field>
          <Field label="Projects" hint="Empty: counts your visible projects." path={[...path, 'screen', 'projects']}>
            <TextInput
              type="number"
              min={0}
              value={screen.projects === undefined ? '' : String(screen.projects)}
              onChange={(v) => setScreen({ projects: v === '' ? undefined : Math.max(0, Math.round(Number(v))) })}
              placeholder={String(auto.projects)}
            />
          </Field>
          <Field label="Builds…" hint="The last line: developer.build('…')">
            <TextInput value={screen.buildTarget} onChange={(buildTarget) => setScreen({ buildTarget })} />
          </Field>
        </div>
        <Field label="Skills" group hint={`Empty: your first 3 skills (${auto.skills.join(', ') || 'none yet'}).`}>
          <TagInput value={screen.skills ?? []} onChange={(skills) => setScreen({ skills: skills.length ? skills : undefined })} placeholder="Type a skill and press Enter" />
        </Field>
        <Toggle checked={screen.openToWork} onChange={(openToWork) => setScreen({ openToWork })} label="Open to work" hint="openToWork: true / false" />
      </Card>
    </>
  );
}

/** The laptop's code, as it will be typed on the site. */
function ScreenPreview({ data }: { data: SceneData }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center gap-1.5 bg-[#161b22] px-3 pt-2">
        {['#ff5f57', '#febc2e', '#28c840'].map((color) => (
          <span key={color} className="size-2.5 rounded-full" style={{ background: color }} />
        ))}
        <span className="ml-3 rounded-t-md bg-[#0d1117] px-3 py-1.5 font-mono text-xs">{data.fileName}</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6">
        {codeLines(data).map((line, i) => (
          <div key={i} className="flex">
            <span className="w-8 shrink-0 pr-4 text-right text-[#6e7681] select-none">{i + 1}</span>
            <span>
              {line.map(([text, color], j) => (
                <span key={j} style={{ color: CODE_COLORS[color] }}>
                  {text}
                </span>
              ))}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}

export function AboutEditor({ section, onChange, path }: EditorProps<'about'>) {
  return (
    <>
      <Card title="Bio">
        <Field label="Heading" path={[...path, 'heading']}>
          <TextInput value={section.heading} onChange={(heading) => onChange({ ...section, heading })} />
        </Field>
        <Field label="Text" hint={markdownHint} path={[...path, 'body']}>
          <MarkdownInput value={section.body} onChange={(body) => onChange({ ...section, body })} rows={6} />
        </Field>
        <Field label="Portrait" group>
          <ImageInput value={section.portrait} onChange={(portrait) => onChange({ ...section, portrait })} aspect="aspect-[4/5] max-w-56" />
        </Field>
      </Card>
      <Card title="Interests">
        <Field label="Heading above the interests" path={[...path, 'interestsHeading']}>
          <TextInput value={section.interestsHeading} onChange={(v) => onChange({ ...section, interestsHeading: v || undefined })} />
        </Field>
        <SortableList
          items={section.interests}
          onChange={(interests) => onChange({ ...section, interests })}
          itemKey={(item) => item.id}
          itemLabel={(item) => item.label}
          onAdd={() => ({ id: newId('interest'), label: 'New interest' })}
          addLabel="Add interest"
          renderItem={(item, update, i) => (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <TextInput value={item.label} onChange={(label) => update({ ...item, label })} aria-label="Interest" />
              <div className="sm:w-56">
                <IconInput value={item.icon} onChange={(icon) => update({ ...item, icon })} />
              </div>
              <ErrorText path={[...path, 'interests', i, 'label']} />
            </div>
          )}
        />
      </Card>
      <Card
        title="Quote"
        actions={
          <Toggle
            checked={!!section.quote}
            onChange={(on) => onChange({ ...section, quote: on ? { text: '', author: '' } : undefined })}
            label="Show"
          />
        }
      >
        {section.quote ? (
          <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
            <Field label="Quote">
              <TextArea value={section.quote.text} onChange={(text) => onChange({ ...section, quote: { ...section.quote!, text } })} rows={2} />
            </Field>
            <Field label="Author">
              <TextInput value={section.quote.author} onChange={(author) => onChange({ ...section, quote: { ...section.quote!, author } })} />
            </Field>
          </div>
        ) : (
          <p className="text-sm text-faint">No quote.</p>
        )}
      </Card>
    </>
  );
}

export function StatusEditor({ section, onChange, path, site }: EditorProps<'status'>) {
  return (
    <>
      <Card title="Heading" description="Optional. Without one, the cards sit right under the section above.">
        <Field label="Heading" path={[...path, 'heading']}>
          <TextInput value={section.heading} onChange={(v) => onChange({ ...section, heading: v || undefined })} placeholder="None" />
        </Field>
      </Card>
      <Card title="Cards">
        <SortableList
          items={section.cards}
          onChange={(cards) => onChange({ ...section, cards })}
          itemKey={(card) => card.id}
          itemLabel={(card) => card.title}
          collapsible
          confirmRemove
          renderSummary={(card) => (
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line" style={{ color: card.accent }}>
              {card.icon && <Icon icon={card.icon} />}
            </span>
          )}
          onAdd={() => ({ id: newId('card'), title: 'New card', body: '', chips: [], socialIds: [] })}
          addLabel="Add card"
          renderItem={(card, update, i) => (
            <>
              <div className="grid gap-5 sm:grid-cols-[1fr_auto_auto]">
                <Field label="Title" path={[...path, 'cards', i, 'title']}>
                  <TextInput value={card.title} onChange={(title) => update({ ...card, title })} />
                </Field>
                <Field label="Icon" group>
                  <div className="sm:w-56">
                    <IconInput value={card.icon} onChange={(icon) => update({ ...card, icon })} />
                  </div>
                </Field>
                <Field label="Accent" path={[...path, 'cards', i, 'accent']}>
                  <input
                    type="color"
                    value={card.accent ?? '#2bb8f2'}
                    onChange={(e) => update({ ...card, accent: e.target.value })}
                    className="h-[42px] w-16 cursor-pointer rounded-xl border border-line bg-bg/60 p-1"
                  />
                </Field>
              </div>
              <Field label="Text" hint={markdownHint}>
                <MarkdownInput value={card.body} onChange={(body) => update({ ...card, body })} rows={3} />
              </Field>
              <Field label="Chips" group>
                <TagInput value={card.chips} onChange={(chips) => update({ ...card, chips })} />
              </Field>
              <Field label="Social links on this card" group hint="Edit the links themselves in Site settings.">
                <div className="flex flex-wrap gap-2">
                  {site.socials.map((social) => {
                    const on = card.socialIds.includes(social.id);
                    return (
                      <button
                        key={social.id}
                        type="button"
                        onClick={() =>
                          update({ ...card, socialIds: on ? card.socialIds.filter((id) => id !== social.id) : [...card.socialIds, social.id] })
                        }
                        className={cx(
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition',
                          on ? 'border-brand bg-brand/15 text-fg' : 'border-line text-muted hover:border-line-strong',
                        )}
                      >
                        <Icon icon={social.icon} /> {social.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </>
          )}
        />
      </Card>
    </>
  );
}

export function SkillsEditor({ section, onChange, path }: EditorProps<'skills'>) {
  return (
    <>
      <Card title="Heading">
        <Field label="Heading" path={[...path, 'heading']}>
          <TextInput value={section.heading} onChange={(heading) => onChange({ ...section, heading })} />
        </Field>
      </Card>
      <Card title="Categories" description="Every skill also appears on the 3D sphere and in the scrolling banner.">
        <SortableList
          items={section.categories}
          onChange={(categories) => onChange({ ...section, categories })}
          itemKey={(category) => category.id}
          itemLabel={(category) => category.name}
          collapsible
          confirmRemove
          renderSummary={(category) => <span className="tag shrink-0">{category.skills.length}</span>}
          onAdd={() => ({ id: newId('category'), name: 'New category', skills: [] })}
          addLabel="Add category"
          renderItem={(category, update, ci) => (
            <>
              <Field label="Category name" path={[...path, 'categories', ci, 'name']}>
                <TextInput value={category.name} onChange={(name) => update({ ...category, name })} />
              </Field>
              <SortableList
                items={category.skills}
                onChange={(skills) => update({ ...category, skills })}
                itemKey={(skill) => skill.id}
                itemLabel={(skill) => skill.name}
                onAdd={() => ({ id: newId('skill'), name: 'New skill', highlight: false })}
                addLabel="Add skill"
                renderItem={(skill, updateSkill, si) => (
                  <div className="grid items-center gap-3 sm:grid-cols-[1fr_14rem_auto]">
                    <TextInput value={skill.name} onChange={(name) => updateSkill({ ...skill, name })} aria-label="Skill name" />
                    <IconInput value={skill.icon} onChange={(icon) => updateSkill({ ...skill, icon })} />
                    <Toggle checked={skill.highlight} onChange={(highlight) => updateSkill({ ...skill, highlight })} label="Highlight" />
                    <ErrorText path={[...path, 'categories', ci, 'skills', si, 'name']} />
                  </div>
                )}
              />
            </>
          )}
        />
      </Card>
    </>
  );
}

const newProject = (): Project => ({
  id: newId('project'),
  title: 'New project',
  description: '',
  tags: [],
  links: [],
  featured: false,
  visible: true,
});

export function ProjectsEditor({ section, onChange, path }: EditorProps<'projects'>) {
  return (
    <>
      <Card title="Headings">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Heading" path={[...path, 'heading']}>
            <TextInput value={section.heading} onChange={(heading) => onChange({ ...section, heading })} />
          </Field>
          <Field label="Heading above the grid" hint="Shown above the non-featured projects.">
            <TextInput value={section.moreHeading} onChange={(v) => onChange({ ...section, moreHeading: v || undefined })} />
          </Field>
        </div>
      </Card>
      <Card title="Projects" description="Featured projects get the large 3D showcase, in this order; the rest go in the grid.">
        <SortableList
          items={section.projects}
          onChange={(projects) => onChange({ ...section, projects })}
          itemKey={(project) => project.id}
          itemLabel={(project) => project.title}
          collapsible
          confirmRemove
          renderSummary={(project) => (
            <>
              <span className="h-9 w-14 shrink-0 overflow-hidden rounded-md border border-line bg-bg">
                {project.image && <img src={project.image.url} alt="" className="size-full object-cover" />}
              </span>
              {project.featured && <span className="tag shrink-0 border-brand/50 text-brand">Featured</span>}
              {!project.visible && <span className="tag shrink-0">Hidden</span>}
            </>
          )}
          onAdd={newProject}
          addLabel="Add project"
          renderItem={(project, update, i) => (
            <>
              <div className="flex flex-wrap gap-6">
                <Toggle checked={project.featured} onChange={(featured) => update({ ...project, featured })} label="Featured" />
                <Toggle checked={project.visible} onChange={(visible) => update({ ...project, visible })} label="Visible" />
              </div>
              <Field label="Title" path={[...path, 'projects', i, 'title']}>
                <TextInput value={project.title} onChange={(title) => update({ ...project, title })} />
              </Field>
              <Field label="Description">
                <TextArea value={project.description} onChange={(description) => update({ ...project, description })} rows={3} />
              </Field>
              <Field label="Screenshot" group hint={project.featured ? undefined : 'Optional for grid projects.'}>
                <ImageInput value={project.image} onChange={(image) => update({ ...project, image })} folder="projects" />
              </Field>
              <Field label="Tech tags" group>
                <TagInput value={project.tags} onChange={(tags) => update({ ...project, tags })} placeholder="React.js, MongoDB…" />
              </Field>
              <Field label="Links" group>
                <LinkList value={project.links} onChange={(links) => update({ ...project, links })} path={[...path, 'projects', i, 'links']} addLabel="Add link" />
              </Field>
            </>
          )}
        />
      </Card>
      <Card
        title="Button after the projects"
        actions={
          <Toggle
            checked={!!section.cta}
            onChange={(on) => onChange({ ...section, cta: on ? { label: 'See more', href: 'https://github.com/', variant: 'secondary' } : undefined })}
            label="Show"
          />
        }
      >
        {section.cta ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Label" path={[...path, 'cta', 'label']}>
              <TextInput value={section.cta.label} onChange={(label) => onChange({ ...section, cta: { ...section.cta!, label } })} />
            </Field>
            <Field label="Link to" path={[...path, 'cta', 'href']}>
              <TextInput value={section.cta.href} onChange={(href) => onChange({ ...section, cta: { ...section.cta!, href } })} spellCheck={false} />
            </Field>
            <Field label="Icon" group>
              <IconInput value={section.cta.icon} onChange={(icon) => onChange({ ...section, cta: { ...section.cta!, icon } })} />
            </Field>
          </div>
        ) : (
          <p className="text-sm text-faint">No button.</p>
        )}
      </Card>
    </>
  );
}

export function ContactEditor({ section, onChange, path }: EditorProps<'contact'>) {
  return (
    <>
      <Card title="Message">
        <Field label="Heading" path={[...path, 'heading']}>
          <TextInput value={section.heading} onChange={(heading) => onChange({ ...section, heading })} />
        </Field>
        <Field label="Text" hint={markdownHint}>
          <MarkdownInput value={section.body} onChange={(body) => onChange({ ...section, body })} rows={2} />
        </Field>
        <Toggle
          checked={section.showSocials}
          onChange={(showSocials) => onChange({ ...section, showSocials })}
          label="Show social links"
          hint="The links are edited in Site settings."
        />
      </Card>
      <Card title="Buttons">
        <LinkList value={section.ctas} onChange={(ctas) => onChange({ ...section, ctas })} path={[...path, 'ctas']} />
      </Card>
    </>
  );
}

export function CustomEditor({ section, onChange, path }: EditorProps<'custom'>) {
  return (
    <>
      <Card title="Content">
        <Field label="Heading" path={[...path, 'heading']}>
          <TextInput value={section.heading} onChange={(heading) => onChange({ ...section, heading })} />
        </Field>
        <Field label="Text" hint={markdownHint}>
          <MarkdownInput value={section.body} onChange={(body) => onChange({ ...section, body })} rows={6} />
        </Field>
        <Field label="Image" group hint="Optional. Shown beside the text on wide screens.">
          <ImageInput value={section.image} onChange={(image) => onChange({ ...section, image })} />
        </Field>
      </Card>
      <Card title="Buttons">
        <LinkList value={section.links} onChange={(links) => onChange({ ...section, links })} path={[...path, 'links']} />
      </Card>
    </>
  );
}
