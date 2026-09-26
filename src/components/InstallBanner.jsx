import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import useInstallPrompt from '@/lib/useInstallPrompt';
import { Button } from '@/components/ui/button.jsx';

const DISMISS_KEY = 'studysync_install_dismissed';

/**
 * Small floating banner that appears when the browser says the app is
 * installable. Dismisses permanently if the user clicks the X.
 */
export default function InstallBanner() {
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (installed) return;
    // Re-check the dismissal flag when the tab regains focus, in case
    // another tab dismissed it.
    const onFocus = () => {
      try { setDismissed(localStorage.getItem(DISMISS_KEY) === '1'); } catch {}
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [installed]);

  if (installed || !canInstall || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  const install = async () => {
    setBusy(true);
    try {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        // Nothing to do — the app installs itself. Banner disappears
        // automatically once `installed` flips true.
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[360px] z-[190] flex items-center gap-3 rounded-xl border border-border/60 bg-card/95 px-3 py-2.5 shadow-2xl backdrop-blur animate-fade-in">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10">
        <Download className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">Install StudySync</p>
        <p className="truncate text-[11px] text-muted-foreground">
          Run it as an app with its own window.
        </p>
      </div>
      <Button size="sm" variant="gradient" onClick={install} disabled={busy}>
        {busy ? 'Installing…' : 'Install'}
      </Button>
      <button
        onClick={dismiss}
        className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Dismiss install prompt"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
