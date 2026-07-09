import * as React from 'react';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/database/db';
import { users, timetable, attendance } from '@/database/schema';
import { eq, and, or, asc, desc, isNull } from 'drizzle-orm';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  // ── Defaults ──────────────────────────────────────────────────────────────
  let profileName = 'Student';
  let targetAttendance = 75;
  let academicYearStr = '2026-27';
  let branchName = 'Computer Engineering';
  let universityName = 'SVIT';
  let overallPercentage = 0;
  let totalPresent = 0;
  let totalAbsent = 0;

  // All timetable entries per weekday (1–7), keyed by dayOfWeek
  // We fetch ALL days so the client can pick the correct local day
  let allTimetableEntries: {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string | null;
    teacher: string | null;
    subject: { id: string; name: string; code: string | null } | null;
  }[] = [];

  // Today's attendance records (we'll send the date string from the client too,
  // but for the initial render we fetch today in UTC — client will re-derive if needed)
  let attendanceByTimetableId: Record<string, string> = {}; // timetableId → status

  let recentActivity: {
    id: string;
    action: string;
    details: string;
    createdAt: string; // ISO string — client formats relative time
  }[] = [];

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const dbProfile = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        with: { university: true, branch: true },
      });

      if (dbProfile) {
        profileName = dbProfile.name || user.email?.split('@')[0] || profileName;
        targetAttendance = dbProfile.attendanceRequirement;
        academicYearStr = dbProfile.academicYear || academicYearStr;
        if (dbProfile.branch) branchName = dbProfile.branch.name;
        if (dbProfile.university) universityName = dbProfile.university.name;

        // Conditions to find this user's timetable entries
        const userConditions = [eq(timetable.userId, user.id)];
        if (dbProfile.classId) {
          userConditions.push(
            and(eq(timetable.classId, dbProfile.classId), isNull(timetable.userId))!
          );
        }

        const [timetableEntries, allRecords, recentRecords] = await Promise.all([
          // Fetch ALL days so client can pick the right local day
          db.query.timetable.findMany({
            where: or(...userConditions),
            with: { subject: true },
            orderBy: [asc(timetable.startTime)],
          }),
          // All attendance records for overall stats
          db.select().from(attendance).where(eq(attendance.userId, user.id)),
          // Last 5 records for recent activity
          db.query.attendance.findMany({
            where: eq(attendance.userId, user.id),
            with: { timetable: { with: { subject: true } } },
            orderBy: [desc(attendance.createdAt)],
            limit: 5,
          }),
        ]);

        allTimetableEntries = timetableEntries.map((e) => ({
          id: e.id,
          dayOfWeek: e.dayOfWeek,
          startTime: e.startTime,
          endTime: e.endTime,
          room: e.room,
          teacher: e.teacher,
          subject: e.subject
            ? { id: e.subject.id, name: e.subject.name, code: e.subject.code }
            : null,
        }));

        // Build attendance lookup
        allRecords.forEach((r) => {
          // We store the most recent status per timetableId (across all dates)
          // Client will filter by date after knowing local today
          attendanceByTimetableId[r.timetableId] = r.status;
        });

        // Build a proper lookup: (timetableId, date) → status
        // Send the raw records so client can filter by local date
        const todayAttendanceMap: Record<string, Record<string, string>> = {};
        allRecords.forEach((r) => {
          if (!todayAttendanceMap[r.date]) todayAttendanceMap[r.date] = {};
          todayAttendanceMap[r.date][r.timetableId] = r.status;
        });

        // Overall stats
        const presentCount = allRecords.filter((r) => r.status === 'present').length;
        const absentCount = allRecords.filter((r) => r.status === 'absent').length;
        const totalMarked = presentCount + absentCount;
        totalPresent = presentCount;
        totalAbsent = absentCount;
        overallPercentage = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;

        recentActivity = recentRecords.map((r) => ({
          id: r.id,
          action: r.status === 'present' ? 'Marked Present' : 'Marked Absent',
          details: r.timetable?.subject?.name || 'Unknown Subject',
          createdAt: r.createdAt.toISOString(),
        }));

        // Replace attendanceByTimetableId with the full per-date map stringified
        // We pass it as a JSON string prop to avoid complex typing
        attendanceByTimetableId = Object.fromEntries(
          allRecords.map((r) => [`${r.timetableId}__${r.date}`, r.status])
        );
      }
    }
  } catch {
    console.warn('Dashboard profile query bypassed/failed, rendering default profile.');
  }

  return (
    <DashboardClient
      profileName={profileName}
      targetAttendance={targetAttendance}
      academicYearStr={academicYearStr}
      branchName={branchName}
      universityName={universityName}
      overallPercentage={overallPercentage}
      totalPresent={totalPresent}
      totalAbsent={totalAbsent}
      allTimetableEntries={allTimetableEntries}
      attendanceRecords={attendanceByTimetableId}
      recentActivity={recentActivity}
    />
  );
}
