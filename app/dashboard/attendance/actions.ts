'use server';

import { db } from '@/database/db';
import { users, subjects, timetable, attendance, lectureOverrides } from '@/database/schema';
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

// Get today's or a previous date's timetable entries with their attendance status
// and any per-day lecture overrides (teacher / room / notes)
export async function getTodayAttendance(dateStr?: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!user.semesterId) return { success: false, error: 'Please complete onboarding first.' };

    let targetDateStr = dateStr;
    let dayOfWeek: number;

    if (targetDateStr) {
      // Parse YYYY-MM-DD
      const dateParts = targetDateStr.split('-').map(Number);
      // Create local date to avoid local offset shifting
      const d = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      const jsDay = d.getDay();
      dayOfWeek = jsDay === 0 ? 7 : jsDay;
    } else {
      const d = new Date();
      const jsDay = d.getDay();
      dayOfWeek = jsDay === 0 ? 7 : jsDay;
      targetDateStr = d.toISOString().split('T')[0]; // "YYYY-MM-DD"
    }

    // Fetch user's timetable for the target day of week
    const userConditions = [eq(timetable.userId, user.id)];
    if (user.classId) {
      userConditions.push(
        and(
          eq(timetable.classId, user.classId),
          isNull(timetable.userId)
        )!
      );
    }

    const [todayEntries, todayRecords, dayOverrides] = await Promise.all([
      // Timetable entries for this weekday
      db.query.timetable.findMany({
        where: and(
          eq(timetable.dayOfWeek, dayOfWeek),
          or(...userConditions)
        ),
        with: { subject: true },
        orderBy: [asc(timetable.startTime)],
      }),
      // Attendance records for the target date
      db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.userId, user.id),
            eq(attendance.date, targetDateStr)
          )
        ),
      // Lecture overrides for the target date
      db
        .select()
        .from(lectureOverrides)
        .where(
          and(
            eq(lectureOverrides.userId, user.id),
            eq(lectureOverrides.date, targetDateStr)
          )
        ),
    ]);

    // Merge timetable with attendance status + overrides
    const entriesWithStatus = todayEntries.map((entry) => {
      const record = todayRecords.find((r) => r.timetableId === entry.id);
      const override = dayOverrides.find((o) => o.timetableId === entry.id);
      return {
        ...entry,
        attendanceId: record?.id || null,
        attendanceStatus: record?.status || null, // 'present', 'absent', null
        // Override fields (null means use default from timetable)
        overrideTeacher: override?.teacher ?? null,
        overrideRoom: override?.room ?? null,
        overrideNotes: override?.notes ?? null,
        hasOverride: !!override,
      };
    });

    return { success: true, entries: entriesWithStatus, todayDate: targetDateStr };
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

// Save (upsert) a per-day lecture override
export async function saveLectureOverride(
  timetableId: string,
  date: string,
  data: { teacher?: string; room?: string; notes?: string }
) {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const existing = await db.query.lectureOverrides.findFirst({
      where: and(
        eq(lectureOverrides.userId, user.id),
        eq(lectureOverrides.timetableId, timetableId),
        eq(lectureOverrides.date, date)
      ),
    });

    const now = new Date();

    if (existing) {
      await db
        .update(lectureOverrides)
        .set({
          teacher: data.teacher ?? null,
          room: data.room ?? null,
          notes: data.notes ?? null,
          updatedAt: now,
        })
        .where(eq(lectureOverrides.id, existing.id));
    } else {
      await db.insert(lectureOverrides).values({
        userId: user.id,
        timetableId,
        date,
        teacher: data.teacher ?? null,
        room: data.room ?? null,
        notes: data.notes ?? null,
      });
    }

    revalidatePath('/dashboard/attendance');

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save lecture override.';
    console.error('Error in saveLectureOverride:', error);
    return { success: false, error: message };
  }
}

// Delete a per-day lecture override (resets lecture to its timetable defaults)
export async function deleteLectureOverride(timetableId: string, date: string) {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const existing = await db.query.lectureOverrides.findFirst({
      where: and(
        eq(lectureOverrides.userId, user.id),
        eq(lectureOverrides.timetableId, timetableId),
        eq(lectureOverrides.date, date)
      ),
    });

    if (existing) {
      await db.delete(lectureOverrides).where(eq(lectureOverrides.id, existing.id));
    }

    revalidatePath('/dashboard/attendance');

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reset lecture override.';
    console.error('Error in deleteLectureOverride:', error);
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

    // Fetch overrides for the dates present in history so we can show
    // the actual teacher/room that was in effect on each day
    const historyDates = [...new Set(filtered.map((r) => r.date))];
    const allOverrides = historyDates.length > 0
      ? await db
          .select()
          .from(lectureOverrides)
          .where(eq(lectureOverrides.userId, user.id))
      : [];

    const recordsWithOverrides = filtered.map((r) => {
      const override = allOverrides.find(
        (o) => o.timetableId === r.timetableId && o.date === r.date
      );
      return {
        ...r,
        overrideTeacher: override?.teacher ?? null,
        overrideRoom: override?.room ?? null,
        overrideNotes: override?.notes ?? null,
        hasOverride: !!override,
      };
    });

    return { success: true, records: recordsWithOverrides };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch history.';
    console.error('Error in getAttendanceHistory:', error);
    return { success: false, error: message };
  }
}
