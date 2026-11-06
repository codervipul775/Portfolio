import { Icon } from '@iconify/react';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Editor } from './Editor';
import { supabase } from './supabase';
import { Centered, Spinner, inputClass } from './ui';

export default function AdminApp() {
  if (!supabase) {
    return (
      <Centered>
        <p className="max-w-md text-center text-muted">
          Supabase isn't configured. Set <code>PUBLIC_SUPABASE_URL</code> and <code>PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, then rebuild.
        </p>
      </Centered>
    );
  }
  return <AuthGate />;
}

function AuthGate() {
  // undefined while the stored session is being read, null when signed out.
  const [session, setSession] = useState<Session | null>();

  useEffect(() => {
    supabase!.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase!.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <Centered><Spinner /></Centered>;
  return session ? <Editor key={session.user.id} email={session.user.email} /> : <Login />;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) setError(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
    setBusy(false);
  };

  return (
    <Centered>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="w-full max-w-sm rounded-3xl border border-line bg-surface p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <span className="text-gradient text-4xl font-bold">VY</span>
          <h1 className="mt-3 text-xl font-semibold">Portfolio admin</h1>
          <p className="mt-1 text-sm text-muted">Sign in to edit your site.</p>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Email</span>
          <input className={inputClass} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium">Password</span>
          <input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && (
          <p className="mt-4 flex items-center gap-1.5 text-sm text-rose-400" role="alert">
            <Icon icon="lucide:circle-alert" /> {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary mt-6 w-full justify-center" disabled={busy}>
          {busy ? <Icon icon="lucide:loader-circle" className="animate-spin" /> : <Icon icon="lucide:log-in" />}
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </Centered>
  );
}
