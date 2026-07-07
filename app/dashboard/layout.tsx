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
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Bell,
  Sparkles,
} from 'lucide-react';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const sidebarItems: SidebarItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Attendance', href: '/dashboard/attendance', icon: CheckSquare },
  { name: 'Timetable', href: '/dashboard/timetable', icon: CalendarDays },
  { name: 'Syllabus', href: '/dashboard/syllabus', icon: BookOpen },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);

  // Fetch current user email on mount
  React.useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || 'student@svit.edu.in');
    }
    getUser();
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/auth/login');
    } catch {
      router.push('/auth/login');
    }
  };


  return (
    <div className="min-h-screen flex bg-background text-foreground transition-colors duration-300">
      {/* 1. Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border/80 bg-card/40 backdrop-blur-md sticky top-0 h-screen p-4 justify-between">
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center space-x-2.5 px-2.5 py-1.5 select-none">
            <div className="p-1.5 bg-primary rounded-xl text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80">
              LectureFlow
            </span>
          </div>

          {/* Navigation items */}
          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    'w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer select-none',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-4 pt-4 border-t border-border/40">
          <div className="flex flex-col space-y-1 px-3 py-1">
            <span className="text-xs font-semibold text-foreground/80 truncate">{userEmail}</span>
            <span className="text-[10px] text-muted-foreground select-none uppercase tracking-widest">Student Profile</span>
          </div>

          <div className="flex items-center justify-between px-2">
            <ThemeToggler theme={theme} setTheme={setTheme} />
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Navigation */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/80 bg-background/80 backdrop-blur-md px-4 md:px-8">
          <div className="flex items-center space-x-3">
            {/* Mobile Hamburger menu */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm md:text-base font-semibold tracking-tight text-foreground capitalize select-none">
              {pathname === '/dashboard' ? 'Overview' : pathname.split('/').pop()}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Quick action notification */}
            <button
              className="relative p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
          </div>
        </header>

        {/* Dashboard Content Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* 3. Mobile Navigation Menu Overlay Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Sliding Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative flex flex-col w-64 max-w-xs bg-card border-r border-border p-4 justify-between h-full z-55 shadow-2xl"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 select-none">
                    <div className="p-1 bg-primary rounded-lg text-primary-foreground">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span className="font-extrabold text-base tracking-tight">LectureFlow</span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
                    aria-label="Close menu"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {sidebarItems.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          router.push(item.href);
                        }}
                        className={cn(
                          'w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer',
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Mobile Sidebar Footer */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex flex-col space-y-0.5 px-3 py-1">
                  <span className="text-xs font-semibold text-foreground/80 truncate">{userEmail}</span>
                  <span className="text-[10px] text-muted-foreground select-none uppercase tracking-widest">Student Profile</span>
                </div>
                <div className="flex items-center justify-between px-2">
                  <ThemeToggler theme={theme} setTheme={setTheme} />
                  <button
                    onClick={handleSignOut}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ThemeTogglerProps {
  theme: string | undefined;
  setTheme: (theme: string) => void;
}

function ThemeToggler({ theme, setTheme }: ThemeTogglerProps) {
  return (
    <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg border border-border/50 select-none">
      <button
        onClick={() => setTheme('light')}
        className={cn(
          'p-1.5 rounded-md transition-all cursor-pointer',
          theme === 'light' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
        )}
        title="Light Mode"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={cn(
          'p-1.5 rounded-md transition-all cursor-pointer',
          theme === 'dark' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
        )}
        title="Dark Mode"
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={cn(
          'p-1.5 rounded-md transition-all cursor-pointer',
          theme === 'system' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
        )}
        title="System Theme"
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

