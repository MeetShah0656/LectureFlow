'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  BookOpen,
  Settings,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

// ─── Nav Items ────────────────────────────────────────────────────────────────

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  shortName: string;
}

const navItems: NavItem[] = [
  { name: 'Dashboard',  href: '/dashboard',            icon: LayoutDashboard, shortName: 'Home'      },
  { name: 'Attendance', href: '/dashboard/attendance', icon: CheckSquare,     shortName: 'Track'     },
  { name: 'Timetable',  href: '/dashboard/timetable',  icon: CalendarDays,    shortName: 'Schedule'  },
  { name: 'Syllabus',   href: '/dashboard/syllabus',   icon: BookOpen,        shortName: 'Syllabus'  },
  { name: 'Settings',   href: '/dashboard/settings',   icon: Settings,        shortName: 'Settings'  },
];

// ─── Page Title Map ───────────────────────────────────────────────────────────

const pageTitles: Record<string, string> = {
  '/dashboard':            'Overview',
  '/dashboard/attendance': 'Attendance',
  '/dashboard/timetable':  'Timetable',
  '/dashboard/syllabus':   'Syllabus',
  '/dashboard/settings':   'Settings',
};

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [userInitials, setUserInitials] = React.useState('S');
  const [userEmail,    setUserEmail]    = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  React.useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        const name = user.user_metadata?.full_name || user.email;
        setUserInitials(
          name.split(' ').slice(0, 2).map((n: string) => n[0]?.toUpperCase()).join('') || 'S'
        );
      }
    }
    getUser();
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.push('/auth/login');
    }
  };

  const pageTitle = pageTitles[pathname] ?? 'LectureFlow';

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* ── Desktop Sidebar ───────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-sidebar-border bg-sidebar sticky top-0 h-screen">
        {/* Logo */}
        <div className="flex items-center space-x-2.5 px-5 py-5 border-b border-sidebar-border select-none">
          <div className="flex items-center justify-center h-8 w-8 bg-primary rounded-xl text-primary-foreground shadow-sm shadow-primary/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">
            LectureFlow
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon   = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => router.push(item.href)}
                className={cn(
                  'sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer select-none group',
                  active
                    ? 'active bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0 transition-transform group-hover:scale-105', active && 'text-primary')} />
                <span className="flex-1 text-left">{item.name}</span>
                {active && <ChevronRight className="h-3 w-3 text-primary/60" />}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="px-3 py-3 border-t border-sidebar-border space-y-3">
          {/* User info */}
          <div className="flex items-center space-x-3 px-2 py-1.5">
            <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-primary">{userInitials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground/90 truncate">{userEmail ?? 'Loading…'}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Student</p>
            </div>
          </div>

          {/* Theme + Sign out */}
          <div className="flex items-center justify-between px-1">
            {mounted && <ThemeToggler theme={theme} setTheme={setTheme} />}
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/70 bg-background/90 backdrop-blur-lg px-4 md:px-6 shrink-0">
          {/* Mobile: logo + title */}
          <div className="flex items-center space-x-3 md:hidden">
            <div className="flex items-center justify-center h-7 w-7 bg-primary rounded-lg text-primary-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <h1 className="text-sm font-bold tracking-tight">{pageTitle}</h1>
          </div>

          {/* Desktop: breadcrumb */}
          <div className="hidden md:flex items-center space-x-2 text-sm">
            <span className="text-muted-foreground text-xs font-medium">LectureFlow</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            <span className="font-semibold text-sm">{pageTitle}</span>
          </div>

          {/* Right side: theme + user avatar */}
          <div className="flex items-center space-x-2">
            {/* Theme toggle — compact for header */}
            {mounted && (
              <div className="hidden md:flex">
                <ThemeToggler theme={theme} setTheme={setTheme} />
              </div>
            )}
            {/* User avatar */}
            <div className="h-8 w-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-colors">
              <span className="text-xs font-bold text-primary">{userInitials}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto page-content-mobile-pb">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Tab Bar ─────────────────────────────────────── */}
      <nav className="bottom-tab-bar md:hidden flex items-center">
        <div className="flex w-full items-center justify-around px-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon   = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => router.push(item.href)}
                className="flex flex-col items-center justify-center flex-1 py-1.5 cursor-pointer group min-w-0"
              >
                <div className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-xl transition-all duration-200',
                  active
                    ? 'bg-primary/15'
                    : 'group-active:scale-90'
                )}>
                  <Icon className={cn(
                    'h-5 w-5 transition-colors duration-200',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )} />
                </div>
                <span className={cn(
                  'text-[10px] font-semibold mt-0.5 tracking-tight transition-colors duration-200 truncate max-w-full px-1',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}>
                  {item.shortName}
                </span>
                {active && (
                  <motion.div
                    layoutId="bottom-tab-indicator"
                    className="absolute bottom-[calc(env(safe-area-inset-bottom)+56px)] h-0.5 w-8 bg-primary rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ─── Theme Toggler ────────────────────────────────────────────────────────────

interface ThemeTogglerProps {
  theme: string | undefined;
  setTheme: (t: string) => void;
}

function ThemeToggler({ theme, setTheme }: ThemeTogglerProps) {
  return (
    <div className="flex items-center bg-muted/70 p-0.5 rounded-lg border border-border/50 select-none">
      {[
        { id: 'light',  icon: Sun,     label: 'Light' },
        { id: 'dark',   icon: Moon,    label: 'Dark'  },
        { id: 'system', icon: Monitor, label: 'Auto'  },
      ].map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setTheme(id)}
          title={`${label} mode`}
          className={cn(
            'p-1.5 rounded-md transition-all cursor-pointer',
            theme === id
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
