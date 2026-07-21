'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { AttendanceChart } from '@/components/charts/attendance-chart';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  GraduationCap,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Calendar,
  BarChart3,
  History,
  Target,
  Pencil,
  RotateCcw,
  Save,
  StickyNote,
  X,
  BookOpen,
} from 'lucide-react';
import {
  getTodayAttendance,
  markAttendance,
  unmarkAttendance,
  getAttendanceStats,
  getAttendanceHistory,
  saveLectureOverride,
  deleteLectureOverride,
} from './actions';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubjectInfo {
  id: string;
  name: string;
  code: string | null;
}

interface TodayEntry {
  id: string;
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  teacher: string | null;
  subject: SubjectInfo;
  attendanceId: string | null;
  attendanceStatus: string | null;
  overrideTeacher: string | null;
  overrideRoom: string | null;
  overrideNotes: string | null;
  overrideSubjectId: string | null;
  overrideSubject: SubjectInfo | null;
  hasOverride: boolean;
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
  hasOverride: boolean;
  overrideTeacher: string | null;
  overrideRoom: string | null;
  overrideNotes: string | null;
  overrideSubjectId: string | null;
  overrideSubject: SubjectInfo | null;
  timetable: {
    startTime: string;
    endTime: string;
    teacher: string | null;
    room: string | null;
    subject: SubjectInfo;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Inline Edit Panel ───────────────────────────────────────────────────────

interface EditPanelProps {
  entry: TodayEntry;
  date: string;
  allSubjects: SubjectInfo[];
  onSave: (
    entryId: string,
    data: { teacher: string; room: string; notes: string; subjectId: string }
  ) => Promise<void>;
  onReset: (entryId: string) => Promise<void>;
  onClose: () => void;
}

function LectureEditPanel({ entry, date, allSubjects, onSave, onReset, onClose }: EditPanelProps) {
  const [teacher, setTeacher] = React.useState(entry.overrideTeacher ?? entry.teacher ?? '');
  const [room, setRoom] = React.useState(entry.overrideRoom ?? entry.room ?? '');
  const [notes, setNotes] = React.useState(entry.overrideNotes ?? '');
  // Default to override subject if set, else original subject
  const [subjectId, setSubjectId] = React.useState(
    entry.overrideSubjectId ?? entry.subjectId ?? ''
  );
  const [saving, setSaving] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);

  const isSubjectChanged = subjectId !== entry.subjectId;

  const handleSave = async () => {
    setSaving(true);
    await onSave(entry.id, { teacher, room, notes, subjectId });
    setSaving(false);
    onClose();
  };

  const handleReset = async () => {
    setResetting(true);
    await onReset(entry.id);
    setResetting(false);
    onClose();
  };

  return (
    <motion.div
      key="edit-panel"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className="overflow-hidden"
    >
      <div className="mt-3 pt-3 border-t border-border/40 space-y-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Edit for {formatDateLabel(date)} only
        </p>

        {/* Subject override */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground flex items-center space-x-1">
            <BookOpen className="h-3 w-3" />
            <span>
              Subject{' '}
              {isSubjectChanged && (
                <span className="text-amber-500 font-bold">(changed)</span>
              )}
            </span>
          </label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-all"
          >
            {allSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.code ? ` (${s.code})` : ''}
                {s.id === entry.subjectId ? ' — default' : ''}
              </option>
            ))}
          </select>
          {isSubjectChanged && (
            <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80">
              ⚠ Attendance will be counted under the new subject's statistics.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Teacher */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center space-x-1">
              <GraduationCap className="h-3 w-3" />
              <span>Faculty / Teacher</span>
            </label>
            <input
              type="text"
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              placeholder={entry.teacher ?? 'Enter faculty name'}
              className="flex h-9 w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-all"
            />
          </div>

          {/* Room */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center space-x-1">
              <MapPin className="h-3 w-3" />
              <span>Room / Location</span>
            </label>
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder={entry.room ?? 'Enter room'}
              className="flex h-9 w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-all"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground flex items-center space-x-1">
            <StickyNote className="h-3 w-3" />
            <span>Notes <span className="font-normal">(optional)</span></span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='e.g. Substitute lecture by Dr. Mehta'
            className="flex h-9 w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-all"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-1">
          {entry.hasOverride ? (
            <button
              onClick={handleReset}
              disabled={resetting || saving}
              className="flex items-center space-x-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin' : ''}`} />
              <span>{resetting ? 'Resetting…' : 'Reset to Default'}</span>
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="flex items-center space-x-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2.5 py-1.5 rounded-lg hover:bg-muted/50"
            >
              <X className="h-3.5 w-3.5" />
              <span>Cancel</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving || resetting}
              className="flex items-center space-x-1.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer px-3 py-1.5 rounded-lg disabled:opacity-50 shadow-sm"
            >
              <Save className={`h-3.5 w-3.5 ${saving ? 'animate-pulse' : ''}`} />
              <span>{saving ? 'Saving…' : 'Save Override'}</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const [activeTab, setActiveTab] = React.useState<TabId>('today');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Today tab
  const [todayEntries, setTodayEntries] = React.useState<TodayEntry[]>([]);
  const [todayDate, setTodayDate] = React.useState('');
  const [markingId, setMarkingId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [usingFallback, setUsingFallback] = React.useState(false);

  // Stats tab
  const [subjectStats, setSubjectStats] = React.useState<SubjectStat[]>([]);
  const [overallStats, setOverallStats] = React.useState({
    present: 0, absent: 0, total: 0, percentage: 0,
  });
  const [targetPercentage, setTargetPercentage] = React.useState(75);

  // History tab
  const [historyRecords, setHistoryRecords] = React.useState<HistoryRecord[]>([]);
  const [historyFilter, setHistoryFilter] = React.useState('');

  // ── Load all data ──────────────────────────────────────────────────────────
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
          setUsingFallback(todayRes.usingFallback ?? false);
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

  // ── Mark / unmark ─────────────────────────────────────────────────────────
  const handleMark = async (timetableId: string, status: 'present' | 'absent') => {
    setMarkingId(timetableId);
    const entry = todayEntries.find((e) => e.id === timetableId);
    const currentStatus = entry?.attendanceStatus;

    if (currentStatus === status) {
      const res = await unmarkAttendance(timetableId, todayDate);
      if (res.success) {
        setTodayEntries((prev) =>
          prev.map((e) => e.id === timetableId ? { ...e, attendanceStatus: null, attendanceId: null } : e)
        );
      }
    } else {
      const res = await markAttendance(timetableId, todayDate, status);
      if (res.success) {
        setTodayEntries((prev) =>
          prev.map((e) => e.id === timetableId ? { ...e, attendanceStatus: status } : e)
        );
      }
    }

    // Refresh stats & history
    const [statsRes, historyRes] = await Promise.all([getAttendanceStats(), getAttendanceHistory()]);
    if (statsRes.success) {
      setSubjectStats((statsRes.subjects || []) as SubjectStat[]);
      setOverallStats(statsRes.overall || { present: 0, absent: 0, total: 0, percentage: 0 });
    }
    if (historyRes.success) setHistoryRecords((historyRes.records || []) as HistoryRecord[]);

    setMarkingId(null);
  };

  // ── Date change ───────────────────────────────────────────────────────────
  const handleDateChange = async (dateStr: string) => {
    if (!dateStr) return;
    setTodayDate(dateStr);
    setEditingId(null);
    setLoading(true);
    try {
      const res = await getTodayAttendance(dateStr);
      if (res.success) {
        setTodayEntries((res.entries || []) as TodayEntry[]);
        setUsingFallback(res.usingFallback ?? false);
      } else {
        setError(res.error || 'Failed to load entries for selected date.');
      }
    } catch {
      setError('An error occurred while switching dates.');
    } finally {
      setLoading(false);
    }
  };

  // ── Save override ─────────────────────────────────────────────────────────
  const handleSaveOverride = async (
    entryId: string,
    data: { teacher: string; room: string; notes: string; subjectId: string }
  ) => {
    const res = await saveLectureOverride(entryId, todayDate, data);
    if (res.success) {
      // Find the override subject from stats list so we can update local state
      const overrideSubject =
        data.subjectId
          ? (subjectStats.find((s) => s.id === data.subjectId) ?? null)
          : null;

      setTodayEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                overrideTeacher: data.teacher || null,
                overrideRoom: data.room || null,
                overrideNotes: data.notes || null,
                overrideSubjectId: data.subjectId || null,
                overrideSubject: overrideSubject
                  ? { id: overrideSubject.id, name: overrideSubject.name, code: overrideSubject.code }
                  : null,
                hasOverride: true,
              }
            : e
        )
      );

      // Refresh stats so subject counts update immediately
      const statsRes = await getAttendanceStats();
      if (statsRes.success) {
        setSubjectStats((statsRes.subjects || []) as SubjectStat[]);
        setOverallStats(statsRes.overall || { present: 0, absent: 0, total: 0, percentage: 0 });
      }
    }
  };

  // ── Reset override ────────────────────────────────────────────────────────
  const handleResetOverride = async (entryId: string) => {
    const res = await deleteLectureOverride(entryId, todayDate);
    if (res.success) {
      setTodayEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                overrideTeacher: null,
                overrideRoom: null,
                overrideNotes: null,
                overrideSubjectId: null,
                overrideSubject: null,
                hasOverride: false,
              }
            : e
        )
      );
      // Refresh stats
      const statsRes = await getAttendanceStats();
      if (statsRes.success) {
        setSubjectStats((statsRes.subjects || []) as SubjectStat[]);
        setOverallStats(statsRes.overall || { present: 0, absent: 0, total: 0, percentage: 0 });
      }
    }
  };

  // ── Filtered history ──────────────────────────────────────────────────────
  const filteredHistory = historyFilter
    ? historyRecords.filter((r) => {
        const effectiveSub = r.overrideSubjectId ?? r.timetable?.subject?.id;
        return effectiveSub === historyFilter;
      })
    : historyRecords;

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading attendance data...</p>
      </div>
    );
  }

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
          {/* ── TODAY TAB ── */}
          {activeTab === 'today' && (
            <div className="space-y-4">
              <Card className="border-border/60 bg-card/40 backdrop-blur-md">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>Select Attendance Date</span>
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Select a previous date to review or edit past attendance logs.
                    </p>
                  </div>
                  <input
                    type="date"
                    value={todayDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="flex h-10 w-full sm:w-[180px] rounded-xl border border-border/50 bg-background/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground"
                  />
                </CardContent>
              </Card>

              {/* Fallback notice */}
              {usingFallback && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/8 text-amber-700 dark:text-amber-400">
                  <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">
                    No timetable existed for this date — showing your <span className="font-bold">current active schedule</span> so you can mark attendance retroactively.
                  </p>
                </div>
              )}

              {todayEntries.length === 0 ? (
                <Card className="border-border/60 bg-card/40 backdrop-blur-md">
                  <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                    <div className="p-4 bg-muted rounded-full text-muted-foreground">
                      <Calendar className="h-10 w-10" />
                    </div>
                    <h3 className="text-lg font-bold tracking-tight">No Classes Scheduled</h3>
                    <p className="text-sm text-muted-foreground max-w-sm text-center">
                      There are no scheduled lectures for this day in your timetable.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {todayEntries.map((entry, idx) => {
                    const isPresent = entry.attendanceStatus === 'present';
                    const isAbsent = entry.attendanceStatus === 'absent';
                    const isMarking = markingId === entry.id;
                    const isEditing = editingId === entry.id;

                    // Effective values shown on the card
                    const displaySubject = entry.overrideSubject ?? entry.subject;
                    const displayTeacher = entry.overrideTeacher ?? entry.teacher;
                    const displayRoom = entry.overrideRoom ?? entry.room;
                    const subjectChanged =
                      entry.hasOverride &&
                      entry.overrideSubjectId !== null &&
                      entry.overrideSubjectId !== entry.subjectId;

                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04, duration: 0.25 }}
                      >
                        <Card
                          className={`border overflow-hidden transition-all ${
                            isPresent
                              ? 'border-success/30 bg-success/5'
                              : isAbsent
                              ? 'border-destructive/30 bg-destructive/5'
                              : 'border-border/60 bg-card/40 backdrop-blur-md'
                          }`}
                        >
                          <CardContent className="p-4 md:p-5">
                            <div className="flex items-start justify-between gap-4">
                              {/* Left */}
                              <div className="flex-1 space-y-1.5 min-w-0">
                                <div className="flex items-center flex-wrap gap-2">
                                  <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span className="text-xs font-bold text-primary">
                                    {formatTime(entry.startTime)} — {formatTime(entry.endTime)}
                                  </span>
                                  {entry.hasOverride && (
                                    <span className="inline-flex items-center space-x-1 text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                                      <Pencil className="h-2.5 w-2.5" />
                                      <span>Modified</span>
                                    </span>
                                  )}
                                </div>

                                {/* Subject — show override if changed */}
                                <div className="flex items-center flex-wrap gap-1.5">
                                  <h4 className="text-base font-bold tracking-tight">
                                    {displaySubject.name}
                                  </h4>
                                  {subjectChanged && (
                                    <span className="text-[10px] text-muted-foreground line-through">
                                      {entry.subject.name}
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                                  {displaySubject.code && (
                                    <span className="font-bold uppercase bg-muted/60 px-1.5 py-0.5 rounded text-[10px]">
                                      {displaySubject.code}
                                    </span>
                                  )}
                                  {displayRoom && (
                                    <span
                                      className={`flex items-center space-x-1 ${
                                        entry.hasOverride && entry.overrideRoom
                                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                          : ''
                                      }`}
                                    >
                                      <MapPin className="h-3 w-3" />
                                      <span>{displayRoom}</span>
                                    </span>
                                  )}
                                  {displayTeacher && (
                                    <span
                                      className={`flex items-center space-x-1 ${
                                        entry.hasOverride && entry.overrideTeacher
                                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                          : ''
                                      }`}
                                    >
                                      <GraduationCap className="h-3 w-3" />
                                      <span>{displayTeacher}</span>
                                    </span>
                                  )}
                                  {entry.overrideNotes && (
                                    <span className="flex items-center space-x-1 italic text-amber-600/80 dark:text-amber-400/80">
                                      <StickyNote className="h-3 w-3" />
                                      <span>{entry.overrideNotes}</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right: edit + mark buttons */}
                              <div className="flex items-center space-x-1.5 shrink-0">
                                <button
                                  onClick={() => setEditingId(isEditing ? null : entry.id)}
                                  title="Edit this lecture for today"
                                  className={`flex items-center justify-center h-8 w-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    isEditing
                                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                      : entry.hasOverride
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
                                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40'
                                  }`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>

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

                            {/* Inline edit panel */}
                            <AnimatePresence>
                              {isEditing && (
                                <LectureEditPanel
                                  entry={entry}
                                  date={todayDate}
                                  allSubjects={subjectStats.map((s) => ({
                                    id: s.id,
                                    name: s.name,
                                    code: s.code,
                                  }))}
                                  onSave={handleSaveOverride}
                                  onReset={handleResetOverride}
                                  onClose={() => setEditingId(null)}
                                />
                              )}
                            </AnimatePresence>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── STATS TAB ── */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
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
                    <div
                      className={`mt-3 w-full p-2.5 rounded-xl text-center text-xs font-medium ${
                        overallStats.percentage >= targetPercentage
                          ? 'bg-success/10 border border-success/15 text-success'
                          : overallStats.total === 0
                          ? 'bg-muted border border-border text-muted-foreground'
                          : 'bg-destructive/10 border border-destructive/15 text-destructive'
                      }`}
                    >
                      {overallStats.total === 0
                        ? 'No attendance data yet. Start marking!'
                        : overallStats.percentage >= targetPercentage
                        ? `You're in the SAFE zone with ${overallStats.percentage}%`
                        : `⚠️ Below target! You need ${targetPercentage - overallStats.percentage}% more`}
                    </div>
                  </CardContent>
                </Card>

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

                <Card className="border-border/60 bg-card/40 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">Subjects Tracked</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center h-full pt-2">
                    <span className="text-4xl font-extrabold text-primary">{subjectStats.length}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">
                      Subjects
                    </span>
                  </CardContent>
                </Card>
              </div>

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

          {/* ── HISTORY TAB ── */}
          {activeTab === 'history' && (
            <div className="space-y-4">
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
                      {filteredHistory.map((record) => {
                        const effectiveSubject = record.overrideSubject ?? record.timetable?.subject;
                        const originalSubject = record.timetable?.subject;
                        const subjectSwapped =
                          record.hasOverride &&
                          record.overrideSubjectId &&
                          record.overrideSubjectId !== originalSubject?.id;
                        const displayTeacher =
                          record.overrideTeacher ?? record.timetable?.teacher ?? null;

                        return (
                          <div key={record.id} className="flex items-start justify-between px-5 py-3.5">
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                                <span className="text-sm font-semibold">{effectiveSubject?.name}</span>
                                {effectiveSubject?.code && (
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
                                    {effectiveSubject.code}
                                  </span>
                                )}
                                {subjectSwapped && (
                                  <span className="text-[10px] text-muted-foreground line-through">
                                    {originalSubject?.name}
                                  </span>
                                )}
                                {record.hasOverride && (
                                  <span className="inline-flex items-center space-x-1 text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                                    <Pencil className="h-2.5 w-2.5" />
                                    <span>Modified</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center flex-wrap gap-x-2 text-xs text-muted-foreground">
                                <span>{formatDateLabel(record.date)}</span>
                                <span>•</span>
                                <span>
                                  {formatTime(record.timetable?.startTime)} —{' '}
                                  {formatTime(record.timetable?.endTime)}
                                </span>
                                {displayTeacher && (
                                  <>
                                    <span>•</span>
                                    <span
                                      className={`flex items-center space-x-1 ${
                                        record.hasOverride && record.overrideTeacher
                                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                          : ''
                                      }`}
                                    >
                                      <GraduationCap className="h-3 w-3" />
                                      <span>{displayTeacher}</span>
                                    </span>
                                  </>
                                )}
                              </div>

                              {record.overrideNotes && (
                                <p className="text-[11px] italic text-amber-600/80 dark:text-amber-400/80 flex items-center space-x-1 mt-0.5">
                                  <StickyNote className="h-3 w-3 shrink-0" />
                                  <span>{record.overrideNotes}</span>
                                </p>
                              )}
                            </div>

                            <div
                              className={`flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ml-3 shrink-0 ${
                                record.status === 'present'
                                  ? 'bg-success/10 border border-success/20 text-success'
                                  : 'bg-destructive/10 border border-destructive/20 text-destructive'
                              }`}
                            >
                              {record.status === 'present' ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              <span>{record.status}</span>
                            </div>
                          </div>
                        );
                      })}
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
