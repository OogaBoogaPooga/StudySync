import { useEffect, useState } from 'react';

/**
 * Captures the browser's "beforeinstallprompt" event so we can show our own
 * install button at a friendly moment. Also tracks whether the app is
 * currently running in standalone (installed) mode.
 */
export default function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState(null);
  const [installed, setInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    // If we're already in standalone mode, it's installed
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  });

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredEvent(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredEvent) return 'unavailable';
    try {
      await deferredEvent.prompt();
      const choice = await deferredEvent.userChoice;
      setDeferredEvent(null);
      return choice.outcome; // 'accepted' | 'dismissed'
    } catch {
      setDeferredEvent(null);
      return 'error';
    }
  };

  return {
    canInstall: !!deferredEvent && !installed,
    installed,
    promptInstall,
  };
}
