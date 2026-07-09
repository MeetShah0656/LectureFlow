'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { AttendanceChart } from '@/components/charts/attendance-chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  GraduationCap,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  TrendingUp,
  XCircle,
  MapPin,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimetableEntry {
  id: string;
  dayOfWeek: number; // 1 = Monday … 7 = Sunday
  startTime: string; // "HH:MM"
  endTime: string;
  room: string | null;
  teacher: string | null;
  subject: { id: string; name: string; code: string | null } | null;
}

interface RecentActivity {
  id: string;
  action: string;
  details: string;
  createdAt: string; // ISO string
}

interface Props {
  profileName: string;
  targetAttendance: number;
  academicYearStr: string;
  branchName: string;
  universityName: string;
  overallPercentage: number;
  totalPresent: number;
  totalAbsent: number;
  allTimetableEntries: TimetableEntry[];
  // key format: "timetableId__YYYY-MM-DD" → status
  attendanceRecords: Record<string, string>;
  recentActivity: RecentActivity[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

/** Returns minutes since midnight for a "HH:MM" string */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Uses LOCAL browser time — this is the key fix */
function getLocalNowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getClassStatus(
  startTime: string,
  endTime: string
): 'completed' | 'ongoing' | 'upcoming' {
  const nowMin = getLocalNowMinutes();
  const startMin = toMinutes(startTime);
  const endMin = toMinutes(endTime);
  if (nowMin >= endMin) return 'completed';
  if (nowMin >= startMin) return 'ongoing';
  return 'upcoming';
}

/** Get today's local day-of-week (1 = Mon … 7 = Sun) */
function getLocalDayOfWeek(): number {
  const jsDay = new Date().getDay(); // 0 = Sun
  return jsDay === 0 ? 7 : jsDay;
}

/** Get today's local date string "YYYY-MM-DD" */
function getLocalDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getRelativeTime(isoStr: string): string {
  const now = new Date();
  const diff = now.getTime() - new Date(isoStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(isoStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardClient({
  profileName,
  targetAttendance,
  academicYearStr,
  branchName,
  universityName,
  overallPercentage,
  totalPresent,
  totalAbsent,
  allTimetableEntries,
  attendanceRecords,
  recentActivity,
}: Props) {
  // All time-sensitive state is computed on the client using local time
  const [now, setNow] = React.useState<Date | null>(null);

  // Tick every minute so status badges stay accurate
  React.useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Derived values — only computed after hydration to avoid SSR mismatch
  const localDayOfWeek = now ? getLocalDayOfWeek() : null;
  const localDateStr = now ? getLocalDateStr() : null;
  const localNowMinutes = now ? now.getHours() * 60 + now.getMinutes() : null;

  // Today's classes: filter by local day-of-week
  const todayEntries = React.useMemo(() => {
    if (localDayOfWeek === null || localDateStr === null || localNowMinutes === null) return [];

    return allTimetableEntries
      .filter((e) => e.dayOfWeek === localDayOfWeek)
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
      .map((e) => {
        const startMin = toMinutes(e.startTime);
        const endMin = toMinutes(e.endTime);
        let status: 'completed' | 'ongoing' | 'upcoming';
        if (localNowMinutes >= endMin) status = 'completed';
        else if (localNowMinutes >= startMin) status = 'ongoing';
        else status = 'upcoming';

        const attendanceKey = `${e.id}__${localDateStr}`;
        const attendanceStatus = attendanceRecords[attendanceKey] ?? null;

        return {
          id: e.id,
          subject: e.subject?.name ?? 'Unknown',
          code: e.subject?.code ?? '',
          time: `${formatTime(e.startTime)} - ${formatTime(e.endTime)}`,
          room: e.room ?? '',
          teacher: e.teacher ?? '',
          status,
          attendanceStatus,
        };
      });
  }, [allTimetableEntries, localDayOfWeek, localDateStr, localNowMinutes, attendanceRecords]);

  const upcomingClass =
    todayEntries.find((c) => c.status === 'ongoing') ??
    todayEntries.find((c) => c.status === 'upcoming') ??
    null;

  const todayDayName = localDayOfWeek ? DAY_NAMES[localDayOfWeek] ?? 'Today' : 'Today';
  const totalMarked = totalPresent + totalAbsent;

  // Greeting based on local hour
  const localHour = now?.getHours() ?? new Date().getHours();
  let greeting = 'Good evening';
  if (localHour < 12) greeting = 'Good morning';
  else if (localHour < 17) greeting = 'Good afternoon';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-primary tracking-widest uppercase mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Overview Dashboard</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight">
            {greeting}, {profileName}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {universityName} • {branchName}
          </p>
        </div>
        <div className="text-left md:text-right">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
            Academic Year
          </span>
          <span className="text-sm font-semibold text-foreground/80">{academicYearStr}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Widget 1: Attendance Circular Progress Ring */}
        <Card className="md:col-span-1 border-border/60 bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span>Attendance Track</span>
            </CardTitle>
            <CardDescription>Target requirement: {targetAttendance}%</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <AttendanceChart percentage={overallPercentage} />
            <div
              className={`mt-4 w-full p-3 rounded-xl text-center ${
                totalMarked === 0
                  ? 'bg-muted/50 border border-border text-muted-foreground'
                  : overallPercentage >= targetAttendance
                  ? 'bg-success/5 border border-success/15'
                  : 'bg-destructive/5 border border-destructive/15'
              }`}
            >
              <span
                className={`text-xs font-medium ${
                  totalMarked === 0
                    ? 'text-muted-foreground'
                    : overallPercentage >= targetAttendance
                    ? 'text-success'
                    : 'text-destructive'
                }`}
              >
                {totalMarked === 0
                  ? 'Start marking attendance to see your progress here.'
                  : overallPercentage >= targetAttendance
                  ? `Your attendance is at ${overallPercentage}%. You are in the SAFE zone.`
                  : `⚠️ Attendance at ${overallPercentage}%. Below ${targetAttendance}% target!`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Widget 2: Today's Class Timeline */}
        <Card className="md:col-span-2 border-border/60 bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Today&apos;s Schedule</span>
            </CardTitle>
            <CardDescription>{todayDayName} timetable classes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {now === null ? (
              // Skeleton while waiting for hydration
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : todayEntries.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Calendar className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  No classes scheduled for today. Add your timetable to get started!
                </p>
              </div>
            ) : (
              <div className="relative border-l border-muted pl-4 space-y-4">
                {todayEntries.map((item) => (
                  <div key={item.id} className="relative group">
                    {/* Timeline dot */}
                    <div
                      className={`absolute -left-[21px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                        item.status === 'completed'
                          ? 'bg-muted'
                          : item.status === 'ongoing'
                          ? 'bg-primary animate-pulse'
                          : 'bg-border'
                      }`}
                    />
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-sm font-semibold transition-colors ${
                              item.status === 'ongoing' ? 'text-primary' : 'text-foreground'
                            }`}
                          >
                            {item.subject}
                          </span>
                          {item.code && (
                            <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded-md">
                              {item.code}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{item.time}</span>
                          </span>
                          {item.room && (
                            <>
                              <span>•</span>
                              <span className="flex items-center space-x-1">
                                <MapPin className="h-3 w-3" />
                                <span>{item.room}</span>
                              </span>
                            </>
                          )}
                          {item.teacher && (
                            <>
                              <span>•</span>
                              <span className="flex items-center space-x-1">
                                <GraduationCap className="h-3 w-3" />
                                <span>{item.teacher}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {item.attendanceStatus && (
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              item.attendanceStatus === 'present'
                                ? 'text-success bg-success/10 border border-success/20'
                                : 'text-destructive bg-destructive/10 border border-destructive/20'
                            }`}
                          >
                            {item.attendanceStatus === 'present' ? '✓' : '✗'}
                          </span>
                        )}
                        {item.status === 'completed' && (
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 px-2 py-0.5 rounded-md">
                            Done
                          </span>
                        )}
                        {item.status === 'ongoing' && (
                          <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-md animate-pulse">
                            Active
                          </span>
                        )}
                        {item.status === 'upcoming' && (
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border border-border px-2 py-0.5 rounded-md">
                            Next
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Widget 3: Upcoming Class Banner */}
        <Card className="border-border/60 bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center space-x-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>Upcoming Class</span>
            </CardTitle>
            <CardDescription>
              {now === null
                ? 'Loading…'
                : upcomingClass
                ? upcomingClass.status === 'ongoing'
                  ? 'Happening now'
                  : 'Starting soon'
                : 'None left today'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 select-none">
            {now === null ? (
              <div className="h-24 rounded-xl bg-muted/50 animate-pulse" />
            ) : upcomingClass ? (
              <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 space-y-3">
                <div>
                  <span className="text-xs text-primary font-bold uppercase tracking-wider">
                    {upcomingClass.status === 'ongoing' ? 'In Progress' : 'Next Session'}
                  </span>
                  <h4 className="text-lg font-extrabold tracking-tight mt-0.5">
                    {upcomingClass.subject}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {upcomingClass.teacher && `${upcomingClass.teacher} • `}
                    {upcomingClass.room || 'Room TBD'}
                  </p>
                </div>
                <div className="flex items-center space-x-1.5 text-xs text-primary font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{upcomingClass.time}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-border bg-muted/30 text-center space-y-2">
                <p className="text-sm text-muted-foreground">No more classes left today!</p>
                <p className="text-xs text-muted-foreground/70">
                  Check back tomorrow for your schedule.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Widget 4: Attendance Summary */}
        <Card className="border-border/60 bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center space-x-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              <span>Attendance Summary</span>
            </CardTitle>
            <CardDescription>Your overall tracking progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold select-none">
                <span>Attendance Rate</span>
                <span
                  className={
                    overallPercentage >= targetAttendance
                      ? 'text-success'
                      : totalMarked === 0
                      ? 'text-muted-foreground'
                      : 'text-destructive'
                  }
                >
                  {totalMarked > 0 ? `${overallPercentage}%` : 'No data'}
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    overallPercentage >= targetAttendance ? 'bg-success' : 'bg-destructive'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${overallPercentage}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 select-none pt-1">
              <div className="flex justify-between">
                <span>Total Marked</span>
                <span className="font-semibold text-foreground">{totalMarked}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center space-x-1">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  <span>Present</span>
                </span>
                <span className="font-semibold text-foreground">{totalPresent}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center space-x-1">
                  <XCircle className="h-3 w-3 text-destructive" />
                  <span>Absent</span>
                </span>
                <span className="font-semibold text-foreground">{totalAbsent}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Widget 5: Recent Activity */}
        <Card className="border-border/60 bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center space-x-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span>Recent Activity</span>
            </CardTitle>
            <CardDescription>Latest attendance logs</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <BookOpen className="h-6 w-6 text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground">
                  No activity yet. Mark attendance to see your logs here.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex justify-between items-start text-xs border-b border-border/30 pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="space-y-0.5 max-w-[80%]">
                      <span
                        className={`font-bold ${
                          activity.action === 'Marked Present' ? 'text-success' : 'text-destructive'
                        }`}
                      >
                        {activity.action}
                      </span>
                      <p className="text-muted-foreground truncate">{activity.details}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {now ? getRelativeTime(activity.createdAt) : '…'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
