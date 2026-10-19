import { useEffect, useMemo, useState } from 'react';
import { Gamepad2, Search, X, ExternalLink, ArrowLeft, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { cn } from '@/lib/utils';

// 3kh0-lite hosts every game file on GitHub Pages and exposes a public
// games.json. This is the practical way to pull in the full archive without
// iframing the main 3kh0 site (which many districts block).
const GAMES_JSON = 'https://raw.githubusercontent.com/DopeSkinnyKid27/3kh0-lite/main/config/games.json';
const BASE_URL = 'https://dopeskinnykid27.github.io/3kh0-lite/';
const CREDIT_URL = 'https://github.com/3kh0/3kh0-Assets';

export default function Games() {
  const [games, setGames] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadGames = () => {
    setGames(null);
    setError('');
    fetch(GAMES_JSON)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const cleaned = (Array.isArray(data) ? data : [])
          .filter((g) => g && g.title && g.link)
          .map((g) => ({
            title: String(g.title).trim(),
            link: String(g.link).trim(),
            img: g.imgSrc ? String(g.imgSrc).trim() : '',
          }));
        setGames(cleaned);
      })
      .catch((e) => setError(e.message || 'Could not load the game list.'));
  };

  useEffect(() => {
    loadGames();
  }, []);

  const filtered = useMemo(() => {
    if (!games) return [];
    const q = search.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) => g.title.toLowerCase().includes(q));
  }, [games, search]);

  const openGame = (game) => {
    setActive({ title: game.title, url: BASE_URL + game.link });
    setLoading(true);
  };

  const closeGame = () => {
    setActive(null);
    setLoading(false);
  };

  // Player overlay
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
            <a
              href={active.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
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
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading {active.title}…</p>
            </div>
          )}
          <iframe
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
            {games
              ? `${games.length} unblocked games for your study breaks.`
              : 'Loading the game library…'}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={CREDIT_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Powered by 3kh0
          </a>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search games…"
          className="pl-9"
          disabled={!games}
        />
      </div>

      {/* Loading */}
      {!games && !error && (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Fetching {`~250`} games from GitHub…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Couldn't load the game library</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadGames}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
            <a
              href="https://lite.3kh0.net"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs text-muted-foreground hover:bg-accent"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open 3kh0 directly
            </a>
          </div>
        </div>
      )}

      {/* Grid */}
      {games && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((game) => (
              <GameCard key={game.link} game={game} onOpen={() => openGame(game)} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No games match "{search}".
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GameCard({ game, onOpen }) {
  const [imgFailed, setImgFailed] = useState(false);
  const imgUrl = game.img ? BASE_URL + game.img : '';

  return (
    <button
      onClick={onOpen}
      className="group overflow-hidden rounded-xl border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {imgUrl && !imgFailed ? (
          <img
            src={imgUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <Gamepad2 className="h-8 w-8 text-primary/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-medium leading-tight">{game.title}</p>
      </div>
    </button>
  );
}
