import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const LS_KEY = 'studysync_quokka';
const CLICK_WINDOW_MS = 1500;

/**
 * StudySync logo — small tile with the mark, text to the right.
 *
 * Easter egg: click the tile three times within 1.5s to swap to a quokka.
 * Three more clicks revert. Persists via localStorage.
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
    size === 'sm' ? 'h-8 w-8 rounded-lg' :
    size === 'lg' ? 'h-12 w-12 rounded-2xl' :
    'h-9 w-9 rounded-xl';

  const textSize =
    size === 'sm' ? 'text-base' :
    size === 'lg' ? 'text-2xl' :
    'text-lg';

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
          'relative grid shrink-0 place-items-center overflow-hidden shadow-md ring-1 ring-inset ring-white/20',
          tileSize
        )}
      >
        <img
          src={quokka ? '/quokka.jpg' : '/logo.png'}
          alt=""
          className="h-full w-full object-contain"
        />
      </span>
      <span className={cn('font-bold gradient-text', textSize)}>StudySync</span>
    </button>
  );
}
