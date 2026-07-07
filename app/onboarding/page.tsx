'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  getUniversities,
  getColleges,
  getBranches,
  getSemesters,
  getClasses,
  getBatches,
  submitOnboarding,
} from './actions';
import { GraduationCap, Sparkles, ChevronRight, ChevronLeft, Check } from 'lucide-react';

interface DropdownItem {
  id: string;
  name: string;
}

// Mock Fallbacks if database fetching fails (e.g. before DB setup)
const fallbackUniv = [{ id: 'mock-u1', name: 'Sardar Vallabhbhai Patel Institute of Technology (SVIT)' }];
const fallbackCol = [{ id: 'mock-c1', name: 'SVIT College of Engineering' }];
const fallbackBranches = [
  { id: 'mock-b1', name: 'Computer Engineering' },
  { id: 'mock-b2', name: 'Information Technology' },
  { id: 'mock-b3', name: 'Electronics & Communication' },
];
const fallbackSems = Array.from({ length: 8 }, (_, i) => ({ id: `mock-s${i + 1}`, name: `Semester ${i + 1}` }));
const fallbackClasses = [
  { id: 'mock-cls1', name: 'CE-1' },
  { id: 'mock-cls2', name: 'CE-2' },
  { id: 'mock-cls3', name: 'CE-3' },
  { id: 'mock-cls4', name: 'CE-4' },
];
const fallbackBatches = [
  { id: 'mock-bt1', name: 'Batch A' },
  { id: 'mock-bt2', name: 'Batch B' },
  { id: 'mock-bt3', name: 'Batch C' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [direction, setDirection] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State
  const [name, setName] = React.useState('');
  const [academicYear, setAcademicYear] = React.useState('2026-27');
  const [attendanceRequirement, setAttendanceRequirement] = React.useState(75);

  // Dropdown States
  const [selectedUniv, setSelectedUniv] = React.useState('');
  const [selectedCol, setSelectedCol] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState('');
  const [selectedSem, setSelectedSem] = React.useState('');
  const [selectedClass, setSelectedClass] = React.useState('');
  const [selectedBatch, setSelectedBatch] = React.useState('');

  // Dropdown Lists
  const [univList, setUnivList] = React.useState<DropdownItem[]>([]);
  const [colList, setColList] = React.useState<DropdownItem[]>([]);
  const [branchList, setBranchList] = React.useState<DropdownItem[]>([]);
  const [semList, setSemList] = React.useState<DropdownItem[]>([]);
  const [classList, setClassList] = React.useState<DropdownItem[]>([]);
  const [batchList, setBatchList] = React.useState<DropdownItem[]>([]);

  // Validation States
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Synchronous change handlers to update downstream selections
  const handleUnivChange = (val: string) => {
    setSelectedUniv(val);
    setSelectedCol('');
    setColList([]);
    setSelectedBranch('');
    setBranchList([]);
    setSelectedSem('');
    setSemList([]);
    setSelectedClass('');
    setClassList([]);
    setSelectedBatch('');
    setBatchList([]);
  };

  const handleColChange = (val: string) => {
    setSelectedCol(val);
    setSelectedBranch('');
    setBranchList([]);
    setSelectedSem('');
    setSemList([]);
    setSelectedClass('');
    setClassList([]);
    setSelectedBatch('');
    setBatchList([]);
  };

  const handleBranchChange = (val: string) => {
    setSelectedBranch(val);
    setSelectedSem('');
    setSemList([]);
    setSelectedClass('');
    setClassList([]);
    setSelectedBatch('');
    setBatchList([]);
  };

  const handleSemChange = (val: string) => {
    setSelectedSem(val);
    setSelectedClass('');
    setClassList([]);
    setSelectedBatch('');
    setBatchList([]);
  };

  const handleClassChange = (val: string) => {
    setSelectedClass(val);
    setSelectedBatch('');
    setBatchList([]);
  };

  // Load Universities on mount
  React.useEffect(() => {
    async function loadUniv() {
      try {
        const data = await getUniversities();
        if (data && data.length > 0) {
          setUnivList(data);
        } else {
          setUnivList(fallbackUniv);
        }
      } catch {
        setUnivList(fallbackUniv);
      }
    }
    loadUniv();
  }, []);

  // Load Colleges when University changes
  React.useEffect(() => {
    if (!selectedUniv) return;
    async function loadColleges() {
      await Promise.resolve();
      try {
        if (selectedUniv.startsWith('mock-')) {
          setColList(fallbackCol);
          return;
        }
        const data = await getColleges(selectedUniv);
        setColList(data.length > 0 ? data : fallbackCol);
      } catch {
        setColList(fallbackCol);
      }
    }
    loadColleges();
  }, [selectedUniv]);

  // Load Branches when College changes
  React.useEffect(() => {
    if (!selectedCol) return;
    async function loadBranches() {
      await Promise.resolve();
      try {
        if (selectedCol.startsWith('mock-')) {
          setBranchList(fallbackBranches);
          return;
        }
        const data = await getBranches(selectedCol);
        setBranchList(data.length > 0 ? data : fallbackBranches);
      } catch {
        setBranchList(fallbackBranches);
      }
    }
    loadBranches();
  }, [selectedCol]);

  // Load Semesters when Branch changes
  React.useEffect(() => {
    if (!selectedBranch) return;
    async function loadSemesters() {
      await Promise.resolve();
      try {
        if (selectedBranch.startsWith('mock-')) {
          setSemList(fallbackSems);
          return;
        }
        const data = await getSemesters(selectedBranch);
        setSemList(data.length > 0 ? data : fallbackSems);
      } catch {
        setSemList(fallbackSems);
      }
    }
    loadSemesters();
  }, [selectedBranch]);

  // Load Classes when Semester changes
  React.useEffect(() => {
    if (!selectedSem) return;
    async function loadClasses() {
      await Promise.resolve();
      try {
        if (selectedSem.startsWith('mock-')) {
          setClassList(fallbackClasses);
          return;
        }
        const data = await getClasses(selectedSem);
        setClassList(data.length > 0 ? data : fallbackClasses);
      } catch {
        setClassList(fallbackClasses);
      }
    }
    loadClasses();
  }, [selectedSem]);

  // Load Batches when Class changes
  React.useEffect(() => {
    if (!selectedClass) return;
    async function loadBatches() {
      await Promise.resolve();
      try {
        if (selectedClass.startsWith('mock-')) {
          setBatchList(fallbackBatches);
          return;
        }
        const data = await getBatches(selectedClass);
        setBatchList(data.length > 0 ? data : fallbackBatches);
      } catch {
        setBatchList(fallbackBatches);
      }
    }
    loadBatches();
  }, [selectedClass]);

  // Handle Next step validation
  const validateStep = () => {
    const tempErrors: Record<string, string> = {};

    if (step === 1) {
      if (!name.trim()) tempErrors.name = 'Your name is required';
      if (!selectedUniv) tempErrors.university = 'Please select your university';
      if (!selectedCol) tempErrors.college = 'Please select your college';
      if (!selectedBranch) tempErrors.branch = 'Please select your branch';
    } else if (step === 2) {
      if (!selectedSem) tempErrors.semester = 'Please select your semester';
      if (!selectedClass) tempErrors.class = 'Please select your class division';
      if (!academicYear.trim()) tempErrors.academicYear = 'Academic year is required';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      setDirection(1);
      setStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setDirection(-1);
    setStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setIsSubmitting(true);
    try {
      // Map mock values to UUID null value if it's mock
      const cleanData = {
        name,
        universityId: selectedUniv.startsWith('mock-') ? '00000000-0000-0000-0000-000000000000' : selectedUniv,
        collegeId: selectedCol.startsWith('mock-') ? '00000000-0000-0000-0000-000000000000' : selectedCol,
        branchId: selectedBranch.startsWith('mock-') ? '00000000-0000-0000-0000-000000000000' : selectedBranch,
        semesterId: selectedSem.startsWith('mock-') ? '00000000-0000-0000-0000-000000000000' : selectedSem,
        classId: selectedClass.startsWith('mock-') ? '00000000-0000-0000-0000-000000000000' : selectedClass,
        batchId: selectedBatch && !selectedBatch.startsWith('mock-') ? selectedBatch : undefined,
        academicYear,
        attendanceRequirement: Number(attendanceRequirement),
      };

      await submitOnboarding(cleanData);
      router.push('/dashboard');
    } catch (e) {
      console.error(e);
      // Even if database fails, redirect user to dashboard for demonstration/production fallback
      router.push('/dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Animation variants
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 100 : -100,
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-neutral-50 to-neutral-200 dark:from-neutral-950 dark:to-neutral-900 p-4 transition-colors duration-300">
      {/* Background grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <Card className="w-full max-w-xl border-border/80 bg-card/60 backdrop-blur-md shadow-2xl rounded-2xl relative z-10 overflow-hidden">
        {/* Top Progress bar */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-muted">
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <CardHeader className="pt-8">
          <div className="flex items-center space-x-2 text-xs font-semibold text-primary uppercase tracking-widest mb-1 select-none">
            <Sparkles className="h-3 w-3" />
            <span>Setup Assistant • Step {step} of 3</span>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight select-none">
            {step === 1 && 'Welcome to LectureFlow'}
            {step === 2 && 'Class Details'}
            {step === 3 && 'Set Your Target'}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground select-none">
            {step === 1 && 'Let’s configure your university and student profile.'}
            {step === 2 && 'Set your current semester division and academic schedules.'}
            {step === 3 && 'Adjust your attendance target preference.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="min-h-[300px] flex flex-col justify-center">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="space-y-4 py-2"
            >
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-sm font-medium text-foreground/80">Full Name</label>
                    <Input
                      placeholder="e.g. Meet Shah"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={errors.name ? 'border-destructive' : ''}
                    />
                    {errors.name && <span className="text-xs text-destructive">{errors.name}</span>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="University"
                      value={selectedUniv}
                      onChange={(e) => handleUnivChange(e.target.value)}
                      error={errors.university}
                    >
                      <option value="">Select University</option>
                      {univList.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>

                    <Select
                      label="College"
                      value={selectedCol}
                      onChange={(e) => handleColChange(e.target.value)}
                      error={errors.college}
                      disabled={!selectedUniv}
                    >
                      <option value="">Select College</option>
                      {colList.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <Select
                    label="Academic Branch"
                    value={selectedBranch}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    error={errors.branch}
                    disabled={!selectedCol}
                  >
                    <option value="">Select Branch</option>
                    {branchList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Semester"
                      value={selectedSem}
                      onChange={(e) => handleSemChange(e.target.value)}
                      error={errors.semester}
                    >
                      <option value="">Select Semester</option>
                      {semList.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>

                    <Select
                      label="Class / Division"
                      value={selectedClass}
                      onChange={(e) => handleClassChange(e.target.value)}
                      error={errors.class}
                      disabled={!selectedSem}
                    >
                      <option value="">Select Class</option>
                      {classList.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Lab Batch (Optional)"
                      value={selectedBatch}
                      onChange={(e) => setSelectedBatch(e.target.value)}
                      disabled={!selectedClass}
                    >
                      <option value="">Select Batch</option>
                      {batchList.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>

                    <div className="flex flex-col space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">Academic Year</label>
                      <Input
                        placeholder="e.g. 2026-27"
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        className={errors.academicYear ? 'border-destructive' : ''}
                      />
                      {errors.academicYear && (
                        <span className="text-xs text-destructive">{errors.academicYear}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8 flex flex-col justify-center items-center py-6 text-center">
                  <div className="p-4 bg-primary/10 rounded-full text-primary mb-2">
                    <GraduationCap className="h-12 w-12" />
                  </div>
                  
                  <div className="space-y-2 w-full max-w-sm">
                    <span className="text-5xl font-extrabold text-primary">{attendanceRequirement}%</span>
                    <p className="text-sm text-muted-foreground">Minimum attendance required by college regulations</p>
                  </div>

                  <div className="w-full max-w-md px-4 space-y-2">
                    <input
                      type="range"
                      min="50"
                      max="100"
                      step="5"
                      value={attendanceRequirement}
                      onChange={(e) => setAttendanceRequirement(Number(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground px-1">
                      <span>50%</span>
                      <span>75% (Recommended)</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>

        <CardFooter className="flex justify-between border-t border-border/40 pt-6">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={step === 1 || isSubmitting}
            className="flex items-center space-x-1"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>

          {step < 3 ? (
            <Button onClick={handleNext} className="flex items-center space-x-1">
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center space-x-1 min-w-[120px]"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <span>Complete</span>
                  <Check className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
