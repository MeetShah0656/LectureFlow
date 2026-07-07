'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import {
  CalendarDays,
  Plus,
  Clock,
  MapPin,
  GraduationCap,
  Edit3,
  Trash2,
  Sparkles,
  AlertCircle,
  Loader2,
  FileImage,
  FileText,
  Upload,
  CheckCircle2,
} from 'lucide-react';
import {
  getUserTimetable,
  getUserSubjects,
  addTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  scanAndAddTimetable,
  type TimetableEntryData,
} from './actions';

const DAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

const DAY_COLORS = [
  'from-blue-500/15 to-blue-600/5 border-blue-500/20',
  'from-violet-500/15 to-violet-600/5 border-violet-500/20',
  'from-emerald-500/15 to-emerald-600/5 border-emerald-500/20',
  'from-amber-500/15 to-amber-600/5 border-amber-500/20',
  'from-rose-500/15 to-rose-600/5 border-rose-500/20',
  'from-cyan-500/15 to-cyan-600/5 border-cyan-500/20',
];

const DAY_ACCENT_COLORS = [
  'text-blue-600 dark:text-blue-400',
  'text-violet-600 dark:text-violet-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-600 dark:text-rose-400',
  'text-cyan-600 dark:text-cyan-400',
];

interface TimetableEntry {
  id: string;
  userId: string | null;
  classId: string | null;
  batchId: string | null;
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  teacher: string | null;
  createdAt: Date;
  subject: {
    id: string;
    name: string;
    code: string | null;
    semesterId: string;
    createdAt: Date;
  };
}

interface SubjectItem {
  id: string;
  name: string;
  code: string | null;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

function getTodayDayOfWeek(): number {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon...6=Sat
  return jsDay === 0 ? 7 : jsDay; // Convert to 1=Mon...7=Sun
}

export default function TimetablePage() {
  const [entries, setEntries] = React.useState<TimetableEntry[]>([]);
  const [subjectsList, setSubjectsList] = React.useState<SubjectItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedDay, setSelectedDay] = React.useState(getTodayDayOfWeek());

  // Dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<TimetableEntry | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);

  // Form state
  const [formSubjectId, setFormSubjectId] = React.useState('');
  const [formDay, setFormDay] = React.useState(1);
  const [formStartTime, setFormStartTime] = React.useState('09:00');
  const [formEndTime, setFormEndTime] = React.useState('09:55');
  const [formRoom, setFormRoom] = React.useState('');
  const [formTeacher, setFormTeacher] = React.useState('');
  const [formError, setFormError] = React.useState('');

  // AI Scan state
  const [scanDialogOpen, setScanDialogOpen] = React.useState(false);
  const [scanFile, setScanFile] = React.useState<File | null>(null);
  const [scanning, setScanning] = React.useState(false);
  const [scanStatus, setScanStatus] = React.useState<'idle' | 'uploading' | 'analyzing' | 'success' | 'error'>('idle');
  const [scanError, setScanError] = React.useState('');
  const [scanCount, setScanCount] = React.useState(0);

  // Load data on mount
  React.useEffect(() => {
    async function loadData() {
      const [ttRes, subRes] = await Promise.all([
        getUserTimetable(),
        getUserSubjects(),
      ]);

      if (ttRes.success && ttRes.entries) {
        setEntries(ttRes.entries as TimetableEntry[]);
      } else {
        setError(ttRes.error || 'Failed to load timetable.');
      }

      if (subRes.success && subRes.subjects) {
        setSubjectsList(subRes.subjects as SubjectItem[]);
      }

      setLoading(false);
    }
    loadData();
  }, []);

  // Filtered entries for selected day
  const dayEntries = entries
    .filter((e) => e.dayOfWeek === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Count entries per day for the tab badges
  const dayEntryCounts = DAYS.map((d) => entries.filter((e) => e.dayOfWeek === d.value).length);

  // Open add dialog
  const openAddDialog = () => {
    setEditingEntry(null);
    setFormSubjectId(subjectsList[0]?.id || '');
    setFormDay(selectedDay <= 6 ? selectedDay : 1);
    setFormStartTime('09:00');
    setFormEndTime('09:55');
    setFormRoom('');
    setFormTeacher('');
    setFormError('');
    setDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (entry: TimetableEntry) => {
    if (!entry.userId) return; // Cannot edit shared/admin entries
    setEditingEntry(entry);
    setFormSubjectId(entry.subjectId);
    setFormDay(entry.dayOfWeek);
    setFormStartTime(entry.startTime);
    setFormEndTime(entry.endTime);
    setFormRoom(entry.room || '');
    setFormTeacher(entry.teacher || '');
    setFormError('');
    setDialogOpen(true);
  };

  // Submit handler (add or edit)
  const handleSubmit = async () => {
    if (!formSubjectId) {
      setFormError('Please select a subject.');
      return;
    }
    if (formStartTime >= formEndTime) {
      setFormError('End time must be after start time.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    const data: TimetableEntryData = {
      subjectId: formSubjectId,
      dayOfWeek: formDay,
      startTime: formStartTime,
      endTime: formEndTime,
      room: formRoom || undefined,
      teacher: formTeacher || undefined,
    };

    if (editingEntry) {
      const res = await updateTimetableEntry(editingEntry.id, data);
      if (!res.success) {
        setFormError(res.error || 'Failed to update.');
        setSubmitting(false);
        return;
      }
    } else {
      const res = await addTimetableEntry(data);
      if (!res.success) {
        setFormError(res.error || 'Failed to add.');
        setSubmitting(false);
        return;
      }
    }

    // Reload timetable
    const ttRes = await getUserTimetable();
    if (ttRes.success && ttRes.entries) {
      setEntries(ttRes.entries as TimetableEntry[]);
    }

    setDialogOpen(false);
    setSubmitting(false);
  };

  // Delete handler
  const handleDelete = async (id: string) => {
    const res = await deleteTimetableEntry(id);
    if (res.success) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
    setDeleteConfirm(null);
  };

  // AI Scan handlers
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanFile) return;

    setScanning(true);
    setScanStatus('analyzing');
    setScanError('');

    try {
      const formData = new FormData();
      formData.append('file', scanFile);

      const res = await scanAndAddTimetable(formData);
      if (res.success) {
        setScanStatus('success');
        setScanCount(res.count || 0);
        // Reload timetable data
        const ttRes = await getUserTimetable();
        if (ttRes.success && ttRes.entries) {
          setEntries(ttRes.entries as TimetableEntry[]);
        }
      } else {
        setScanStatus('error');
        setScanError(res.error || 'Failed to parse the timetable file.');
      }
    } catch (err: any) {
      setScanStatus('error');
      setScanError(err.message || 'An unexpected error occurred.');
    } finally {
      setScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setScanFile(e.target.files[0]);
      setScanStatus('idle');
      setScanError('');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading your timetable...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center space-y-4 select-none">
        <div className="mx-auto p-3 bg-destructive/10 rounded-full w-fit text-destructive">
          <AlertCircle className="h-10 w-10" />
        </div>
        <h3 className="text-xl font-bold tracking-tight">Cannot Load Timetable</h3>
        <p className="text-sm text-muted-foreground">
          {error.includes('onboarding')
            ? 'Please complete the onboarding flow to set up your college profile first.'
            : error}
        </p>
      </div>
    );
  }

  const todayDay = getTodayDayOfWeek();

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-500 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Timetable</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your weekly lecture schedule — add, edit, and manage slots
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setScanFile(null);
              setScanStatus('idle');
              setScanError('');
              setScanDialogOpen(true);
            }}
            variant="outline"
            className="flex items-center space-x-2 rounded-xl shadow-xs"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span>AI Import Timetable</span>
          </Button>

          <Button
            onClick={openAddDialog}
            disabled={subjectsList.length === 0}
            className="flex items-center space-x-2 rounded-xl shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add Lecture</span>
          </Button>
        </div>
      </div>

      {/* No subjects warning */}
      {subjectsList.length === 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">No Subjects Found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                There are no subjects in the database for your semester. Ask your admin to seed
                the subject data, or complete onboarding with the correct semester selection.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day Tabs */}
      <div className="flex space-x-1 overflow-x-auto pb-1 scrollbar-none">
        {DAYS.map((day, i) => {
          const isActive = selectedDay === day.value;
          const isToday = todayDay === day.value;
          const count = dayEntryCounts[i];

          return (
            <button
              key={day.value}
              onClick={() => setSelectedDay(day.value)}
              className={`relative flex flex-col items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap min-w-[72px] ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wider">{day.short}</span>
              {count > 0 && (
                <span className={`text-[10px] mt-0.5 font-semibold ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {count} {count === 1 ? 'class' : 'classes'}
                </span>
              )}
              {isToday && !isActive && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Day Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedDay}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          {dayEntries.length === 0 ? (
            /* Empty day state */
            <Card className="border-border/60 bg-card/40 backdrop-blur-md">
              <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="p-4 bg-muted rounded-full text-muted-foreground">
                  <CalendarDays className="h-10 w-10" />
                </div>
                <h3 className="text-lg font-bold tracking-tight">No classes on {DAYS.find(d => d.value === selectedDay)?.label}</h3>
                <p className="text-sm text-muted-foreground max-w-sm text-center">
                  {subjectsList.length > 0
                    ? 'Tap "Add Lecture" to schedule your classes for this day.'
                    : 'No subjects are available. Complete onboarding to get started.'}
                </p>
                {subjectsList.length > 0 && (
                  <Button onClick={openAddDialog} variant="outline" className="flex items-center space-x-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add a class</span>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Timetable cards */
            <div className="grid grid-cols-1 gap-3">
              {dayEntries.map((entry, idx) => {
                const dayIdx = (entry.dayOfWeek - 1) % DAY_COLORS.length;
                const isOwned = !!entry.userId;

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.25 }}
                  >
                    <Card className={`border bg-gradient-to-br ${DAY_COLORS[dayIdx]} overflow-hidden transition-all hover:shadow-md group`}>
                      <CardContent className="p-4 md:p-5">
                        <div className="flex items-start justify-between gap-3">
                          {/* Left: Time + Subject */}
                          <div className="flex-1 space-y-2">
                            {/* Time Badge */}
                            <div className="flex items-center space-x-2">
                              <div className={`flex items-center space-x-1.5 text-xs font-bold ${DAY_ACCENT_COLORS[dayIdx]}`}>
                                <Clock className="h-3.5 w-3.5" />
                                <span>{formatTime(entry.startTime)} — {formatTime(entry.endTime)}</span>
                              </div>
                            </div>

                            {/* Subject name + code */}
                            <div>
                              <h4 className="text-base font-bold tracking-tight text-foreground">
                                {entry.subject.name}
                              </h4>
                              {entry.subject.code && (
                                <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded-md mt-1 inline-block">
                                  {entry.subject.code}
                                </span>
                              )}
                            </div>

                            {/* Room + Teacher */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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

                          {/* Right: Actions (only for user-owned entries) */}
                          {isOwned && (
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() => openEditDialog(entry)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors cursor-pointer"
                                title="Edit"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              {deleteConfirm === entry.id ? (
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => handleDelete(entry.id)}
                                    className="px-2 py-1 rounded-md bg-destructive text-destructive-foreground text-[10px] font-bold cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-[10px] font-bold cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirm(entry.id)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}

                          {/* Shared indicator */}
                          {!isOwned && (
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-0.5 rounded-md shrink-0">
                              Shared
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Weekly Overview Summary */}
      {entries.length > 0 && (
        <Card className="border-border/60 bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center space-x-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Weekly Overview</span>
            </CardTitle>
            <CardDescription className="text-xs">
              {entries.length} total {entries.length === 1 ? 'lecture' : 'lectures'} across your week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-2">
              {DAYS.map((day, i) => {
                const count = dayEntryCounts[i];
                const isToday = todayDay === day.value;
                return (
                  <button
                    key={day.value}
                    onClick={() => setSelectedDay(day.value)}
                    className={`flex flex-col items-center p-2 rounded-xl transition-all cursor-pointer ${
                      isToday ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                      {day.short}
                    </span>
                    <span className={`text-lg font-extrabold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingEntry ? 'Edit Lecture Slot' : 'Add Lecture Slot'}
        description={editingEntry ? 'Update the details for this class.' : 'Schedule a new class in your weekly timetable.'}
      >
        <div className="space-y-4 pt-2">
          {formError && (
            <div className="p-2.5 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-lg">
              {formError}
            </div>
          )}

          <Select
            label="Subject"
            value={formSubjectId}
            onChange={(e) => setFormSubjectId(e.target.value)}
          >
            <option value="">Select Subject</option>
            {subjectsList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.code ? `(${s.code})` : ''}
              </option>
            ))}
          </Select>

          <Select
            label="Day of Week"
            value={String(formDay)}
            onChange={(e) => setFormDay(Number(e.target.value))}
          >
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Start Time</label>
              <Input
                type="time"
                value={formStartTime}
                onChange={(e) => setFormStartTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">End Time</label>
              <Input
                type="time"
                value={formEndTime}
                onChange={(e) => setFormEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Room <span className="text-muted-foreground">(optional)</span></label>
              <Input
                placeholder="e.g. Room 403"
                value={formRoom}
                onChange={(e) => setFormRoom(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Teacher <span className="text-muted-foreground">(optional)</span></label>
              <Input
                placeholder="e.g. Prof. A. Shah"
                value={formTeacher}
                onChange={(e) => setFormTeacher(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-border/40">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="min-w-[100px]">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingEntry ? (
                'Save Changes'
              ) : (
                'Add Lecture'
              )}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* AI Timetable Scanner Dialog */}
      <Dialog
        isOpen={scanDialogOpen}
        onClose={() => !scanning && setScanDialogOpen(false)}
        title="AI Timetable Scanner"
        description="Upload an image (PNG, JPG) or PDF of your timetable. LectureFlow will use AI to extract all classes automatically."
      >
        <form onSubmit={handleScanSubmit} className="space-y-4 pt-2">
          {scanStatus === 'idle' && (
            <div className="space-y-4">
              {/* File Dropzone */}
              <div className="border-2 border-dashed border-muted hover:border-primary/50 transition-all rounded-xl p-8 text-center relative cursor-pointer group">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-primary/5 rounded-full text-primary group-hover:scale-110 transition-transform">
                    <Upload className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Click to upload or drag & drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPEG, or PDF (max 8MB)
                    </p>
                  </div>
                </div>
              </div>

              {scanFile && (
                <div className="flex items-center space-x-3 p-3 bg-muted/40 rounded-xl">
                  {scanFile.type === 'application/pdf' ? (
                    <FileText className="h-8 w-8 text-primary shrink-0" />
                  ) : (
                    <FileImage className="h-8 w-8 text-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate text-foreground">
                      {scanFile.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(scanFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-border/40">
                <Button variant="ghost" onClick={() => setScanDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!scanFile} className="min-w-[100px]">
                  Start Scanning
                </Button>
              </div>
            </div>
          )}

          {scanStatus === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold">AI is parsing your timetable</h4>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Extracting lecture slots, room locations, and teachers... This may take a few seconds.
                </p>
              </div>
            </div>
          )}

          {scanStatus === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
              <div className="p-3.5 bg-success/15 rounded-full text-success">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold tracking-tight">Scanner Complete</h3>
                <p className="text-sm text-muted-foreground">
                  AI successfully parsed and imported **{scanCount} lecture slots** into your weekly schedule grid!
                </p>
              </div>
              <Button
                className="mt-2 min-w-[120px]"
                onClick={() => setScanDialogOpen(false)}
              >
                Done
              </Button>
            </div>
          )}

          {scanStatus === 'error' && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center justify-center space-y-3 text-center">
                <div className="p-3 bg-destructive/15 rounded-full text-destructive">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <h4 className="text-sm font-bold text-destructive">Scanning Failed</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {scanError}
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-border/40">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setScanFile(null);
                    setScanStatus('idle');
                  }}
                >
                  Try Again
                </Button>
                <Button variant="default" onClick={() => setScanDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </form>
      </Dialog>
    </div>
  );
}
