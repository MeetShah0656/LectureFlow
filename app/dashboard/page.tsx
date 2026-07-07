import * as React from 'react';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/database/db';
import { users, timetable, attendance, subjects } from '@/database/schema';
import { eq, and, or, asc, desc, isNull } from 'drizzle-orm';
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

interface TimetableItem {
  id: string;
  subject: string;
  code: string;
  time: string;
  room: string;
  teacher: string;
  status: 'completed' | 'ongoing' | 'upcoming';
  attendanceStatus: string | null;
}

interface ActivityItem {
  id: string;
  action: string;
  details: string;
  time: string;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

function getClassStatus(startTime: string, endTime: string): 'completed' | 'ongoing' | 'upcoming' {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  if (nowMinutes >= endMin) return 'completed';
  if (nowMinutes >= startMin && nowMinutes < endMin) return 'ongoing';
  return 'upcoming';
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default async function DashboardPage() {
  let profileName = 'Student';
  let targetAttendance = 75;
  let academicYearStr = '2026-27';
  let branchName = 'Computer Engineering';
  let universityName = 'SVIT';
  let todayClasses: TimetableItem[] = [];
  let recentActivity: ActivityItem[] = [];
  let overallPercentage = 0;
  let totalClassesScheduled = 0;
  let totalClassesAttended = 0;
  let upcomingClass: TimetableItem | null = null;
  let todayDayName = 'Today';

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const dbProfile = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        with: {
          university: true,
          branch: true,
        },
      });

      if (dbProfile) {
        profileName = dbProfile.name || user.email?.split('@')[0] || profileName;
        targetAttendance = dbProfile.attendanceRequirement;
        academicYearStr = dbProfile.academicYear || academicYearStr;
        if (dbProfile.branch) branchName = dbProfile.branch.name;
        if (dbProfile.university) universityName = dbProfile.university.name;

        // Get today's day
        const jsDay = new Date().getDay();
        const todayDayOfWeek = jsDay === 0 ? 7 : jsDay;
        todayDayName = DAY_NAMES[todayDayOfWeek] || 'Today';
        const todayDate = new Date().toISOString().split('T')[0];

        // Fetch user's timetable for today
        const userConditions = [eq(timetable.userId, user.id)];
        if (dbProfile.classId) {
          userConditions.push(
            and(
              eq(timetable.classId, dbProfile.classId),
              isNull(timetable.userId)
            )!
          );
        }

        // Parallelize database queries to avoid waterfall loading
        const [todayEntries, todayRecords, allRecords, recentRecords] = await Promise.all([
          db.query.timetable.findMany({
            where: and(
              eq(timetable.dayOfWeek, todayDayOfWeek),
              or(...userConditions)
            ),
            with: { subject: true },
            orderBy: [asc(timetable.startTime)],
          }),
          db
            .select()
            .from(attendance)
            .where(
              and(
                eq(attendance.userId, user.id),
                eq(attendance.date, todayDate)
              )
            ),
          db
            .select()
            .from(attendance)
            .where(eq(attendance.userId, user.id)),
          db.query.attendance.findMany({
            where: eq(attendance.userId, user.id),
            with: {
              timetable: {
                with: { subject: true },
              },
            },
            orderBy: [desc(attendance.createdAt)],
            limit: 5,
          })
        ]);

        todayClasses = todayEntries.map((entry) => {
          const record = todayRecords.find((r) => r.timetableId === entry.id);
          return {
            id: entry.id,
            subject: entry.subject?.name || 'Unknown',
            code: entry.subject?.code || '',
            time: `${formatTime(entry.startTime)} - ${formatTime(entry.endTime)}`,
            room: entry.room || '',
            teacher: entry.teacher || '',
            status: getClassStatus(entry.startTime, entry.endTime),
            attendanceStatus: record?.status || null,
          };
        });

        // Find the next upcoming class
        upcomingClass = todayClasses.find((c) => c.status === 'ongoing') 
          || todayClasses.find((c) => c.status === 'upcoming') 
          || null;

        // Calculate overall attendance stats
        totalClassesScheduled = allRecords.length;
        totalClassesAttended = allRecords.filter((r) => r.status === 'present').length;
        const totalAbsent = allRecords.filter((r) => r.status === 'absent').length;
        const totalMarked = totalClassesAttended + totalAbsent;
        overallPercentage = totalMarked > 0 ? Math.round((totalClassesAttended / totalMarked) * 100) : 0;

        recentActivity = recentRecords.map((r, i) => ({
          id: r.id,
          action: r.status === 'present' ? 'Marked Present' : 'Marked Absent',
          details: r.timetable?.subject?.name || 'Unknown Subject',
          time: getRelativeTime(r.createdAt),
        }));
      }
    }
  } catch {
    console.warn('Dashboard profile query bypassed/failed, rendering default profile.');
  }

  // Greeting helper
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-primary tracking-widest uppercase mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Overview Dashboard</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight">{greeting}, {profileName}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {universityName} • {branchName}
          </p>
        </div>

        <div className="text-left md:text-right">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">Academic Year</span>
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
            <div className={`mt-4 w-full p-3 rounded-xl text-center ${
              totalClassesScheduled === 0
                ? 'bg-muted/50 border border-border text-muted-foreground'
                : overallPercentage >= targetAttendance
                ? 'bg-success/5 border border-success/15'
                : 'bg-destructive/5 border border-destructive/15'
            }`}>
              <span className={`text-xs font-medium ${
                totalClassesScheduled === 0
                  ? 'text-muted-foreground'
                  : overallPercentage >= targetAttendance
                  ? 'text-success'
                  : 'text-destructive'
              }`}>
                {totalClassesScheduled === 0
                  ? 'Start marking attendance to see your progress here.'
                  : overallPercentage >= targetAttendance
                  ? `Your attendance is at ${overallPercentage}%. You are in the SAFE zone.`
                  : `⚠️ Attendance at ${overallPercentage}%. Below ${targetAttendance}% target!`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Widget 2: Today's Class Timeline List */}
        <Card className="md:col-span-2 border-border/60 bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Today&apos;s Schedule</span>
            </CardTitle>
            <CardDescription>{todayDayName} timetable classes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayClasses.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Calendar className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  No classes scheduled for today. Add your timetable to get started!
                </p>
              </div>
            ) : (
              <div className="relative border-l border-muted pl-4 space-y-4">
                {todayClasses.map((item) => (
                  <div key={item.id} className="relative group">
                    {/* Timeline Node Dot */}
                    <div className={`absolute -left-[21px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                      item.status === 'completed' ? 'bg-muted' :
                      item.status === 'ongoing' ? 'bg-primary animate-pulse' : 'bg-border'
                    }`} />

                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-semibold transition-colors ${
                            item.status === 'ongoing' ? 'text-primary' : 'text-foreground'
                          }`}>{item.subject}</span>
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
                              <span>{item.room}</span>
                            </>
                          )}
                          {item.teacher && (
                            <>
                              <span>•</span>
                              <span>{item.teacher}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Attendance indicator */}
                        {item.attendanceStatus && (
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            item.attendanceStatus === 'present'
                              ? 'text-success bg-success/10 border border-success/20'
                              : 'text-destructive bg-destructive/10 border border-destructive/20'
                          }`}>
                            {item.attendanceStatus === 'present' ? '✓' : '✗'}
                          </span>
                        )}
                        
                        {/* Status badge */}
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
        
        {/* Widget 3: Upcoming Lecture Quick Banner */}
        <Card className="border-border/60 bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center space-x-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>Upcoming Class</span>
            </CardTitle>
            <CardDescription>{upcomingClass ? (upcomingClass.status === 'ongoing' ? 'Happening now' : 'Starting soon') : 'None left'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 select-none">
            {upcomingClass ? (
              <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 space-y-3">
                <div>
                  <span className="text-xs text-primary font-bold uppercase tracking-wider">
                    {upcomingClass.status === 'ongoing' ? 'In Progress' : 'Next Session'}
                  </span>
                  <h4 className="text-lg font-extrabold tracking-tight mt-0.5">{upcomingClass.subject}</h4>
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
                <p className="text-xs text-muted-foreground/70">Check back tomorrow for your schedule.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Widget 4: Semester Term Progress */}
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
                <span className={overallPercentage >= targetAttendance ? 'text-success' : totalClassesScheduled === 0 ? 'text-muted-foreground' : 'text-destructive'}>
                  {totalClassesScheduled > 0 ? `${overallPercentage}%` : 'No data'}
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    overallPercentage >= targetAttendance ? 'bg-success' : 'bg-destructive'
                  }`}
                  style={{ width: `${overallPercentage}%` }}
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 select-none pt-1">
              <div className="flex justify-between">
                <span>Total Marked</span>
                <span className="font-semibold text-foreground">{totalClassesScheduled}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center space-x-1">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  <span>Present</span>
                </span>
                <span className="font-semibold text-foreground">{totalClassesAttended}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center space-x-1">
                  <XCircle className="h-3 w-3 text-destructive" />
                  <span>Absent</span>
                </span>
                <span className="font-semibold text-foreground">{totalClassesScheduled - totalClassesAttended}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Widget 5: Recent Activity Logs Feed */}
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
                  <div key={activity.id} className="flex justify-between items-start text-xs border-b border-border/30 pb-2 last:border-b-0 last:pb-0">
                    <div className="space-y-0.5 max-w-[80%]">
                      <span className={`font-bold ${
                        activity.action === 'Marked Present' ? 'text-success' : 'text-destructive'
                      }`}>{activity.action}</span>
                      <p className="text-muted-foreground truncate">{activity.details}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{activity.time}</span>
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
