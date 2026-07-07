'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  PlayCircle,
  TrendingUp,
  AlertCircle,
  Loader2,
  FileImage,
  FileText,
  Upload,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { getSyllabusData, updateSyllabusTopicStatus, scanAndAddSyllabus } from './actions';

interface Topic {
  id: string;
  subjectId: string;
  topic: string;
  description: string | null;
  status: string; // 'pending', 'in_progress', 'completed'
  order: number;
  createdAt: Date;
}

interface Subject {
  id: string;
  semesterId: string;
  name: string;
  code: string | null;
  createdAt: Date;
  topics: Topic[];
}

export default function SyllabusPage() {
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedSubject, setExpandedSubject] = React.useState<string | null>(null);

  // AI Scan states
  const [scanDialogOpen, setScanDialogOpen] = React.useState(false);
  const [scanFile, setScanFile] = React.useState<File | null>(null);
  const [scanning, setScanning] = React.useState(false);
  const [scanStatus, setScanStatus] = React.useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');
  const [scanError, setScanError] = React.useState('');
  const [scanCount, setScanCount] = React.useState(0);

  // Scan handlers
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanFile) return;

    setScanning(true);
    setScanStatus('analyzing');
    setScanError('');

    try {
      const formData = new FormData();
      formData.append('file', scanFile);

      const res = await scanAndAddSyllabus(formData);
      if (res.success) {
        setScanStatus('success');
        setScanCount(res.count || 0);
        // Reload syllabus data
        const loadRes = await getSyllabusData();
        if (loadRes.success && loadRes.subjects) {
          setSubjects(loadRes.subjects as Subject[]);
        }
      } else {
        setScanStatus('error');
        setScanError(res.error || 'Failed to parse the syllabus file.');
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

  React.useEffect(() => {
    async function loadData() {
      const res = await getSyllabusData();
      if (res.success && res.subjects) {
        setSubjects(res.subjects as Subject[]);
      } else {
        setError(res.error || 'Failed to load syllabus data.');
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedSubject((prev) => (prev === id ? null : id));
  };

  const handleStatusCycle = async (subjectId: string, topicId: string, currentStatus: string) => {
    // Cycle status: pending -> in_progress -> completed -> pending
    let nextStatus: 'pending' | 'in_progress' | 'completed';
    if (currentStatus === 'pending') nextStatus = 'in_progress';
    else if (currentStatus === 'in_progress') nextStatus = 'completed';
    else nextStatus = 'pending';

    // Optimistic Update
    setSubjects((prevSubjects) =>
      prevSubjects.map((sub) => {
        if (sub.id !== subjectId) return sub;
        return {
          ...sub,
          topics: sub.topics.map((t) => (t.id === topicId ? { ...t, status: nextStatus } : t)),
        };
      })
    );

    // Backend call
    const res = await updateSyllabusTopicStatus(topicId, nextStatus);
    if (!res.success) {
      console.error('Failed to update status on server:', res.error);
      // Revert status on failure
      setSubjects((prevSubjects) =>
        prevSubjects.map((sub) => {
          if (sub.id !== subjectId) return sub;
          return {
            ...sub,
            topics: sub.topics.map((t) => (t.id === topicId ? { ...t, status: currentStatus } : t)),
          };
        })
      );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading syllabus tracker...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center space-y-4 select-none">
        <div className="mx-auto p-3 bg-destructive/10 rounded-full w-fit text-destructive">
          <AlertCircle className="h-10 w-10" />
        </div>
        <h3 className="text-xl font-bold tracking-tight">Profile Not Completed</h3>
        <p className="text-sm text-muted-foreground">
          {error.includes('onboarding')
            ? 'Please complete the onboarding flow from the main page to choose your college syllabus.'
            : error}
        </p>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center space-y-4 select-none">
        <div className="mx-auto p-3 bg-muted rounded-full w-fit text-muted-foreground">
          <BookOpen className="h-10 w-10" />
        </div>
        <h3 className="text-xl font-bold tracking-tight">No Subjects Found</h3>
        <p className="text-sm text-muted-foreground">
          There are no subjects seeded in the database for your current semester.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl select-none animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Syllabus Tracker</h2>
          <p className="text-sm text-muted-foreground mt-1">Course progress and curriculum checkmarks</p>
        </div>
        <div className="flex items-center gap-3">
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
            <span>AI Import Syllabus</span>
          </Button>

          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full w-fit">
            <Sparkles className="h-3 w-3" />
            <span>Real-time Sync Active</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {subjects.map((sub) => {
          const completedCount = sub.topics.filter((t) => t.status === 'completed').length;
          const totalCount = sub.topics.length;
          const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          const isExpanded = expandedSubject === sub.id;

          return (
            <Card
              key={sub.id}
              className="border-border/60 bg-card/40 backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-border"
            >
              <div
                onClick={() => toggleExpand(sub.id)}
                className="p-6 cursor-pointer select-none flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/10 transition-colors"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-bold tracking-tight text-foreground">{sub.name}</span>
                    {sub.code && (
                      <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded-md">
                        {sub.code}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 w-full max-w-md">
                    <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-xs font-bold text-muted-foreground min-w-[32px]">
                      {progressPercentage}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-border/30">
                  <div className="text-left md:text-right">
                    <span className="text-xs text-muted-foreground block">Completed</span>
                    <span className="text-sm font-semibold text-foreground/80">
                      {completedCount} of {totalCount} Topics
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="border-t border-border/40 bg-muted/5"
                  >
                    <CardContent className="p-6 space-y-4">
                      {sub.topics.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No syllabus topics specified for this subject yet.
                        </p>
                      ) : (
                        <div className="divide-y divide-border/20">
                          {sub.topics.map((topic) => (
                            <div
                              key={topic.id}
                              className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
                            >
                              <div className="space-y-1">
                                <h4 className="text-sm font-semibold text-foreground">{topic.topic}</h4>
                                {topic.description && (
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {topic.description}
                                  </p>
                                )}
                              </div>

                              <button
                                onClick={() => handleStatusCycle(sub.id, topic.id, topic.status)}
                                className="flex items-center space-x-2 shrink-0 group focus:outline-none"
                              >
                                {topic.status === 'completed' && (
                                  <div className="flex items-center space-x-1.5 bg-success/10 border border-success/20 text-success text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full transition-all group-hover:bg-success/15">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Completed</span>
                                  </div>
                                )}
                                {topic.status === 'in_progress' && (
                                  <div className="flex items-center space-x-1.5 bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full transition-all group-hover:bg-primary/15 animate-pulse">
                                    <PlayCircle className="h-3 w-3" />
                                    <span>Active</span>
                                  </div>
                                )}
                                {topic.status === 'pending' && (
                                  <div className="flex items-center space-x-1.5 bg-muted border border-border text-muted-foreground text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full transition-all group-hover:bg-border/60">
                                    <Circle className="h-3 w-3" />
                                    <span>Pending</span>
                                  </div>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>

      {/* AI Syllabus Scanner Dialog */}
      <Dialog
        isOpen={scanDialogOpen}
        onClose={() => !scanning && setScanDialogOpen(false)}
        title="AI Syllabus Scanner"
        description="Upload an image or PDF of your syllabus. LectureFlow will use AI to extract all subjects and topics automatically."
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
                <h4 className="text-sm font-bold">AI is parsing your syllabus</h4>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Extracting subjects, codes, and detailed syllabus topics... This may take a few seconds.
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
                  AI successfully parsed and imported **{scanCount} syllabus topics** into your syllabus tracker!
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
