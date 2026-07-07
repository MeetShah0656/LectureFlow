'use server';

import { db } from '@/database/db';
import { users, subjects, timetable, attendance } from '@/database/schema';
import { createClient } from '@/lib/supabase/server';
import { eq, and, or, asc, desc, sql, isNull, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

// Helper to get auth user profile
async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  return dbUser ? { authId: user.id, ...dbUser } : null;
}

// Get today's timetable entries with their attendance status
export async function getTodayAttendance() {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!user.semesterId) return { success: false, error: 'Please complete onboarding first.' };

    // Get today's day of week (1=Mon, 7=Sun)
    const jsDay = new Date().getDay();
    const todayDayOfWeek = jsDay === 0 ? 7 : jsDay;
    const todayDate = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

    // Fetch user's timetable for today
    const conditions = [
      eq(timetable.dayOfWeek, todayDayOfWeek),
    ];

    const userConditions = [eq(timetable.userId, user.id)];
    if (user.classId) {
      userConditions.push(
        and(
          eq(timetable.classId, user.classId),
          isNull(timetable.userId)
        )!
      );
    }

    const todayEntries = await db.query.timetable.findMany({
      where: and(
        eq(timetable.dayOfWeek, todayDayOfWeek),
        or(...userConditions)
      ),
      with: { subject: true },
      orderBy: [asc(timetable.startTime)],
    });

    // Fetch attendance records for today
    const todayRecords = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.userId, user.id),
          eq(attendance.date, todayDate)
        )
      );

    // Merge timetable with attendance status
    const entriesWithStatus = todayEntries.map((entry) => {
      const record = todayRecords.find((r) => r.timetableId === entry.id);
      return {
        ...entry,
        attendanceId: record?.id || null,
        attendanceStatus: record?.status || null, // 'present', 'absent', null
      };
    });

    return { success: true, entries: entriesWithStatus, todayDate };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch attendance.';
    console.error('Error in getTodayAttendance:', error);
    return { success: false, error: message };
  }
}

// Mark attendance for a timetable entry on a specific date
export async function markAttendance(
  timetableId: string,
  date: string,
  status: 'present' | 'absent'
) {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    // Check if attendance record already exists
    const existing = await db.query.attendance.findFirst({
      where: and(
        eq(attendance.userId, user.id),
        eq(attendance.timetableId, timetableId),
        eq(attendance.date, date)
      ),
    });

    if (existing) {
      // Update existing record
      await db.update(attendance)
        .set({ status })
        .where(eq(attendance.id, existing.id));
    } else {
      // Create new record
      await db.insert(attendance).values({
        userId: user.id,
        timetableId,
        date,
        status,
      });
    }

    revalidatePath('/dashboard/attendance');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to mark attendance.';
    console.error('Error in markAttendance:', error);
    return { success: false, error: message };
  }
}

// Remove an attendance mark (unmark)
export async function unmarkAttendance(timetableId: string, date: string) {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const existing = await db.query.attendance.findFirst({
      where: and(
        eq(attendance.userId, user.id),
        eq(attendance.timetableId, timetableId),
        eq(attendance.date, date)
      ),
    });

    if (existing) {
      await db.delete(attendance).where(eq(attendance.id, existing.id));
    }

    revalidatePath('/dashboard/attendance');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to unmark attendance.';
    console.error('Error in unmarkAttendance:', error);
    return { success: false, error: message };
  }
}

// Get per-subject attendance statistics
export async function getAttendanceStats() {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!user.semesterId) return { success: false, error: 'Semester not configured.' };

    const userConditions = [eq(timetable.userId, user.id)];
    if (user.classId) {
      userConditions.push(
        and(
          eq(timetable.classId, user.classId),
          isNull(timetable.userId)
        )!
      );
    }

    // Run subjects and timetable queries in parallel
    const [semesterSubjects, userTimetable] = await Promise.all([
      db
        .select()
        .from(subjects)
        .where(eq(subjects.semesterId, user.semesterId))
        .orderBy(asc(subjects.name)),
      db.query.timetable.findMany({
        where: or(...userConditions),
      }),
    ]);

    const timetableIds = userTimetable.map((t) => t.id);

    // Get all attendance records for the user
    const allRecords = timetableIds.length > 0
      ? await db
          .select()
          .from(attendance)
          .where(eq(attendance.userId, user.id))
      : [];

    // Build per-subject stats
    const subjectStats = semesterSubjects.map((sub) => {
      const subTimetableIds = userTimetable
        .filter((t) => t.subjectId === sub.id)
        .map((t) => t.id);

      const subRecords = allRecords.filter((r) => subTimetableIds.includes(r.timetableId));
      const presentCount = subRecords.filter((r) => r.status === 'present').length;
      const absentCount = subRecords.filter((r) => r.status === 'absent').length;
      const totalMarked = presentCount + absentCount;
      const percentage = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;

      return {
        id: sub.id,
        name: sub.name,
        code: sub.code,
        present: presentCount,
        absent: absentCount,
        total: totalMarked,
        percentage,
      };
    });

    // Overall stats
    const totalPresent = subjectStats.reduce((sum, s) => sum + s.present, 0);
    const totalAbsent = subjectStats.reduce((sum, s) => sum + s.absent, 0);
    const totalMarked = totalPresent + totalAbsent;
    const overallPercentage = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 0;

    return {
      success: true,
      subjects: subjectStats,
      overall: {
        present: totalPresent,
        absent: totalAbsent,
        total: totalMarked,
        percentage: overallPercentage,
      },
      target: user.attendanceRequirement,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch stats.';
    console.error('Error in getAttendanceStats:', error);
    return { success: false, error: message };
  }
}

// Get attendance history with filtering
export async function getAttendanceHistory(subjectId?: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    // Get all attendance records, most recent first
    const records = await db.query.attendance.findMany({
      where: eq(attendance.userId, user.id),
      with: {
        timetable: {
          with: { subject: true },
        },
      },
      orderBy: [desc(attendance.date), desc(attendance.createdAt)],
      limit: 100,
    });

    // Filter by subject if specified
    const filtered = subjectId
      ? records.filter((r) => r.timetable?.subject?.id === subjectId)
      : records;

    return { success: true, records: filtered };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch history.';
    console.error('Error in getAttendanceHistory:', error);
    return { success: false, error: message };
  }
}
