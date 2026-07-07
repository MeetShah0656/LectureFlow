'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { AttendanceChart } from '@/components/charts/attendance-chart';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Sparkles,
  Calendar,
  BarChart3,
  History,
  Target,
} from 'lucide-react';
import {
  getTodayAttendance,
  markAttendance,
  unmarkAttendance,
  getAttendanceStats,
  getAttendanceHistory,
} from './actions';

interface TodayEntry {
  id: string;
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  teacher: string | null;
  subject: {
    id: string;
    name: string;
    code: string | null;
  };
  attendanceId: string | null;
  attendanceStatus: string | null;
}

interface SubjectStat {
  id: string;
  name: string;
  code: string | null;
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

interface HistoryRecord {
  id: string;
  date: string;
  status: string;
  timetable: {
    startTime: string;
    endTime: string;
    subject: {
      id: string;
      name: string;
      code: string | null;
    };
  };
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';

  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

type TabId = 'today' | 'stats' | 'history';

export default function AttendancePage() {
  const [activeTab, setActiveTab] = React.useState<TabId>('today');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Today tab state
  const [todayEntries, setTodayEntries] = React.useState<TodayEntry[]>([]);
  const [todayDate, setTodayDate] = React.useState('');
  const [markingId, setMarkingId] = React.useState<string | null>(null);

  // Stats tab state
  const [subjectStats, setSubjectStats] = React.useState<SubjectStat[]>([]);
  const [overallStats, setOverallStats] = React.useState({ present: 0, absent: 0, total: 0, percentage: 0 });
  const [targetPercentage, setTargetPercentage] = React.useState(75);

  // History tab state
  const [historyRecords, setHistoryRecords] = React.useState<HistoryRecord[]>([]);
  const [historyFilter, setHistoryFilter] = React.useState('');

  // Load all data
  React.useEffect(() => {
    async function loadAll() {
      try {
        const [todayRes, statsRes, historyRes] = await Promise.all([
          getTodayAttendance(),
          getAttendanceStats(),
          getAttendanceHistory(),
        ]);

        if (todayRes.success) {
          setTodayEntries((todayRes.entries || []) as TodayEntry[]);
          setTodayDate(todayRes.todayDate || '');
        } else {
          setError(todayRes.error || 'Failed to load data.');
        }

        if (statsRes.success) {
          setSubjectStats((statsRes.subjects || []) as SubjectStat[]);
          setOverallStats(statsRes.overall || { present: 0, absent: 0, total: 0, percentage: 0 });
          setTargetPercentage(statsRes.target || 75);
        }

        if (historyRes.success) {
          setHistoryRecords((historyRes.records || []) as HistoryRecord[]);
        }
      } catch {
        setError('Something went wrong loading attendance data.');
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  // Handle marking attendance
  const handleMark = async (timetableId: string, status: 'present' | 'absent') => {
    setMarkingId(timetableId);

    // Find current entry
    const entry = todayEntries.find((e) => e.id === timetableId);
    const currentStatus = entry?.attendanceStatus;

    if (currentStatus === status) {
      // Unmark if same status tapped
      const res = await unmarkAttendance(timetableId, todayDate);
      if (res.success) {
        setTodayEntries((prev) =>
          prev.map((e) =>
            e.id === timetableId ? { ...e, attendanceStatus: null, attendanceId: null } : e
          )
        );
      }
    } else {
      // Mark new status
      const res = await markAttendance(timetableId, todayDate, status);
      if (res.success) {
        setTodayEntries((prev) =>
          prev.map((e) =>
            e.id === timetableId ? { ...e, attendanceStatus: status } : e
          )
        );
      }
    }

    // Refresh stats
    const statsRes = await getAttendanceStats();
    if (statsRes.success) {
      setSubjectStats((statsRes.subjects || []) as SubjectStat[]);
      setOverallStats(statsRes.overall || { present: 0, absent: 0, total: 0, percentage: 0 });
    }

    // Refresh history
    const historyRes = await getAttendanceHistory();
    if (historyRes.success) {
      setHistoryRecords((historyRes.records || []) as HistoryRecord[]);
    }

    setMarkingId(null);
  };

  // Filter history by subject
  const filteredHistory = historyFilter
    ? historyRecords.filter((r) => r.timetable?.subject?.id === historyFilter)
    : historyRecords;

  // Loading
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading attendance data...</p>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center space-y-4 select-none">
        <div className="mx-auto p-3 bg-destructive/10 rounded-full w-fit text-destructive">
          <AlertCircle className="h-10 w-10" />
        </div>
        <h3 className="text-xl font-bold tracking-tight">Cannot Load Attendance</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'today', label: "Today's Classes", icon: Calendar },
    { id: 'stats', label: 'Statistics', icon: BarChart3 },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-500 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Attendance</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track your daily attendance and monitor subject-wise statistics
          </p>
        </div>
        <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full w-fit">
          <Target className="h-3 w-3" />
          <span>Target: {targetPercentage}%</span>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex space-x-1 bg-muted/40 p-1 rounded-xl w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {/* ======= TODAY TAB ======= */}
          {activeTab === 'today' && (
            <div className="space-y-4">
              {todayEntries.length === 0 ? (
                <Card className="border-border/60 bg-card/40 backdrop-blur-md">
                  <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                    <div className="p-4 bg-muted rounded-full text-muted-foreground">
                      <Calendar className="h-10 w-10" />
                    </div>
                    <h3 className="text-lg font-bold tracking-tight">No Classes Today</h3>
                    <p className="text-sm text-muted-foreground max-w-sm text-center">
                      You have no scheduled lectures for today. Add classes to your timetable to start tracking.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {todayEntries.map((entry, idx) => {
                    const isPresent = entry.attendanceStatus === 'present';
                    const isAbsent = entry.attendanceStatus === 'absent';
                    const isMarking = markingId === entry.id;

                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04, duration: 0.25 }}
                      >
                        <Card className={`border overflow-hidden transition-all ${
                          isPresent
                            ? 'border-success/30 bg-success/5'
                            : isAbsent
                            ? 'border-destructive/30 bg-destructive/5'
                            : 'border-border/60 bg-card/40 backdrop-blur-md'
                        }`}>
                          <CardContent className="p-4 md:p-5">
                            <div className="flex items-center justify-between gap-4">
                              {/* Left: Class info */}
                              <div className="flex-1 space-y-1.5">
                                <div className="flex items-center space-x-2">
                                  <Clock className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-xs font-bold text-primary">
                                    {formatTime(entry.startTime)} — {formatTime(entry.endTime)}
                                  </span>
                                </div>

                                <h4 className="text-base font-bold tracking-tight">{entry.subject.name}</h4>

                                <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                                  {entry.subject.code && (
                                    <span className="font-bold uppercase bg-muted/60 px-1.5 py-0.5 rounded text-[10px]">
                                      {entry.subject.code}
                                    </span>
                                  )}
                                  {entry.room && (
                                    <span className="flex items-center space-x-1">
                                      <MapPin className="h-3 w-3" />
                                      <span>{entry.room}</span>
                                    </span>
                                  )}
                                  {entry.teacher && (
                                    <span className="flex items-center space-x-1">
                                      <GraduationCap className="h-3 w-3" />
                                      <span>{entry.teacher}</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right: Mark buttons */}
                              <div className="flex items-center space-x-2 shrink-0">
                                <button
                                  onClick={() => handleMark(entry.id, 'present')}
                                  disabled={isMarking}
                                  className={`flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    isPresent
                                      ? 'bg-success text-success-foreground shadow-sm'
                                      : 'bg-success/10 text-success hover:bg-success/20 border border-success/20'
                                  }`}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Present</span>
                                </button>
                                <button
                                  onClick={() => handleMark(entry.id, 'absent')}
                                  disabled={isMarking}
                                  className={`flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    isAbsent
                                      ? 'bg-destructive text-destructive-foreground shadow-sm'
                                      : 'bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20'
                                  }`}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Absent</span>
                                </button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======= STATS TAB ======= */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* Overall attendance card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-border/60 bg-card/40 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center space-x-2">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      <span>Overall Attendance</span>
                    </CardTitle>
                    <CardDescription className="text-xs">Target: {targetPercentage}%</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    <AttendanceChart percentage={overallStats.percentage} />
                    <div className={`mt-3 w-full p-2.5 rounded-xl text-center text-xs font-medium ${
                      overallStats.percentage >= targetPercentage
                        ? 'bg-success/10 border border-success/15 text-success'
                        : overallStats.total === 0
                        ? 'bg-muted border border-border text-muted-foreground'
                        : 'bg-destructive/10 border border-destructive/15 text-destructive'
                    }`}>
                      {overallStats.total === 0
                        ? 'No attendance data yet. Start marking!'
                        : overallStats.percentage >= targetPercentage
                        ? `You're in the SAFE zone with ${overallStats.percentage}%`
                        : `⚠️ Below target! You need ${targetPercentage - overallStats.percentage}% more`}
                    </div>
                  </CardContent>
                </Card>

                {/* Quick stats */}
                <Card className="border-border/60 bg-card/40 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">Quick Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Total Marked</span>
                      <span className="font-bold">{overallStats.total}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center space-x-1.5 text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Present</span>
                      </span>
                      <span className="font-bold text-success">{overallStats.present}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center space-x-1.5 text-destructive">
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Absent</span>
                      </span>
                      <span className="font-bold text-destructive">{overallStats.absent}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Subject count */}
                <Card className="border-border/60 bg-card/40 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">Subjects Tracked</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center h-full pt-2">
                    <span className="text-4xl font-extrabold text-primary">{subjectStats.length}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">Subjects</span>
                  </CardContent>
                </Card>
              </div>

              {/* Per-subject breakdown */}
              <Card className="border-border/60 bg-card/40 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center space-x-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>Subject-wise Breakdown</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subjectStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No subjects found for your semester.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {subjectStats.map((sub) => {
                        const isSafe = sub.percentage >= targetPercentage || sub.total === 0;
                        return (
                          <div key={sub.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-semibold">{sub.name}</span>
                                {sub.code && (
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
                                    {sub.code}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 text-xs">
                                <span className={`font-bold ${isSafe ? 'text-success' : 'text-destructive'}`}>
                                  {sub.total > 0 ? `${sub.percentage}%` : '—'}
                                </span>
                                <span className="text-muted-foreground">
                                  ({sub.present}/{sub.total})
                                </span>
                              </div>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${isSafe ? 'bg-success' : 'bg-destructive'}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${sub.total > 0 ? sub.percentage : 0}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ======= HISTORY TAB ======= */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Filter */}
              <div className="max-w-xs">
                <Select
                  label="Filter by Subject"
                  value={historyFilter}
                  onChange={(e) => setHistoryFilter(e.target.value)}
                >
                  <option value="">All Subjects</option>
                  {subjectStats.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </Select>
              </div>

              {filteredHistory.length === 0 ? (
                <Card className="border-border/60 bg-card/40 backdrop-blur-md">
                  <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                    <div className="p-4 bg-muted rounded-full text-muted-foreground">
                      <History className="h-10 w-10" />
                    </div>
                    <h3 className="text-lg font-bold tracking-tight">No Records Yet</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm">
                      Start marking your attendance on the &quot;Today&apos;s Classes&quot; tab to see your history here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-border/60 bg-card/40 backdrop-blur-md">
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/30">
                      {filteredHistory.map((record) => (
                        <div key={record.id} className="flex items-center justify-between px-5 py-3.5">
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-semibold">{record.timetable?.subject?.name}</span>
                              {record.timetable?.subject?.code && (
                                <span className="text-[9px] font-bold text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
                                  {record.timetable.subject.code}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <span>{formatDateLabel(record.date)}</span>
                              <span>•</span>
                              <span>{formatTime(record.timetable?.startTime)} — {formatTime(record.timetable?.endTime)}</span>
                            </div>
                          </div>
                          <div className={`flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                            record.status === 'present'
                              ? 'bg-success/10 border border-success/20 text-success'
                              : 'bg-destructive/10 border border-destructive/20 text-destructive'
                          }`}>
                            {record.status === 'present' ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            <span>{record.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
