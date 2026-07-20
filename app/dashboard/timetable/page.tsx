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
  AlertCircle,
  Loader2,
  Eraser,
} from 'lucide-react';
import {
  getUserTimetable,
  getUserSubjects,
  addTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  clearUserTimetable,
  type TimetableEntryData,
} from './actions';
import { getProfessors, getTimeSlots } from '../settings/actions';

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
  const [professorsList, setProfessorsList] = React.useState<any[]>([]);
  const [timeSlotsList, setTimeSlotsList] = React.useState<any[]>([]);
  const [selectedSlotId, setSelectedSlotId] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedDay, setSelectedDay] = React.useState(getTodayDayOfWeek());

  // Edit mode
  const [editMode, setEditMode] = React.useState(false);

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

  // Clear timetable state
  const [clearConfirmOpen, setClearConfirmOpen] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);

  // Load data on mount
  React.useEffect(() => {
    async function loadData() {
      const [ttRes, subRes, profRes, timeSlotsRes] = await Promise.all([
        getUserTimetable(),
        getUserSubjects(),
        getProfessors(),
        getTimeSlots(),
      ]);

      if (profRes) setProfessorsList(profRes);
      if (timeSlotsRes) setTimeSlotsList(timeSlotsRes);

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
    
    if (timeSlotsList.length > 0) {
      const firstSlot = timeSlotsList[0];
      setSelectedSlotId(firstSlot.id);
      setFormStartTime(firstSlot.startTime);
      setFormEndTime(firstSlot.endTime);
    } else {
      setSelectedSlotId('');
      setFormStartTime('09:00');
      setFormEndTime('09:55');
    }
    
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
    
    const matchedSlot = timeSlotsList.find(s => s.startTime === entry.startTime && s.endTime === entry.endTime);
    setSelectedSlotId(matchedSlot ? matchedSlot.id : '');
    
    setFormRoom(entry.room || '');
    setFormTeacher(entry.teacher || '');
    setFormError('');
    setDialogOpen(true);
  };

  // Submit handler (add or edit)
  const handleSubmit = async () => {
    if (!formSubjectId) { setFormError('Please select a subject.'); return; }
    if (formStartTime >= formEndTime) { setFormError('End time must be after start time.'); return; }

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
      if (!res.success) { setFormError(res.error || 'Failed to update.'); setSubmitting(false); return; }
    } else {
      const res = await addTimetableEntry(data);
      if (!res.success) { setFormError(res.error || 'Failed to add.'); setSubmitting(false); return; }
    }

    // Reload timetable
    const ttRes = await getUserTimetable();
    if (ttRes.success && ttRes.entries) setEntries(ttRes.entries as TimetableEntry[]);

    setDialogOpen(false);
    setSubmitting(false);
  };

  // Delete handler
  const handleDelete = async (id: string) => {
    const res = await deleteTimetableEntry(id);
    if (res.success) setEntries((prev) => prev.filter((e) => e.id !== id));
    setDeleteConfirm(null);
  };

  // Clear timetable handler
  const handleClear = async () => {
    setClearing(true);
    try {
      const res = await clearUserTimetable();
      if (res.success) {
        setEntries((prev) => prev.filter((e) => !e.userId));
        setClearConfirmOpen(false);
        setEditMode(false);
      } else {
        alert(res.error || 'Failed to clear timetable.');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred while clearing the timetable.');
    } finally {
      setClearing(false);
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
  const ownedEntries = entries.filter((e) => !!e.userId);

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

        <div className="flex items-center gap-2 flex-wrap">
          {/* Edit Mode Toggle */}
          <button
            onClick={() => { setEditMode((v) => !v); setDeleteConfirm(null); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
              editMode
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-inner'
                : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/70'
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>{editMode ? 'Exit Edit Mode' : 'Edit Timetable'}</span>
          </button>

          {ownedEntries.length > 0 && editMode && (
            <Button
              onClick={() => setClearConfirmOpen(true)}
              variant="outline"
              className="flex items-center space-x-2 rounded-xl border-destructive/25 hover:border-destructive/40 hover:bg-destructive/10 text-destructive shadow-xs"
            >
              <Eraser className="h-4 w-4" />
              <span className="hidden sm:inline">Clear All</span>
            </Button>
          )}

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

      {/* Edit Mode Banner */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: undefined }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-start space-x-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300">
              <Edit3 className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Edit Mode Active</p>
                <p className="text-xs opacity-80 mt-0.5">
                  Tap any lecture card to edit it. Changes to subject, time, room, or teacher automatically sync with your attendance records.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                const isDeleting = deleteConfirm === entry.id;

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.25 }}
                  >
                    <Card
                      className={`border bg-gradient-to-br ${DAY_COLORS[dayIdx]} overflow-hidden transition-all ${
                        editMode && isOwned
                          ? 'cursor-pointer ring-2 ring-amber-400/30 hover:ring-amber-400/60 hover:shadow-lg'
                          : 'hover:shadow-md'
                      } ${isDeleting ? 'ring-2 ring-destructive/40' : ''} group`}
                      onClick={() => { if (editMode && isOwned) openEditDialog(entry); }}
                    >
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

                          {/* Right: Actions */}
                          {isOwned ? (
                            <div className={`flex items-center space-x-1 shrink-0 transition-opacity ${
                              editMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}>
                              {!editMode && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditDialog(entry); }}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {isDeleting ? (
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                                    className="px-2 py-1 rounded-md bg-destructive text-destructive-foreground text-[10px] font-bold cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                                    className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-[10px] font-bold cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(entry.id); }}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-0.5 rounded-md shrink-0">
                              Shared
                            </span>
                          )}

                          {/* Edit mode tap hint */}
                          {editMode && isOwned && !isDeleting && (
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md shrink-0">
                              Tap to edit
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
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
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
        description={
          editingEntry
            ? 'Update the details below. Changes sync automatically with your attendance records.'
            : 'Schedule a new class in your weekly timetable.'
        }
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

          {timeSlotsList.length === 0 ? (
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
              <span className="col-span-2 text-[9px] text-muted-foreground leading-none mt-0.5">Tip: Configure custom time slots in Settings to select them from a dropdown.</span>
            </div>
          ) : (
            <div className="flex flex-col space-y-1.5">
              <Select
                label="Time Slot"
                value={selectedSlotId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSlotId(val);
                  const matched = timeSlotsList.find(s => s.id === val);
                  if (matched) { setFormStartTime(matched.startTime); setFormEndTime(matched.endTime); }
                }}
                required
              >
                <option value="">Select Time Slot</option>
                {timeSlotsList.map((slot) => (
                  <option key={slot.id} value={slot.id}>{slot.label}</option>
                ))}
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Room <span className="text-muted-foreground">(optional)</span></label>
              <Input
                placeholder="e.g. Room 403"
                value={formRoom}
                onChange={(e) => setFormRoom(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-1.5 flex-1">
              {professorsList.length === 0 ? (
                <div className="flex flex-col space-y-1">
                  <label className="text-sm font-medium text-foreground/80">Teacher <span className="text-muted-foreground">(optional)</span></label>
                  <Input
                    placeholder="e.g. Prof. A. Shah"
                    value={formTeacher}
                    onChange={(e) => setFormTeacher(e.target.value)}
                  />
                  <span className="text-[9px] text-muted-foreground leading-none mt-0.5">Tip: Add professors in Settings to select from a dropdown.</span>
                </div>
              ) : (
                <Select
                  label="Teacher / Professor"
                  value={formTeacher}
                  onChange={(e) => setFormTeacher(e.target.value)}
                >
                  <option value="">Select Professor (optional)</option>
                  {professorsList.map((prof) => (
                    <option key={prof.id} value={prof.name}>{prof.name}</option>
                  ))}
                </Select>
              )}
            </div>
          </div>

          {/* Sync note */}
          {editingEntry && (
            <div className="flex items-center space-x-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <p className="text-[11px] font-medium">
                Your attendance records for this slot will automatically reflect these changes.
              </p>
            </div>
          )}

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

      {/* Clear Timetable Confirmation Dialog */}
      <Dialog
        isOpen={clearConfirmOpen}
        onClose={() => !clearing && setClearConfirmOpen(false)}
        title="Clear Custom Timetable"
        description="Are you sure you want to clear all custom lecture slots? This will also delete all linked attendance records. This action cannot be undone."
      >
        <div className="space-y-4 pt-2">
          <div className="flex justify-end space-x-2 pt-3 border-t border-border/40">
            <Button variant="ghost" onClick={() => setClearConfirmOpen(false)} disabled={clearing}>
              Cancel
            </Button>
            <Button onClick={handleClear} disabled={clearing} variant="destructive" className="min-w-[100px]">
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Clear All'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
