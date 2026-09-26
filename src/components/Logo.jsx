import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const LS_KEY = 'studysync_quokka';
const CLICK_WINDOW_MS = 1500;

/**
 * StudySync logo. Uses the hand-drawn book + pencil illustration.
 *
 * Easter egg: click three times within 1.5s to swap to a quokka.
 * Three more clicks revert. Persists via localStorage.
 *
 * Dark mode: the illustration is auto-inverted so black strokes stay visible.
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

  const sizeMap = {
    sm: 'h-9',
    md: 'h-14',
    lg: 'h-24',
  };
  const h = sizeMap[size] || sizeMap.md;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn('inline-flex items-center select-none focus:outline-none', className)}
      aria-label="StudySync"
      title="StudySync"
    >
      {quokka ? (
        <span className={cn('grid aspect-square place-items-center overflow-hidden rounded-xl ring-1 ring-inset ring-white/20 shadow-md bg-card', h)}>
          <img src="/quokka.jpg" alt="" className="h-full w-full object-cover" />
        </span>
      ) : (
        <img
          src="/logo.png"
          alt="StudySync"
          className={cn('w-auto object-contain dark:invert', h)}
        />
      )}
    </button>
  );
}
