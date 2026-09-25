import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const LS_KEY = 'studysync_quokka';
const CLICK_WINDOW_MS = 1500;

/**
 * StudySync logo. Hidden easter egg: click the logo 3 times within 1.5s
 * to swap the Sparkles mark for a quokka. Click 3 more times to swap back.
 * State persists across reloads via localStorage.
 */
export default function Logo({ size = 'md', className }) {
  const [quokka, setQuokka] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
  });
  const clicksRef = useRef([]);

  const handleClick = () => {
    const now = Date.now();
    clicksRef.current = clicksRef.current.filter((t) => now - t < CLICK_WINDOW_MS);
    clicksRef.current.push(now);
    if (clicksRef.current.length >= 3) {
      clicksRef.current = [];
      const next = !quokka;
      setQuokka(next);
      try { localStorage.setItem(LS_KEY, next ? '1' : '0'); } catch {}
    }
  };

  const box = size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl';
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const text = size === 'sm' ? 'text-base' : 'text-lg';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn('flex items-center gap-2 select-none focus:outline-none', className)}
      aria-label="StudySync"
      title="StudySync"
    >
      <span
        className={cn(
          'grid place-items-center shadow-md overflow-hidden',
          box,
          quokka ? 'bg-card' : 'bg-gradient-to-br from-slate-700 to-slate-500 text-white'
        )}
      >
        {quokka ? (
          <img src="/quokka.jpg" alt="" className="h-full w-full object-cover" />
        ) : (
          <Sparkles className={icon} />
        )}
      </span>
      <span className={cn('font-bold gradient-text', text)}>StudySync</span>
    </button>
  );
}
