import { Icon } from '@iconify/react';
import { useEffect, useRef, useState } from 'react';
import { contentSchema, type Content, type Section, type Site } from '../data/schema';
import { TYPE_INFO, newId, newSection } from './content';
import { IconInput, ImageInput, PdfInput } from './inputs';
import { supabase } from './supabase';
import { Card, ErrorText, Field, SortableList, TextArea, TextInput, type Path } from './ui';

export function SitePanel({
  site,
  onChange,
  draft,
  published,
  replaceDraft,
}: {
  site: Site;
  onChange: (site: Site) => void;
  draft: Content;
  published: Content | undefined;
  replaceDraft: (content: Content, message: string) => void;
}) {
  const path: Path = ['site'];
  const importInput = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `portfolio-content-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return window.alert('That file is not valid JSON.');
    }
    const parsed = contentSchema.safeParse(data);
    if (!parsed.success) return window.alert(`That file doesn't match the content format:\n\n${parsed.error.issues.slice(0, 5).map((i) => `• ${i.path.join('.')}: ${i.message}`).join('\n')}`);
    if (window.confirm('Replace the whole draft with this file?')) replaceDraft(parsed.data, 'Draft replaced from file.');
  };

  return (
    <>
      <Card title="Identity">
        <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
          <Field label="Your name" path={[...path, 'name']}>
            <TextInput value={site.name} onChange={(name) => onChange({ ...site, name })} />
          </Field>
          <Field label="Initials" hint="Short form of your name; not shown on the site right now." path={[...path, 'initials']}>
            <TextInput value={site.initials} onChange={(initials) => onChange({ ...site, initials })} maxLength={3} />
          </Field>
        </div>
        <Field label="Footer line" hint={`Shown after “© ${new Date().getFullYear()} ${site.name}.”`} path={[...path, 'footer']}>
          <TextInput value={site.footer} onChange={(footer) => onChange({ ...site, footer })} />
        </Field>
        <Field label="Resume (PDF)" group hint="Visitors always get it at /resume.pdf, so links never change.">
          <PdfInput value={site.resumeUrl} onChange={(resumeUrl) => onChange({ ...site, resumeUrl })} />
        </Field>
      </Card>

      <Card title="Social links" description="Shown in the contact section; status cards can show some of them too.">
        <SortableList
          items={site.socials}
          onChange={(socials) => onChange({ ...site, socials })}
          itemKey={(social) => social.id}
          itemLabel={(social) => social.label}
          onAdd={() => ({ id: newId('link'), label: 'New link', href: 'https://', icon: 'lucide:link' })}
          addLabel="Add social link"
          confirmRemove
          renderItem={(social, update, i) => (
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr_13rem]">
              <TextInput value={social.label} onChange={(label) => update({ ...social, label })} aria-label="Name" placeholder="Name" />
              <TextInput value={social.href} onChange={(href) => update({ ...social, href })} aria-label="Link" placeholder="https://… or mailto:…" spellCheck={false} />
              <IconInput value={social.icon} onChange={(icon) => update({ ...social, icon: icon ?? '' })} required />
              <ErrorText path={[...path, 'socials', i, 'href']} />
              <ErrorText path={[...path, 'socials', i, 'icon']} />
            </div>
          )}
        />
      </Card>

      <Card title="Search & sharing" description="What Google and link previews show.">
        <Field label="Page title" path={[...path, 'seo', 'title']}>
          <TextInput value={site.seo.title} onChange={(title) => onChange({ ...site, seo: { ...site.seo, title } })} />
        </Field>
        <Field label="Description" hint={`${site.seo.description.length} characters; around 150 works best.`} path={[...path, 'seo', 'description']}>
          <TextArea value={site.seo.description} onChange={(description) => onChange({ ...site, seo: { ...site.seo, description } })} rows={2} />
        </Field>
        <Field label="Share image" group hint="Used when the link is shared (1200×630 works best).">
          <ImageInput value={site.seo.ogImage} onChange={(ogImage) => onChange({ ...site, seo: { ...site.seo, ogImage } })} folder="og" />
        </Field>
      </Card>

      <Card title="Backup" description="Download the draft as a file, or load one back in.">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={exportJson}>
            <Icon icon="lucide:download" /> Download JSON
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => importInput.current?.click()}>
            <Icon icon="lucide:upload" /> Load JSON
          </button>
          {published && (
            <button
              type="button"
              className="btn btn-secondary btn-sm hover:!border-rose-400 hover:!text-rose-400"
              onClick={() => window.confirm('Throw away all unpublished changes?') && replaceDraft(published, 'Draft reset to the published version.')}
            >
              <Icon icon="lucide:undo-2" /> Discard unpublished changes
            </button>
          )}
        </div>
        <input
          ref={importInput}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            importJson(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </Card>
    </>
  );
}

type HistoryRow = { id: number; published_at: string };

export function HistoryPanel({ replaceDraft }: { replaceDraft: (content: Content, message: string) => void }) {
  const [rows, setRows] = useState<HistoryRow[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    supabase!
      .from('site_content_history')
      .select('id, published_at')
      .order('published_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => (error ? setError(error.message) : setRows(data)));
  }, []);

  const restore = async (row: HistoryRow) => {
    const when = new Date(row.published_at).toLocaleString();
    if (!window.confirm(`Load the version published ${when} into the draft? Your current draft will be replaced.`)) return;
    const { data, error } = await supabase!.from('site_content_history').select('data').eq('id', row.id).single();
    if (error) return window.alert(error.message);
    const parsed = contentSchema.safeParse(data.data);
    replaceDraft((parsed.success ? parsed.data : data.data) as Content, `Loaded the version from ${when}. Publish to make it live.`);
  };

  return (
    <Card title="Published versions" description="Every publish is kept. Load one into the draft, check it, then publish again to roll back.">
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {!rows && !error && <Icon icon="lucide:loader-circle" className="animate-spin text-xl text-brand" />}
      {rows?.length === 0 && <p className="text-sm text-faint">Nothing published from the admin yet.</p>}
      <ol className="divide-y divide-line">
        {rows?.map((row, i) => (
          <li key={row.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium">{new Date(row.published_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
              {i === 0 && <p className="text-xs text-brand">Currently live</p>}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => restore(row)}>
              <Icon icon="lucide:history" /> Load into draft
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function AddSectionPanel({ onAdd, draft }: { onAdd: (section: Section) => void; draft: Content }) {
  const order: Section['type'][] = ['custom', 'projects', 'skills', 'status', 'about', 'contact', 'hero'];
  return (
    <Card title="Add a section" description="It's added at the end; drag it into place in the sidebar.">
      <div className="grid gap-3 sm:grid-cols-2">
        {order.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onAdd(newSection(type, draft))}
            className="group flex items-start gap-3 rounded-xl border border-line bg-bg/40 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-lg text-brand transition group-hover:bg-brand group-hover:text-on-brand">
              <Icon icon={TYPE_INFO[type].icon} />
            </span>
            <span>
              <span className="block font-medium">{TYPE_INFO[type].label}</span>
              <span className="mt-0.5 block text-sm text-muted">{TYPE_INFO[type].description}</span>
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
