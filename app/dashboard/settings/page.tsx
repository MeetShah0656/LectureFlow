'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { getProfile, updateProfile, updateNotificationSettings } from './actions';
import {
  getUniversities,
  getColleges,
  getBranches,
  getSemesters,
  getClasses,
  getBatches,
} from '@/app/onboarding/actions';
import { User, Bell, Check, Loader2, GraduationCap, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SettingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [updatingProfile, setUpdatingProfile] = React.useState(false);
  const [updatingNotifications, setUpdatingNotifications] = React.useState(false);
  
  // Profile settings state
  const [name, setName] = React.useState('');
  const [academicYear, setAcademicYear] = React.useState('');
  const [attendanceRequirement, setAttendanceRequirement] = React.useState(75);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);

  // Editable Dropdown IDs
  const [selectedUniv, setSelectedUniv] = React.useState('');
  const [selectedCol, setSelectedCol] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState('');
  const [selectedSem, setSelectedSem] = React.useState('');
  const [selectedClass, setSelectedClass] = React.useState('');
  const [selectedBatch, setSelectedBatch] = React.useState('');

  // Dropdown option lists
  const [univList, setUnivList] = React.useState<any[]>([]);
  const [colList, setColList] = React.useState<any[]>([]);
  const [branchList, setBranchList] = React.useState<any[]>([]);
  const [semList, setSemList] = React.useState<any[]>([]);
  const [classList, setClassList] = React.useState<any[]>([]);
  const [batchList, setBatchList] = React.useState<any[]>([]);

  // Success indicator states
  const [profileSuccess, setProfileSuccess] = React.useState(false);
  const [notificationSuccess, setNotificationSuccess] = React.useState(false);

  // Synchronous change handlers to update downstream selections
  const handleUnivChange = async (val: string) => {
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
    if (val) {
      try {
        const list = await getColleges(val);
        setColList(list);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleColChange = async (val: string) => {
    setSelectedCol(val);
    setSelectedBranch('');
    setBranchList([]);
    setSelectedSem('');
    setSemList([]);
    setSelectedClass('');
    setClassList([]);
    setSelectedBatch('');
    setBatchList([]);
    if (val) {
      try {
        const list = await getBranches(val);
        setBranchList(list);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleBranchChange = async (val: string) => {
    setSelectedBranch(val);
    setSelectedSem('');
    setSemList([]);
    setSelectedClass('');
    setClassList([]);
    setSelectedBatch('');
    setBatchList([]);
    if (val) {
      try {
        const list = await getSemesters(val);
        setSemList(list);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSemChange = async (val: string) => {
    setSelectedSem(val);
    setSelectedClass('');
    setClassList([]);
    setSelectedBatch('');
    setBatchList([]);
    if (val) {
      try {
        const list = await getClasses(val);
        setClassList(list);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleClassChange = async (val: string) => {
    setSelectedClass(val);
    setSelectedBatch('');
    setBatchList([]);
    if (val) {
      try {
        const list = await getBatches(val);
        setBatchList(list);
      } catch (err) {
        console.error(err);
      }
    }
  };

  React.useEffect(() => {
    async function loadSettings() {
      try {
        const data = await getProfile();
        if (data) {
          setName(data.profile?.name || '');
          setAcademicYear(data.profile?.academicYear || '');
          setAttendanceRequirement(data.profile?.attendanceRequirement || 75);
          setNotificationsEnabled(data.settings?.notificationsEnabled ?? true);
          
          const uId = data.profile?.universityId || '';
          const cId = data.profile?.collegeId || '';
          const bId = data.profile?.branchId || '';
          const sId = data.profile?.semesterId || '';
          const clId = data.profile?.classId || '';
          const btId = data.profile?.batchId || '';

          setSelectedUniv(uId);
          setSelectedCol(cId);
          setSelectedBranch(bId);
          setSelectedSem(sId);
          setSelectedClass(clId);
          setSelectedBatch(btId);

          // Parallel query loading lists
          const univs = await getUniversities();
          setUnivList(univs);

          const promises: Promise<any>[] = [];
          if (uId) promises.push(getColleges(uId).then(setColList));
          if (cId) promises.push(getBranches(cId).then(setBranchList));
          if (bId) promises.push(getSemesters(bId).then(setSemList));
          if (sId) promises.push(getClasses(sId).then(setClassList));
          if (clId) promises.push(getBatches(clId).then(setBatchList));

          await Promise.all(promises);
        }
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setProfileSuccess(false);
    try {
      await updateProfile({
        name,
        academicYear,
        attendanceRequirement: Number(attendanceRequirement),
        universityId: selectedUniv,
        collegeId: selectedCol,
        branchId: selectedBranch,
        semesterId: selectedSem,
        classId: selectedClass,
        batchId: selectedBatch || null,
      });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleToggleNotifications = async () => {
    setUpdatingNotifications(true);
    setNotificationSuccess(false);
    try {
      const nextState = !notificationsEnabled;
      await updateNotificationSettings(nextState);
      setNotificationsEnabled(nextState);
      setNotificationSuccess(true);
      setTimeout(() => setNotificationSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingNotifications(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col space-y-6 max-w-2xl select-none animate-pulse">
        <div className="h-8 bg-muted rounded-md w-1/4" />
        <div className="h-4 bg-muted rounded-md w-1/3" />
        <div className="h-64 bg-muted rounded-2xl w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl select-none animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your academic profile and application preferences</p>
      </div>

      {/* Card 1: Profile Info */}
      <form onSubmit={handleUpdateProfile}>
        <Card className="border-border/60 bg-card/40 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center space-x-2">
              <User className="h-4 w-4 text-primary" />
              <span>Student Profile</span>
            </CardTitle>
            <CardDescription>Update your name and course progress settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Full Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Academic Year</label>
                <Input
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="e.g. 2026-27"
                  required
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Attendance Goal (%)</label>
                <Input
                  type="number"
                  min="50"
                  max="100"
                  value={attendanceRequirement}
                  onChange={(e) => setAttendanceRequirement(Number(e.target.value))}
                  required
                />
              </div>
            </div>
            {/* Academic Selections */}
            <div className="border-t border-border/30 pt-4 mt-4 space-y-4">
              <h4 className="text-sm font-bold flex items-center space-x-2 text-foreground/90">
                <GraduationCap className="h-4 w-4 text-primary" />
                <span>Academic Scope Selection</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="University"
                  value={selectedUniv}
                  onChange={(e) => handleUnivChange(e.target.value)}
                  required
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
                  disabled={!selectedUniv}
                  required
                >
                  <option value="">Select College</option>
                  {colList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Branch / Department"
                  value={selectedBranch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  disabled={!selectedCol}
                  required
                >
                  <option value="">Select Branch</option>
                  {branchList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Semester"
                  value={selectedSem}
                  onChange={(e) => handleSemChange(e.target.value)}
                  disabled={!selectedBranch}
                  required
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
                  disabled={!selectedSem}
                  required
                >
                  <option value="">Select Class</option>
                  {classList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Lab Batch (Optional)"
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  disabled={!selectedClass}
                >
                  <option value="">Class Wide (No Batch)</option>
                  {batchList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-border/30 pt-4">
            <span className="text-xs text-muted-foreground">Changes propagate instantly to overview metrics.</span>
            <Button type="submit" disabled={updatingProfile} className="min-w-[110px]">
              {updatingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : profileSuccess ? (
                <div className="flex items-center space-x-1">
                  <Check className="h-4 w-4" />
                  <span>Saved</span>
                </div>
              ) : (
                <span>Save Changes</span>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Card 2: Notifications settings */}
      <Card className="border-border/60 bg-card/40 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center space-x-2">
            <Bell className="h-4 w-4 text-primary" />
            <span>Alerts & Notifications</span>
          </CardTitle>
          <CardDescription>Configure lecture and attendance warning alerts.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between py-4">
          <div className="space-y-0.5">
            <span className="text-sm font-semibold">Attendance Warning Alerts</span>
            <p className="text-xs text-muted-foreground">Notify me if my attendance drops below {attendanceRequirement}%</p>
          </div>
          <div className="flex items-center space-x-2">
            {updatingNotifications && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {notificationSuccess && <Check className="h-4 w-4 text-success" />}
            <button
              onClick={handleToggleNotifications}
              disabled={updatingNotifications}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                notificationsEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <motion.div
                layout
                className="bg-background w-4 h-4 rounded-full shadow-xs"
                animate={{ x: notificationsEnabled ? 20 : 0 }}
              />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
