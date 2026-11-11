import { Icon } from '@iconify/react';
import { useEffect, useRef, useState } from 'react';
import type { ImageRef, Link } from '../data/schema';
import { newLink } from './content';
import { uploadImage, uploadPdf } from './supabase';
import { Field, IconButton, SortableList, TextArea, TextInput, cx, inputClass, type Path } from './ui';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

/** Upload (or drop) an image; it's resized in the browser before uploading. */
export function ImageInput({
  value,
  onChange,
  folder = 'images',
  aspect = 'aspect-video max-w-md',
}: {
  value: ImageRef | undefined;
  onChange: (value: ImageRef | undefined) => void;
  folder?: string;
  aspect?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('That file is not an image.');
    setBusy(true);
    setError(undefined);
    try {
      const { url, width, height } = await uploadImage(file, folder);
      onChange({ url, width, height, alt: value?.alt ?? '' });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files[0]);
        }}
        className={cx(
          'group relative block w-full overflow-hidden rounded-xl border border-dashed bg-bg/40 transition',
          aspect,
          dragging ? 'border-brand bg-brand/10' : 'border-line-strong hover:border-brand',
        )}
      >
        {value ? (
          <img src={value.url} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center p-4 text-center text-sm text-faint">
            <span>
              <Icon icon="lucide:image-up" className="mx-auto mb-2 text-2xl" />
              Click or drop an image
            </span>
          </span>
        )}
        {value && !busy && (
          <span className="absolute inset-0 grid place-items-center bg-bg/60 text-sm font-medium opacity-0 transition group-hover:opacity-100">
            Replace image
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-bg/75 text-sm">
            <Icon icon="lucide:loader-circle" className="animate-spin text-2xl text-brand" />
          </span>
        )}
      </button>
      {value && (
        <div className="flex max-w-md items-center gap-2">
          <TextInput value={value.alt} onChange={(alt) => onChange({ ...value, alt })} placeholder="Describe the image for screen readers" />
          <IconButton icon="lucide:trash-2" label="Remove image" tone="danger" onClick={() => onChange(undefined)} />
        </div>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        hidden
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function PdfInput({ value, onChange }: { value: string | undefined; onChange: (url: string | undefined) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      onChange(await uploadPdf(file, 'resume'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => fileInput.current?.click()}>
          <Icon icon={busy ? 'lucide:loader-circle' : 'lucide:file-up'} className={cx(busy && 'animate-spin')} />
          {value ? 'Upload a new PDF' : 'Upload PDF'}
        </button>
        {value && (
          <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline">
            <Icon icon="lucide:file-text" /> Current resume
          </a>
        )}
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** Iconify name with a searchable picker (Lucide and Simple Icons, the sets the site can render). */
export function IconInput({ value, onChange, required = false }: { value: string | undefined; onChange: (v: string | undefined) => void; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) return setResults([]);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.iconify.design/search?query=${encodeURIComponent(query.trim())}&prefixes=lucide,simple-icons&limit=64`,
          { signal: controller.signal },
        );
        setResults(((await res.json()) as { icons?: string[] }).icons ?? []);
      } catch {}
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  return (
    <div ref={root} className="relative">
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Choose icon"
          onClick={() => setOpen(!open)}
          className="grid size-[42px] shrink-0 place-items-center rounded-xl border border-line bg-bg/60 text-lg transition hover:border-brand"
        >
          {value ? <Icon icon={value} /> : <Icon icon="lucide:smile-plus" className="text-faint" />}
        </button>
        <input
          className={inputClass}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value.trim() || (required ? '' : undefined))}
          placeholder="lucide:brain"
          spellCheck={false}
        />
      </div>
      {open && (
        <div className="absolute left-0 z-40 mt-2 w-80 rounded-2xl border border-line bg-surface-strong p-3 shadow-2xl">
          <input autoFocus className={inputClass} placeholder="Search icons: react, mail, brain…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="mt-3 grid max-h-64 grid-cols-7 gap-1 overflow-y-auto">
            {results.map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className={cx('grid aspect-square place-items-center rounded-lg text-xl transition hover:bg-line', name === value && 'bg-brand/15 text-brand')}
              >
                <Icon icon={name} />
              </button>
            ))}
          </div>
          {query.trim().length >= 2 && !results.length && <p className="py-4 text-center text-xs text-faint">No icons found</p>}
          {!required && value && (
            <button type="button" className="mt-2 text-xs text-faint hover:text-rose-400" onClick={() => onChange(undefined)}>
              Remove icon
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function MarkdownInput({ value, onChange, rows = 4 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return <TextArea value={value} onChange={onChange} rows={rows} placeholder="Write here…" />;
}

export const markdownHint = (
  <>
    Supports <code>**bold**</code>, <code>*italic*</code> and <code>[links](https://…)</code>. Leave an empty line between paragraphs.
  </>
);

/** Buttons/links: label, URL, optional icon, and primary or secondary style. */
export function LinkList({ value, onChange, path, addLabel = 'Add button' }: { value: Link[]; onChange: (v: Link[]) => void; path: Path; addLabel?: string }) {
  return (
    <SortableList
      items={value}
      onChange={onChange}
      itemKey={(_, i) => String(i)}
      itemLabel={(link) => link.label}
      onAdd={newLink}
      addLabel={addLabel}
      empty="No buttons yet."
      renderItem={(link, update, i) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Label" path={[...path, i, 'label']}>
            <TextInput value={link.label} onChange={(label) => update({ ...link, label })} />
          </Field>
          <Field label="Link to" path={[...path, i, 'href']} hint="https://…, mailto:…, tel:…, #section or /resume.pdf">
            <TextInput value={link.href} onChange={(href) => update({ ...link, href })} spellCheck={false} />
          </Field>
          <Field label="Icon" group>
            <IconInput value={link.icon} onChange={(icon) => update({ ...link, icon })} />
          </Field>
          <Field label="Style">
            <select className={inputClass} value={link.variant} onChange={(e) => update({ ...link, variant: e.target.value as Link['variant'] })}>
              <option value="primary">Primary (filled)</option>
              <option value="secondary">Secondary (outline)</option>
            </select>
          </Field>
        </div>
      )}
    />
  );
}
