import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, Timer, BookOpen, GraduationCap,
  Users, Moon, Sun, Contrast, LogOut, Music2, VolumeX,
  PanelLeftClose, PanelLeftOpen, Settings, X, Gamepad2,
} from 'lucide-react';
import { useApp } from '@/lib/store.jsx';
import { useMusic } from '@/lib/music.jsx';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';
import Logo from '@/components/Logo.jsx';
import Tour from '@/components/Tour.jsx';
import SettingsDialog from '@/components/SettingsDialog.jsx';
import NotesChat from '@/components/NotesChat.jsx';
import MusicPlayer from '@/components/MusicPlayer.jsx';
import TimerBadge from '@/components/TimerBadge.jsx';
import InstallBanner from '@/components/InstallBanner.jsx';

const BASE_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/focus', label: 'Focus', icon: Timer },
  { to: '/notes', label: 'Notes', icon: BookOpen },
  { to: '/grades', label: 'Grades', icon: GraduationCap },
  { to: '/rooms', label: 'Rooms', icon: Users },
];

const RECESS_NAV = { to: '/study', label: 'Games', icon: Gamepad2 };

function useGamesUnlocked() {
  const [unlocked, setUnlocked] = useState(
    () => localStorage.getItem('studysync_games_unlocked') === 'true'
  );
  useEffect(() => {
    const check = () =>
      setUnlocked(localStorage.getItem('studysync_games_unlocked') === 'true');
    window.addEventListener('studysync:gamesUnlocked', check);
    window.addEventListener('storage', check);
    return () => {
      window.removeEventListener('studysync:gamesUnlocked', check);
      window.removeEventListener('storage', check);
    };
  }, []);
  return unlocked;
}

function MusicToggleButton() {
  const m = useMusic();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => m.setMasterEnabled(!m.enabled)}
      aria-label={m.enabled ? 'Turn music off' : 'Turn music on'}
      title={m.enabled ? 'Turn music off' : 'Turn music on'}
    >
      {m.enabled ? <Music2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </Button>
  );
}

export default function Layout() {
  const {
    user, logout, isDark, toggleDark, contrast, toggleContrast,
    sidebarOpen, toggleSidebar,
  } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const gamesUnlocked = useGamesUnlocked();

  const NAV = gamesUnlocked ? [...BASE_NAV, RECESS_NAV] : BASE_NAV;

  const linkClass = ({ isActive }) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] font-medium transition-colors',
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    );

  const iconLinkClass = ({ isActive }) =>
    cn(
      'flex items-center justify-center rounded-lg p-2.5 transition-colors',
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    );

  const SidebarInner = ({ compact = false, onNavigate }) => (
    <>
      <div className={cn('flex items-center border-b px-4 py-4', compact ? 'justify-center' : 'justify-between')}>
        {/* Logo.jsx already contains the text "StudySync", so we don't repeat it here */}
        <NavLink to="/" onClick={onNavigate}>
          <Logo size={compact ? 'sm' : 'md'} />
        </NavLink>
        {!compact && (
          <Button variant="ghost" size="icon" onClick={toggleSidebar} title="Collapse sidebar" className="hidden md:inline-flex">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      <nav className={cn('flex-1 space-y-1 overflow-y-auto p-2', compact && 'px-1')}>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} className={compact ? iconLinkClass : linkClass} title={compact ? label : undefined}>
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {!compact && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={cn('border-t p-2 space-y-1', compact && 'flex flex-col items-center')}>
        <div className={cn('flex items-center gap-1 px-1', compact && 'flex-col')}>
          {!compact && (
            <div className="flex-1 min-w-0 px-2">
              <p className="truncate text-sm font-medium">{user?.name || 'Student'}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          )}
          <MusicToggleButton />
          <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle dark mode" title={isDark ? 'Light mode' : 'Dark mode'}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleContrast} aria-label="Toggle contrast" title={contrast ? 'Normal contrast' : 'High contrast'}>
            <Contrast className="h-4 w-4" />
          </Button>
          {!compact && (
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => { logout(); onNavigate?.(); }} aria-label="Log out" title="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a href="#main" className="sr-only">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className={cn('hidden md:flex flex-col border-r bg-card transition-[width] duration-200', sidebarOpen ? 'w-64' : 'w-16')}>
        <SidebarInner compact={!sidebarOpen} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col border-r bg-card shadow-xl">
            <div className="absolute right-2 top-2">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SidebarInner onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
          <NavLink to="/">
            <Logo size="sm" />
          </NavLink>
        </header>

        <main id="main" className="flex-1 overflow-y-auto pb-28">
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      <MusicPlayer />
      <TimerBadge />
      <InstallBanner />
      <Tour />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <NotesChat />
    </div>
  );
}
