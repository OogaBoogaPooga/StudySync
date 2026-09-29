import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Timer, BookOpen, GraduationCap, Users, Moon, Sun, Contrast, LogOut, Music2, VolumeX, HelpCircle, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useApp } from '@/lib/store.jsx';
import { useMusic } from '@/lib/music.jsx';
import NotesChat from './NotesChat.jsx';
import Logo from './Logo.jsx';
import Tour from './Tour.jsx';
import SettingsDialog from './SettingsDialog.jsx';
import { Button } from './ui/button.jsx';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/focus', label: 'Focus', icon: Timer },
  { to: '/notes', label: 'Notes', icon: BookOpen },
  { to: '/grades', label: 'Grades', icon: GraduationCap },
  { to: '/rooms', label: 'Rooms', icon: Users },
];

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
      {m.enabled ? <Music2 className="h-[18px] w-[18px]" /> : <VolumeX className="h-[18px] w-[18px]" />}
    </Button>
  );
}

export default function Layout() {
  const { user, logout, isDark, toggleDark, contrast, toggleContrast, sidebarOpen, toggleSidebar } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const link = ({ isActive }) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] font-medium transition-colors',
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    );

  const linkCompact = ({ isActive }) =>
    cn(
      'flex items-center justify-center rounded-lg p-2.5 transition-colors',
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    );

  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="skip-link">Skip to content</a>

      <aside
        className={cn(
          'hidden md:flex md:flex-col border-r bg-card/60 backdrop-blur sticky top-0 h-screen no-print transition-[width] duration-200',
          sidebarOpen ? 'md:w-64' : 'md:w-16'
        )}
      >
        <div className={cn('flex items-center py-6', sidebarOpen ? 'justify-between px-5' : 'flex-col gap-3 px-2')}>
          {sidebarOpen ? (
            <>
              <Logo />
              <button
                onClick={toggleSidebar}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-[18px] w-[18px]" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={toggleSidebar}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="h-[18px] w-[18px]" />
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('studysync:startTour'))}
                className="block"
                aria-label="StudySync"
              >
                <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
              </button>
            </>
          )}
        </div>

        <nav aria-label="Main" className={cn('flex-1 space-y-1', sidebarOpen ? 'px-3' : 'px-2')}>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={sidebarOpen ? link : linkCompact}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={cn('border-t space-y-2.5', sidebarOpen ? 'p-3' : 'p-2')}>
          {sidebarOpen ? (
            <>
              <div className="px-2 text-[13px] text-muted-foreground truncate">
                Signed in as <span className="font-medium text-foreground">{user?.name}</span>
              </div>
              <div className="flex gap-1">
                <MusicToggleButton />
                <Button variant="ghost" size="icon" onClick={toggleDark} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} title="Toggle dark mode">
                  {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleContrast} aria-pressed={contrast} aria-label="Toggle high contrast" title="High contrast">
                  <Contrast className="h-[18px] w-[18px]" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => window.dispatchEvent(new CustomEvent('studysync:startTour'))} aria-label="Take a tour" title="Take a tour">
                  <HelpCircle className="h-[18px] w-[18px]" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
                  <Settings className="h-[18px] w-[18px]" />
                </Button>
                <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out" title="Log out" className="ml-auto">
                  <LogOut className="h-[18px] w-[18px]" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <MusicToggleButton />
              <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle dark mode" title="Toggle dark mode" className="mx-auto">
                {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings" className="mx-auto">
                <Settings className="h-[18px] w-[18px]" />
              </Button>
              <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out" title="Log out" className="mx-auto">
                <LogOut className="h-[18px] w-[18px]" />
              </Button>
            </div>
          )}
        </div>
      </aside>

      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b glass px-4 py-3 no-print">
        <Logo size="sm" />
        <div className="flex gap-1">
          <MusicToggleButton />
          <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle dark mode">
            {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => window.dispatchEvent(new CustomEvent('studysync:startTour'))} aria-label="Take a tour">
            <HelpCircle className="h-[18px] w-[18px]" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            <Settings className="h-[18px] w-[18px]" />
          </Button>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out">
            <LogOut className="h-[18px] w-[18px]" />
          </Button>
        </div>
      </header>

      <main id="main" className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-6xl w-full mx-auto animate-fade-in">
        <Outlet />
      </main>

      <nav aria-label="Main mobile" className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-6 border-t glass no-print">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[10px]', isActive ? 'text-primary' : 'text-muted-foreground')}>
            <Icon className="h-5 w-5" aria-hidden />{label}
          </NavLink>
        ))}
      </nav>

      <NotesChat />
      <Tour />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
