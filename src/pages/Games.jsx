import { useMemo, useState, useRef, useEffect } from 'react';
import { Gamepad2, Search, X, ExternalLink, ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import GAMES_DATA from '@/lib/games.json';

const PLAY_BASE = '/play/';

function getGradient(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 60%, 45%), hsl(${(hue + 45) % 360}, 60%, 25%))`;
}

function getInitials(title) {
  const words = title.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return title.substring(0, 2).toUpperCase();
}

export default function Games() {
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return GAMES_DATA;
    return GAMES_DATA.filter((g) => g.title.toLowerCase().includes(q));
  }, [search]);

  const openGame = (game) => {
    setActive({ title: game.title, url: `${PLAY_BASE}${game.slug}/index.html` });
    setLoading(true);
  };

  const closeGame = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    setActive(null);
    setLoading(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      iframeRef.current?.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  if (active) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col bg-background">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <Button variant="ghost" size="sm" onClick={closeGame}>
            <ArrowLeft className="h-4 w-4" />
            Back to arcade
          </Button>
          <p className="min-w-0 truncate text-sm font-medium">{active.title}</p>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} title="Fullscreen">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <a
              href={active.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              New tab
            </a>
            <Button variant="ghost" size="icon" onClick={closeGame} aria-label="Close game">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="relative flex-1 bg-black">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading {active.title}…</p>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={active.url}
            title={active.title}
            className="h-full w-full border-0"
            allow="fullscreen; autoplay; gamepad; clipboard-write; accelerometer; gyroscope"
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Gamepad2 className="h-7 w-7 text-primary" />
            Arcade
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {GAMES_DATA.length} unblocked games for your study breaks.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search games…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((game) => (
          <GameCard key={game.slug} game={game} onOpen={() => openGame(game)} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">No games match "{search}".</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GameCard({ game, onOpen }) {
  const [imgError, setImgError] = useState(false);
  const gradient = getGradient(game.title);
  const initials = getInitials(game.title);

  const thumbUrl = game.thumbnail
    ? `${PLAY_BASE}${game.thumbnail}`
    : `${PLAY_BASE}${game.slug}/thumb.png`;

  return (
    <button
      onClick={onOpen}
      className="group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
    >
      <div
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden transition-all"
        style={{ background: gradient }}
      >
        {!imgError ? (
          <img
            src={thumbUrl}
            alt={game.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <>
            <span className="absolute text-6xl font-black text-white/20 select-none">
              {initials}
            </span>
            <Gamepad2 className="absolute bottom-2 right-2 h-5 w-5 text-white/40" />
          </>
        )}
      </div>
      <div className="p-3 bg-card border-t border-border/50">
        <p className="truncate text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
          {game.title}
        </p>
      </div>
    </button>
  );
}
