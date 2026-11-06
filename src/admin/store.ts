import { useCallback, useEffect, useRef, useState } from 'react';
import { contentSchema, type Content } from '../data/schema';
import { supabase } from './supabase';

export type SaveState = 'saved' | 'unsaved' | 'saving' | 'error';

/** Fills schema defaults when valid; otherwise keeps the data as-is so nothing is lost. */
const normalize = (data: unknown) => {
  const parsed = contentSchema.safeParse(data);
  return (parsed.success ? parsed.data : data) as Content;
};

/** The draft document, autosaved to Supabase shortly after each change. */
export function useDraft() {
  const [draft, setDraftState] = useState<Content>();
  const [published, setPublished] = useState<Content>();
  const [loadError, setLoadError] = useState<string>();
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const latest = useRef<Content>(undefined);
  const savedJson = useRef('');
  const timer = useRef<number>(undefined);
  const saving = useRef<Promise<boolean>>(undefined);

  const load = useCallback(async () => {
    setLoadError(undefined);
    const { data, error } = await supabase!.from('site_content').select('id, data');
    if (error) return setLoadError(error.message);
    const rows = Object.fromEntries(data.map((row) => [row.id, normalize(row.data)]));
    // Row-level security hides the draft from anyone who isn't an admin.
    if (!rows.draft) return setLoadError('not-admin');
    latest.current = rows.draft;
    savedJson.current = JSON.stringify(rows.draft);
    setDraftState(rows.draft);
    setPublished(rows.published);
    setSaveState('saved');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timer.current);
    // Never run two writes at once; wait for the current one, then save what's newest.
    while (saving.current) await saving.current;
    const content = latest.current;
    if (!content) return true;
    const json = JSON.stringify(content);
    if (json === savedJson.current) {
      setSaveState('saved');
      return true;
    }
    setSaveState('saving');
    saving.current = (async () => {
      const { data, error } = await supabase!.from('site_content').update({ data: content }).eq('id', 'draft').select('id');
      if (error || !data?.length) {
        setSaveState('error');
        return false;
      }
      savedJson.current = json;
      setSaveState(JSON.stringify(latest.current) === json ? 'saved' : 'unsaved');
      return true;
    })();
    const ok = await saving.current;
    saving.current = undefined;
    return ok;
  }, []);

  const setDraft = useCallback(
    (update: (prev: Content) => Content) => {
      setDraftState((prev) => {
        if (!prev) return prev;
        const next = update(prev);
        latest.current = next;
        return next;
      });
      setSaveState('unsaved');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(save, 900);
    },
    [save],
  );

  return { draft, published, setPublished, loadError, saveState, setDraft, save, reload: load };
}
