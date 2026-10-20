import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, Timer, BookOpen, GraduationCap,
  Users, Moon, Sun, Contrast, LogOut, Music2, VolumeX, HelpCircle,
  Settings, PanelLeftClose, PanelLeftOpen, Gamepad2,
} from 'lucide-react';
import { useApp } from '@/lib/store.jsx';
import { useMusic } from '@/lib/music.jsx';
import NotesChat from './NotesChat.jsx';
import Logo from './Logo.jsx';
import Tour from './Tour.jsx';
import SettingsDialog from './SettingsDialog.jsx';
import { Button } from './ui/button.jsx';
import { cn } from '@/lib/utils';

const BASE_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/focus', label: 'Focus', icon: Timer },
  { to: '/notes', label: 'Notes', icon: BookOpen },
  { to: '/grades', label: 'Grades', icon: GraduationCap },
  { to: '/rooms', label: 'Rooms', icon: Users },
];

const RECESS_NAV = { to: '/recess', label: 'Recess', icon: Gamepad2 };

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
  const { user, logout, isDark, toggleDark, contrast, toggleContrast, sidebarOpen, toggleSidebar } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const gamesUnlocked = useGamesUnlocked();
  const NAV = gamesUnlocked ? [...BASE_NAV, RECESS_NAV] : BASE_NAV;

  const link = ({ isActive }) => cn(
    'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] font-medium transition-colors',
    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  );
  const linkCompact = ({ isActive }) => cn(
    'flex items-center justify-center rounded-lg p-2.5 transition-colors',
    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a href="#main" className="sr-only">Skip to content</a>
      {/* ... keep the rest of your Layout JSX exactly as it is ... */}
      {/* Just make sure the nav map uses the NAV variable above. */}
    </div>
  );
}
