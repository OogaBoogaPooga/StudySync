import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Timer, BookOpen, GraduationCap, Users, Moon, Sun, Contrast, LogOut, Sparkles } from 'lucide-react';
import { useApp } from '@/lib/store.jsx';
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

export default function Layout() {
  const { user, logout, isDark, toggleDark, contrast, toggleContrast } = useApp();

  const link = ({ isActive }) =>
    cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground');

  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="skip-link">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col border-r bg-card/60 backdrop-blur sticky top-0 h-screen no-print">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md"><Sparkles className="h-5 w-5" /></div>
          <span className="text-lg font-bold gradient-text">StudySync</span>
        </div>
        <nav aria-label="Main" className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={link}><Icon className="h-4 w-4" aria-hidden />{label}</NavLink>
          ))}
        </nav>
        <div className="border-t p-3 space-y-2">
          <div className="px-2 text-xs text-muted-foreground truncate">Signed in as <span className="font-medium text-foreground">{user?.name}</span></div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={toggleDark} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} title="Toggle dark mode">{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <Button variant="ghost" size="icon" onClick={toggleContrast} aria-pressed={contrast} aria-label="Toggle high contrast" title="High contrast"><Contrast className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out" title="Log out" className="ml-auto"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b glass px-4 py-3 no-print">
        <span className="font-bold gradient-text">StudySync</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle dark mode">{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <main id="main" className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-6xl w-full mx-auto animate-fade-in">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav aria-label="Main mobile" className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-6 border-t glass no-print">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[10px]', isActive ? 'text-primary' : 'text-muted-foreground')}>
            <Icon className="h-5 w-5" aria-hidden />{label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
