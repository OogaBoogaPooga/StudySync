import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const LS_KEY = 'studysync_quokka';
const CLICK_WINDOW_MS = 1500;

/**
 * StudySync mark. Hand-drawn geometric "S" monogram, single unbroken stroke.
 * Hidden easter egg: click the tile three times within 1.5s to swap the mark
 * for a quokka. Three more clicks revert. Choice persists via localStorage.
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

  const tileSize = size === 'sm' ? 'h-8 w-8 rounded-lg' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-9 w-9 rounded-xl';
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

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
          'relative grid place-items-center overflow-hidden shadow-md ring-1 ring-inset ring-white/20',
          tileSize,
          quokka ? 'bg-card' : 'bg-gradient-to-br from-primary to-primary/75'
        )}
      >
        {quokka ? (
          <img src="/quokka.jpg" alt="" className="h-full w-full object-cover" />
        ) : (
          <Mark className={size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} />
        )}
      </span>
      <span className={cn('font-bold gradient-text', textSize)}>StudySync</span>
    </button>
  );
}

/**
 * The mark: a single unbroken line that traces an "S".
 * Six control points, three bezier segments, 3.5px stroke, round caps.
 * Reads as a letterform at any size, from 16px favicon up to 200px hero.
 */
function Mark({ className }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M22 10.5 C 18 6.5, 10 7, 10 12 C 10 16.5, 22 15, 22 20 C 22 24.5, 14 25.5, 10 21.5"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
