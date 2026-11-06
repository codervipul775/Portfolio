import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { contentSchema, type Content, type Section, type Site } from '../data/schema';
import { TYPE_INFO, describePath, replaceAt, sectionTitle } from './content';
import { AboutEditor, ContactEditor, CustomEditor, HeroEditor, ProjectsEditor, SectionSettings, SkillsEditor, StatusEditor } from './editors';
import { AddSectionPanel, HistoryPanel, SitePanel } from './panels';
import { useDraft, type SaveState } from './store';
import { accessToken, supabase } from './supabase';
import { Centered, IconButton, IssuesContext, Spinner, cx } from './ui';

type View = { kind: 'site' } | { kind: 'section'; index: number } | { kind: 'add' } | { kind: 'history' };
type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info' };

export function Editor({ email }: { email?: string }) {
  const { draft, published, setPublished, loadError, saveState, setDraft, save, reload } = useDraft();
  const [view, setView] = useState<View>({ kind: 'site' });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [showIssues, setShowIssues] = useState(false);

  const issues = useMemo(() => {
    if (!draft) return [];
    const result = contentSchema.safeParse(draft);
    return result.success ? [] : result.error.issues;
  }, [draft]);
  const issueMap = useMemo(() => new Map(issues.map((issue) => [issue.path.join('.'), issue.message])), [issues]);
  const unpublished = useMemo(() => !!draft && !!published && JSON.stringify(draft) !== JSON.stringify(published), [draft, published]);

  // Warn before leaving with unsaved edits; Ctrl/Cmd+S saves immediately.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState !== 'saved') e.preventDefault();
    };
    const keydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    addEventListener('beforeunload', beforeUnload);
    addEventListener('keydown', keydown);
    return () => {
      removeEventListener('beforeunload', beforeUnload);
      removeEventListener('keydown', keydown);
    };
  }, [saveState, save]);

  const toast = (message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all, { id, message, tone }]);
    window.setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 6500);
  };

  if (loadError) {
    return (
      <Centered>
        <div className="max-w-md rounded-3xl border border-line bg-surface p-8 text-center">
          <Icon icon={loadError === 'not-admin' ? 'lucide:shield-x' : 'lucide:cloud-off'} className="mx-auto text-4xl text-rose-400" />
          <p className="mt-4 font-medium">{loadError === 'not-admin' ? `${email} isn't an admin.` : `Couldn't load the content: ${loadError}`}</p>
          {loadError === 'not-admin' && <p className="mt-2 text-sm text-muted">Add this user to the public.admins table in Supabase, then reload.</p>}
          <div className="mt-6 flex justify-center gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>
              Retry
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => supabase!.auth.signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </Centered>
    );
  }
  if (!draft) return <Centered><Spinner /></Centered>;

  const updateSection = (index: number, section: Section) => setDraft((d) => ({ ...d, sections: replaceAt(d.sections, index, section) }));
  const replaceDraft = (content: Content, message: string) => {
    setDraft(() => content);
    setView({ kind: 'site' });
    toast(message, 'info');
  };

  const moveSection = (from: number, to: number) => {
    if (to < 0 || to >= draft.sections.length) return;
    setDraft((d) => {
      const sections = [...d.sections];
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      return { ...d, sections };
    });
    if (view.kind === 'section' && view.index === from) setView({ kind: 'section', index: to });
  };

  const deleteSection = (index: number) => {
    if (!window.confirm(`Delete the “${sectionTitle(draft.sections[index])}” section? You can undo this by not publishing (or from Version history).`)) return;
    setDraft((d) => ({ ...d, sections: d.sections.filter((_, i) => i !== index) }));
    setView({ kind: 'site' });
  };

  const publish = async () => {
    setPublishing(true);
    try {
      if (!(await save())) throw new Error("Couldn't save the draft, so nothing was published.");
      const res = await fetch('/api/publish', { method: 'POST', headers: { Authorization: `Bearer ${await accessToken()}` } });
      const body = (await res.json().catch(() => ({}))) as { error?: string; deploy?: 'started' | 'skipped' | 'failed' };
      if (!res.ok && !body.deploy) throw new Error(body.error ?? `Publishing failed (${res.status}).`);
      setPublished(draft);
      if (body.deploy === 'started') toast('Published! The site is rebuilding and is usually live in about a minute.');
      else if (body.deploy === 'skipped') toast('Published to the database. No deploy hook is set up here, so the live site was not rebuilt.', 'info');
      else toast('Published, but Vercel did not accept the rebuild request. Publish again to retry.', 'error');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Publishing failed.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  // Posts the current (even unsaved) draft to /preview, which renders it with the real site components.
  const preview = async () => {
    if (issues.length) return toast('Fix the issues first; the preview needs valid content.', 'error');
    const form = Object.assign(document.createElement('form'), { method: 'POST', action: '/preview', target: '_blank' });
    for (const [name, value] of [
      ['token', (await accessToken()) ?? ''],
      ['content', JSON.stringify(draft)],
    ]) {
      form.append(Object.assign(document.createElement('input'), { type: 'hidden', name, value }));
    }
    document.body.append(form);
    form.submit();
    form.remove();
  };

  const sectionHasIssue = (index: number) => issues.some((issue) => issue.path[0] === 'sections' && issue.path[1] === index);
  const siteHasIssue = issues.some((issue) => issue.path[0] === 'site');
  const current = view.kind === 'section' ? draft.sections[view.index] : undefined;

  return (
    <IssuesContext.Provider value={issueMap}>
      <div className="min-h-svh pb-24">
        <header className="nav-bar sticky top-0 z-30 border-x-0 border-t-0">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 lg:px-6">
            <a href="/" target="_blank" className="flex items-center gap-2" title="Open the live site">
              <span className="text-gradient text-lg font-bold">VY</span>
              <span className="text-sm text-muted">Admin</span>
            </a>
            <SaveIndicator state={saveState} onRetry={save} />

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {issues.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowIssues(!showIssues)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300"
                  >
                    <Icon icon="lucide:triangle-alert" /> {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
                  </button>
                  {showIssues && (
                    <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-line bg-surface-strong p-2 shadow-2xl">
                      {issues.slice(0, 12).map((issue, i) => (
                        <button
                          key={i}
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left hover:bg-line"
                          onClick={() => {
                            setView(issue.path[0] === 'sections' && typeof issue.path[1] === 'number' ? { kind: 'section', index: issue.path[1] } : { kind: 'site' });
                            setShowIssues(false);
                          }}
                        >
                          <span className="block text-xs text-faint">{describePath(draft, issue.path)}</span>
                          <span className="block text-sm">{issue.message}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {unpublished && <span className="hidden rounded-full border border-line px-3 py-1.5 text-xs text-muted sm:inline">Unpublished changes</span>}
              <button type="button" className="btn btn-secondary btn-sm" onClick={preview}>
                <Icon icon="lucide:eye" /> Preview
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm disabled:opacity-40"
                onClick={publish}
                disabled={publishing || issues.length > 0 || !unpublished}
                title={issues.length ? 'Fix the issues first' : unpublished ? 'Make the draft live' : 'Nothing new to publish'}
              >
                <Icon icon={publishing ? 'lucide:loader-circle' : 'lucide:rocket'} className={cx(publishing && 'animate-spin')} />
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
              <ThemeButton />
              <IconButton icon="lucide:log-out" label={`Sign out${email ? ` (${email})` : ''}`} onClick={() => supabase!.auth.signOut()} />
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:px-6">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav className="rounded-2xl border border-line bg-surface p-2" aria-label="Editor">
              <NavItem icon="lucide:settings-2" label="Site settings" active={view.kind === 'site'} alert={siteHasIssue} onClick={() => setView({ kind: 'site' })} />
              <p className="eyebrow px-3 pt-4 pb-2">Sections</p>
              <SectionList
                sections={draft.sections}
                selected={view.kind === 'section' ? view.index : -1}
                hasIssue={sectionHasIssue}
                onSelect={(index) => setView({ kind: 'section', index })}
                onMove={moveSection}
                onToggle={(index) => updateSection(index, { ...draft.sections[index], visible: !draft.sections[index].visible })}
              />
              <NavItem icon="lucide:plus" label="Add section" active={view.kind === 'add'} onClick={() => setView({ kind: 'add' })} />
              <div className="my-2 border-t border-line" />
              <NavItem icon="lucide:history" label="Version history" active={view.kind === 'history'} onClick={() => setView({ kind: 'history' })} />
            </nav>
          </aside>

          <main className="min-w-0 space-y-5">
            {view.kind === 'site' && (
              <>
                <PanelHeader icon="lucide:settings-2" title="Site settings" description="Your name, resume, social links and how the site appears in search." />
                <SitePanel
                  site={draft.site}
                  onChange={(site: Site) => setDraft((d) => ({ ...d, site }))}
                  draft={draft}
                  published={published}
                  replaceDraft={replaceDraft}
                />
              </>
            )}
            {view.kind === 'section' && current && (
              <>
                <PanelHeader
                  icon={TYPE_INFO[current.type].icon}
                  title={sectionTitle(current)}
                  description={`${TYPE_INFO[current.type].label} section · ${TYPE_INFO[current.type].description}`}
                  actions={
                    <>
                      <IconButton icon="lucide:arrow-up" label="Move up" disabled={view.index === 0} onClick={() => moveSection(view.index, view.index - 1)} />
                      <IconButton icon="lucide:arrow-down" label="Move down" disabled={view.index === draft.sections.length - 1} onClick={() => moveSection(view.index, view.index + 1)} />
                      <IconButton icon="lucide:trash-2" label="Delete section" tone="danger" onClick={() => deleteSection(view.index)} />
                    </>
                  }
                />
                <SectionEditor section={current} index={view.index} site={draft.site} onChange={(s) => updateSection(view.index, s)} />
              </>
            )}
            {view.kind === 'add' && (
              <>
                <PanelHeader icon="lucide:plus" title="Add section" />
                <AddSectionPanel
                  draft={draft}
                  onAdd={(section) => {
                    setDraft((d) => ({ ...d, sections: [...d.sections, section] }));
                    setView({ kind: 'section', index: draft.sections.length });
                  }}
                />
              </>
            )}
            {view.kind === 'history' && (
              <>
                <PanelHeader icon="lucide:history" title="Version history" />
                <HistoryPanel replaceDraft={replaceDraft} />
              </>
            )}
          </main>
        </div>

        <div className="fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cx(
                'flex items-start gap-3 rounded-2xl border bg-surface-strong p-4 text-sm shadow-2xl',
                t.tone === 'error' ? 'border-rose-400/40' : t.tone === 'info' ? 'border-line-strong' : 'border-emerald-400/40',
              )}
            >
              <Icon
                icon={t.tone === 'error' ? 'lucide:circle-x' : t.tone === 'info' ? 'lucide:info' : 'lucide:circle-check'}
                className={cx('mt-0.5 shrink-0 text-lg', t.tone === 'error' ? 'text-rose-400' : t.tone === 'info' ? 'text-brand' : 'text-emerald-400')}
              />
              {t.message}
            </div>
          ))}
        </div>
      </div>
    </IssuesContext.Provider>
  );
}

function SectionEditor({ section, index, site, onChange }: { section: Section; index: number; site: Site; onChange: (s: Section) => void }) {
  const props = { path: ['sections', index], site };
  return (
    <>
      <SectionSettings section={section} onChange={onChange} path={props.path} />
      {section.type === 'hero' && <HeroEditor section={section} onChange={onChange} {...props} />}
      {section.type === 'about' && <AboutEditor section={section} onChange={onChange} {...props} />}
      {section.type === 'status' && <StatusEditor section={section} onChange={onChange} {...props} />}
      {section.type === 'skills' && <SkillsEditor section={section} onChange={onChange} {...props} />}
      {section.type === 'projects' && <ProjectsEditor section={section} onChange={onChange} {...props} />}
      {section.type === 'contact' && <ContactEditor section={section} onChange={onChange} {...props} />}
      {section.type === 'custom' && <CustomEditor section={section} onChange={onChange} {...props} />}
    </>
  );
}

function PanelHeader({ icon, title, description, actions }: { icon: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start gap-4 pb-1">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line bg-surface text-xl text-brand">
        <Icon icon={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-2xl font-bold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0">{actions}</div>}
    </div>
  );
}

function NavItem({ icon, label, active, alert, onClick }: { icon: string; label: string; active: boolean; alert?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active || undefined}
      className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition', active ? 'bg-brand/15 text-fg' : 'text-muted hover:bg-line hover:text-fg')}
    >
      <Icon icon={icon} className={cx('shrink-0 text-base', active && 'text-brand')} />
      <span className="flex-1 truncate">{label}</span>
      {alert && <span className="size-2 rounded-full bg-amber-400" />}
    </button>
  );
}

/** Sidebar list of sections: click to edit, drag the grip to reorder, eye to show/hide. */
function SectionList({
  sections,
  selected,
  hasIssue,
  onSelect,
  onMove,
  onToggle,
}: {
  sections: Section[];
  selected: number;
  hasIssue: (index: number) => boolean;
  onSelect: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onToggle: (index: number) => void;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  return (
    <ul className="space-y-0.5">
      {sections.map((section, i) => (
        <li
          key={`${i}-${section.type}`}
          draggable
          onDragStart={(e) => {
            setDragFrom(i);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            if (dragFrom === null) return;
            e.preventDefault();
            setDragOver(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragFrom !== null && dragFrom !== i) onMove(dragFrom, i);
          }}
          onDragEnd={() => {
            setDragFrom(null);
            setDragOver(null);
          }}
          className={cx(
            'group flex items-center rounded-xl border transition',
            dragOver === i && dragFrom !== i ? 'border-brand' : 'border-transparent',
            dragFrom === i && 'opacity-40',
            selected === i ? 'bg-brand/15' : 'hover:bg-line',
          )}
        >
          <span className="grid w-6 shrink-0 cursor-grab place-items-center pl-1 text-faint opacity-0 group-hover:opacity-100" aria-hidden="true">
            <Icon icon="lucide:grip-vertical" />
          </span>
          <button
            type="button"
            onClick={() => onSelect(i)}
            aria-current={selected === i || undefined}
            className={cx('flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pr-1 text-left text-sm', selected === i ? 'text-fg' : 'text-muted', !section.visible && 'opacity-50')}
          >
            <Icon icon={TYPE_INFO[section.type].icon} className={cx('shrink-0', selected === i && 'text-brand')} />
            <span className="truncate">{sectionTitle(section)}</span>
            {hasIssue(i) && <span className="size-2 shrink-0 rounded-full bg-amber-400" />}
          </button>
          <IconButton icon={section.visible ? 'lucide:eye' : 'lucide:eye-off'} label={section.visible ? 'Hide section' : 'Show section'} onClick={() => onToggle(i)} />
        </li>
      ))}
    </ul>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const info = {
    saved: { color: 'bg-emerald-400', text: 'All changes saved' },
    unsaved: { color: 'bg-amber-400', text: 'Unsaved changes' },
    saving: { color: 'bg-brand animate-pulse', text: 'Saving…' },
    error: { color: 'bg-rose-400', text: "Couldn't save" },
  }[state];
  return (
    <span className="flex items-center gap-2 text-xs text-muted">
      <span className={cx('size-2 rounded-full', info.color)} />
      {info.text}
      {state === 'error' && (
        <button type="button" className="text-brand underline" onClick={onRetry}>
          Retry
        </button>
      )}
    </span>
  );
}

function ThemeButton() {
  const [light, setLight] = useState(() => document.documentElement.dataset.theme === 'light');
  return (
    <IconButton
      icon={light ? 'lucide:sun' : 'lucide:moon'}
      label="Toggle colour theme"
      onClick={() => {
        const next = light ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem('theme', next);
        } catch {}
        setLight(!light);
      }}
    />
  );
}
