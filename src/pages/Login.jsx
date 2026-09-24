import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useApp } from '@/lib/store.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input, Label } from '@/components/ui/input.jsx';

export default function Login() {
  const { user, login, register } = useApp();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: 'demo@studysync.app', password: 'password123' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-stone-100 via-stone-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-2xl animate-fade-in">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-500 text-white shadow-lg"><Sparkles /></div>
          <h1 className="mt-3 text-2xl font-bold gradient-text">StudySync</h1>
          <p className="text-sm text-muted-foreground">Your calm, collaborative study companion</p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm" role="tablist">
          {['login', 'register'].map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-md py-1.5 font-medium capitalize transition ${mode === m ? 'bg-card shadow' : 'text-muted-foreground'}`}>{m === 'login' ? 'Sign in' : 'Create account'}</button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          )}
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={8} autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="gradient" className="w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">Demo: demo@studysync.app / password123</p>
      </div>
    </div>
  );
}
