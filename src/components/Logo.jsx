import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const LS_KEY = 'studysync_quokka';
const CLICK_WINDOW_MS = 1500;

/**
 * StudySync logo — small square tile containing just the mark (cropped from
 * the full logo image), with the wordmark rendered as text next to it.
 *
 * Easter egg: 3 clicks within 1.5s → quokka. 3 more → back.
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

  const tileSize =
    size === 'sm' ? 'h-9 w-9 rounded-lg' :
    size === 'lg' ? 'h-12 w-12 rounded-2xl' :
    'h-10 w-10 rounded-xl';

  const textSize =
    size === 'sm' ? 'text-base' :
    size === 'lg' ? 'text-2xl' :
    'text-lg';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn('flex items-center gap-2.5 select-none focus:outline-none', className)}
      aria-label="StudySync"
      title="StudySync"
    >
      <span
        className={cn(
          'relative shrink-0 overflow-hidden bg-white shadow-md ring-1 ring-inset ring-black/5 dark:ring-white/10',
          tileSize
        )}
      >
        {quokka ? (
          <img src="/quokka.jpg" alt="" className="h-full w-full object-cover" />
        ) : (
          // The logo.png has the icon on top and the "Studysync" wordmark
          // below it. We scale the image up (170%) and align it to the top
          // so only the icon fills the square tile — the wordmark is
          // cropped by the parent's overflow-hidden.
          <img
            src="/logo.png"
            alt=""
            className="absolute left-1/2 top-0 -translate-x-1/2 h-auto w-[170%] max-w-none"
          />
        )}
      </span>
      <span className={cn('font-bold gradient-text', textSize)}>StudySync</span>
    </button>
  );
}
