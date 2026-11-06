import { Icon } from '@iconify/react';
import { createContext, useContext, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { replaceAt } from './content';

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

/** Location of a value in the content document, e.g. ['sections', 2, 'heading']. */
export type Path = (string | number)[];

/** Validation messages keyed by path ("sections.2.heading"), so fields can show their own error. */
export const IssuesContext = createContext<Map<string, string>>(new Map());
const useIssue = (path?: Path) => {
  const issues = useContext(IssuesContext);
  return path ? issues.get(path.join('.')) : undefined;
};

export const inputClass =
  'w-full rounded-xl border border-line bg-bg/60 px-3.5 py-2.5 text-sm text-fg outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20';

/** Error for a value without its own labelled Field (e.g. inputs inside list rows). */
export function ErrorText({ path }: { path: Path }) {
  const error = useIssue(path);
  return error ? <p className="col-span-full flex items-center gap-1 text-xs text-rose-400"><Icon icon="lucide:circle-alert" /> {error}</p> : null;
}

export function Field({
  label,
  hint,
  path,
  group = false,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  path?: Path;
  /** Use for composite controls (several buttons/inputs) that shouldn't be wrapped in a <label>. */
  group?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const error = useIssue(path);
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className={cx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 flex items-center gap-1 text-xs text-rose-400">
          <Icon icon="lucide:circle-alert" /> {error}
        </span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-faint">{hint}</span>
      )}
    </Tag>
  );
}

type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string | undefined;
  onChange: (value: string) => void;
};

export function TextInput({ value, onChange, className, ...rest }: TextInputProps) {
  return <input className={cx(inputClass, className)} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string | undefined;
  onChange: (value: string) => void;
};

export function TextArea({ value, onChange, className, ...rest }: TextAreaProps) {
  return (
    <textarea
      className={cx(inputClass, 'field-sizing-content min-h-24 resize-y leading-relaxed', className)}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors',
          checked ? 'border-brand bg-brand' : 'border-line-strong bg-bg/60',
        )}
      >
        <span className={cx('absolute top-0.5 left-0.5 size-[18px] rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-faint">{hint}</span>}
      </span>
    </label>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  tone = 'default',
  active = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'grid size-8 place-items-center rounded-lg text-base transition disabled:pointer-events-none disabled:opacity-25',
        tone === 'danger' ? 'text-faint hover:bg-rose-500/10 hover:text-rose-400' : 'text-faint hover:bg-line hover:text-fg',
        active && 'text-brand',
      )}
    >
      <Icon icon={icon} />
    </button>
  );
}

export function Card({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 md:p-6">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Chips with free-text entry: Enter or comma adds, Backspace on empty removes the last. */
export function TagInput({ value, onChange, placeholder = 'Type and press Enter' }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState('');
  const add = () => {
    const tag = text.trim().replace(/,$/, '');
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setText('');
  };
  return (
    <div className={cx(inputClass, 'flex flex-wrap items-center gap-1.5 py-2')}>
      {value.map((tag, i) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-strong py-0.5 pr-1 pl-2.5 text-xs">
          {tag}
          <button type="button" aria-label={`Remove ${tag}`} className="grid size-4 place-items-center rounded-full text-faint hover:text-fg" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <Icon icon="lucide:x" />
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={value.length ? '' : placeholder}
        className="min-w-28 flex-1 bg-transparent py-0.5 outline-none placeholder:text-faint"
      />
    </div>
  );
}

type SortableListProps<T> = {
  items: T[];
  onChange: (items: T[]) => void;
  itemKey: (item: T, index: number) => string;
  /** Short name for the row header and delete confirmation. */
  itemLabel: (item: T, index: number) => string;
  renderItem: (item: T, update: (next: T) => void, index: number) => ReactNode;
  /** Collapsible rows show the label (plus this) and expand to the editor. */
  collapsible?: boolean;
  renderSummary?: (item: T) => ReactNode;
  /** New item; NoInfer keeps the list's type coming from `items`, not from this template. */
  onAdd?: () => NoInfer<T>;
  addLabel?: string;
  confirmRemove?: boolean;
  empty?: string;
};

/** A list with drag-to-reorder (by the grip), up/down buttons and delete. */
export function SortableList<T>({
  items,
  onChange,
  itemKey,
  itemLabel,
  renderItem,
  collapsible = false,
  renderSummary,
  onAdd,
  addLabel = 'Add',
  confirmRemove = false,
  empty,
}: SortableListProps<T>) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  // Only the row whose grip is held is draggable, so text in inputs stays selectable.
  const [armed, setArmed] = useState<number | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const remove = (i: number) => {
    if (confirmRemove && !window.confirm(`Delete “${itemLabel(items[i], i)}”?`)) return;
    onChange(items.filter((_, j) => j !== i));
  };
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-2">
      {items.length === 0 && empty && (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-faint">{empty}</p>
      )}
      {items.map((item, i) => {
        const key = itemKey(item, i);
        const isOpen = !collapsible || open.has(key);
        const update = (next: T) => onChange(replaceAt(items, i, next));
        return (
          <div
            key={key}
            draggable={armed === i}
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
              if (dragFrom !== null) move(dragFrom, i);
            }}
            onDragEnd={() => {
              setDragFrom(null);
              setDragOver(null);
              setArmed(null);
            }}
            className={cx(
              'rounded-xl border bg-bg/40 transition-colors',
              dragOver === i && dragFrom !== i ? 'border-brand' : 'border-line',
              dragFrom === i && 'opacity-40',
            )}
          >
            <div className="flex items-start gap-1.5 p-2">
              <button
                type="button"
                aria-label="Drag to reorder"
                className="mt-1 grid size-8 shrink-0 cursor-grab place-items-center rounded-lg text-faint hover:text-fg active:cursor-grabbing"
                onPointerDown={() => setArmed(i)}
                onPointerUp={() => setArmed(null)}
              >
                <Icon icon="lucide:grip-vertical" />
              </button>
              {collapsible ? (
                <button type="button" className="flex min-h-10 min-w-0 flex-1 items-center gap-3 text-left" onClick={() => toggle(key)} aria-expanded={isOpen}>
                  {renderSummary?.(item)}
                  <span className="truncate text-sm font-medium">{itemLabel(item, i)}</span>
                  <Icon icon="lucide:chevron-down" className={cx('ml-auto shrink-0 text-faint transition-transform', isOpen && 'rotate-180')} />
                </button>
              ) : (
                <div className="min-w-0 flex-1">{renderItem(item, update, i)}</div>
              )}
              <div className="mt-1 flex shrink-0">
                <IconButton icon="lucide:arrow-up" label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)} />
                <IconButton icon="lucide:arrow-down" label="Move down" disabled={i === items.length - 1} onClick={() => move(i, i + 1)} />
                <IconButton icon="lucide:trash-2" label="Delete" tone="danger" onClick={() => remove(i)} />
              </div>
            </div>
            {collapsible && isOpen && <div className="space-y-5 border-t border-line p-4 md:p-5">{renderItem(item, update, i)}</div>}
          </div>
        );
      })}
      {onAdd && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const item = onAdd();
            onChange([...items, item]);
            if (collapsible) setOpen((current) => new Set(current).add(itemKey(item, items.length)));
          }}
        >
          <Icon icon="lucide:plus" /> {addLabel}
        </button>
      )}
    </div>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <div className="grid min-h-svh place-items-center p-4">{children}</div>;
}

export function Spinner() {
  return <Icon icon="lucide:loader-circle" className="animate-spin text-3xl text-brand" aria-label="Loading" />;
}
