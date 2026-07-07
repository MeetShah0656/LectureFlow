'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getProfile, updateProfile, updateNotificationSettings } from './actions';
import { User, Bell, Check, Loader2, GraduationCap } from 'lucide-react';
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

  // Read-only profile details state
  const [university, setUniversity] = React.useState('');
  const [college, setCollege] = React.useState('');
  const [branch, setBranch] = React.useState('');
  const [semester, setSemester] = React.useState('');
  const [className, setClassName] = React.useState('');
  const [batchName, setBatchName] = React.useState('');

  // Success indicator states
  const [profileSuccess, setProfileSuccess] = React.useState(false);
  const [notificationSuccess, setNotificationSuccess] = React.useState(false);

  React.useEffect(() => {
    async function loadSettings() {
      try {
        const data = await getProfile();
        if (data) {
          setName(data.profile?.name || '');
          setAcademicYear(data.profile?.academicYear || '');
          setAttendanceRequirement(data.profile?.attendanceRequirement || 75);
          setNotificationsEnabled(data.settings?.notificationsEnabled ?? true);
          
          setUniversity(data.profile?.university?.name || 'Not Configured');
          setCollege(data.profile?.college?.name || 'Not Configured');
          setBranch(data.profile?.branch?.name || 'Not Configured');
          setSemester(data.profile?.semester?.name || 'Not Configured');
          setClassName(data.profile?.class?.name || 'Not Configured');
          setBatchName(data.profile?.batch?.name || 'Class Wide (No Batch)');
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

      {/* Card 2: Academic Profile Details (Read Only) */}
      <Card className="border-border/60 bg-card/40 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center space-x-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <span>Academic Information</span>
          </CardTitle>
          <CardDescription>Your registered class, division, and batch details.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 select-none">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest block">University</span>
            <span className="text-sm font-semibold">{university}</span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest block">College</span>
            <span className="text-sm font-semibold">{college}</span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest block">Branch</span>
            <span className="text-sm font-semibold">{branch}</span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest block">Academic Scope</span>
            <span className="text-sm font-semibold">{semester} • {className}</span>
          </div>
          <div className="space-y-1 md:col-span-2">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest block">Registered Lab Batch</span>
            <span className="text-sm font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md inline-block mt-0.5">
              {batchName}
            </span>
          </div>
        </CardContent>
      </Card>

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
