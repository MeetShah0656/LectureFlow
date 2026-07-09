'use server';

import { db } from '@/database/db';
import { users, subjects, timetable, attendance, lectureOverrides } from '@/database/schema';
import { createClient } from '@/lib/supabase/server';
import { eq, and, or, asc, desc, isNull, inArray } from 'drizzle-orm';
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

// Get today's or a previous date's timetable entries with attendance status,
// per-day overrides (teacher / room / notes / subject)
export async function getTodayAttendance(dateStr?: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!user.semesterId) return { success: false, error: 'Please complete onboarding first.' };

    let targetDateStr = dateStr;
    let dayOfWeek: number;

    if (targetDateStr) {
      const dateParts = targetDateStr.split('-').map(Number);
      const d = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      const jsDay = d.getDay();
      dayOfWeek = jsDay === 0 ? 7 : jsDay;
    } else {
      const d = new Date();
      const jsDay = d.getDay();
      dayOfWeek = jsDay === 0 ? 7 : jsDay;
      targetDateStr = d.toISOString().split('T')[0];
    }

    const userConditions = [eq(timetable.userId, user.id)];
    if (user.classId) {
      userConditions.push(
        and(eq(timetable.classId, user.classId), isNull(timetable.userId))!
      );
    }

    const [todayEntries, todayRecords, dayOverrides] = await Promise.all([
      db.query.timetable.findMany({
        where: and(eq(timetable.dayOfWeek, dayOfWeek), or(...userConditions)),
        with: { subject: true },
        orderBy: [asc(timetable.startTime)],
      }),
      db.select().from(attendance).where(
        and(eq(attendance.userId, user.id), eq(attendance.date, targetDateStr))
      ),
      db.select().from(lectureOverrides).where(
        and(eq(lectureOverrides.userId, user.id), eq(lectureOverrides.date, targetDateStr))
      ),
    ]);

    // Resolve any override subjects
    const overrideSubjectIds = [
      ...new Set(dayOverrides.map((o) => o.subjectId).filter((id): id is string => !!id)),
    ];
    const overrideSubjectList =
      overrideSubjectIds.length > 0
        ? await db.select().from(subjects).where(inArray(subjects.id, overrideSubjectIds))
        : [];

    // Merge timetable with attendance + overrides
    const entriesWithStatus = todayEntries.map((entry) => {
      const record = todayRecords.find((r) => r.timetableId === entry.id);
      const override = dayOverrides.find((o) => o.timetableId === entry.id);
      const overrideSubject = override?.subjectId
        ? (overrideSubjectList.find((s) => s.id === override.subjectId) ?? null)
        : null;
      return {
        ...entry,
        attendanceId: record?.id || null,
        attendanceStatus: record?.status || null,
        overrideTeacher: override?.teacher ?? null,
        overrideRoom: override?.room ?? null,
        overrideNotes: override?.notes ?? null,
        overrideSubjectId: override?.subjectId ?? null,
        overrideSubject,
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

    const existing = await db.query.attendance.findFirst({
      where: and(
        eq(attendance.userId, user.id),
        eq(attendance.timetableId, timetableId),
        eq(attendance.date, date)
      ),
    });

    if (existing) {
      await db.update(attendance).set({ status }).where(eq(attendance.id, existing.id));
    } else {
      await db.insert(attendance).values({ userId: user.id, timetableId, date, status });
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

// Save (upsert) a per-day lecture override (teacher, room, notes, and/or subject)
export async function saveLectureOverride(
  timetableId: string,
  date: string,
  data: { teacher?: string; room?: string; notes?: string; subjectId?: string }
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

    const payload = {
      teacher: data.teacher?.trim() || null,
      room: data.room?.trim() || null,
      notes: data.notes?.trim() || null,
      subjectId: data.subjectId || null,
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(lectureOverrides).set(payload).where(eq(lectureOverrides.id, existing.id));
    } else {
      await db.insert(lectureOverrides).values({
        userId: user.id,
        timetableId,
        date,
        ...payload,
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

// Delete a per-day lecture override (resets lecture to timetable defaults)
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

// Get per-subject attendance statistics — respects subject overrides
export async function getAttendanceStats() {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!user.semesterId) return { success: false, error: 'Semester not configured.' };

    const userConditions = [eq(timetable.userId, user.id)];
    if (user.classId) {
      userConditions.push(
        and(eq(timetable.classId, user.classId), isNull(timetable.userId))!
      );
    }

    const [semesterSubjects, userTimetable, allOverrides] = await Promise.all([
      db.select().from(subjects).where(eq(subjects.semesterId, user.semesterId)).orderBy(asc(subjects.name)),
      db.query.timetable.findMany({ where: or(...userConditions) }),
      // Fetch overrides that have a subject override — used to remap attendance counts
      db.select().from(lectureOverrides).where(eq(lectureOverrides.userId, user.id)),
    ]);

    const timetableIds = userTimetable.map((t) => t.id);

    const allRecords =
      timetableIds.length > 0
        ? await db.select().from(attendance).where(eq(attendance.userId, user.id))
        : [];

    // Helper: resolve the effective subjectId for a given attendance record
    // If there's an override with a different subjectId for that (timetableId, date), use it
    function effectiveSubjectId(record: { timetableId: string; date: string }): string {
      const override = allOverrides.find(
        (o) => o.timetableId === record.timetableId && o.date === record.date && o.subjectId
      );
      if (override?.subjectId) return override.subjectId;
      return userTimetable.find((t) => t.id === record.timetableId)?.subjectId ?? '';
    }

    const subjectStats = semesterSubjects.map((sub) => {
      // Count all attendance records whose effective subject is this subject
      const subRecords = allRecords.filter((r) => effectiveSubjectId(r) === sub.id);
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

    const totalPresent = subjectStats.reduce((sum, s) => sum + s.present, 0);
    const totalAbsent = subjectStats.reduce((sum, s) => sum + s.absent, 0);
    const totalMarked = totalPresent + totalAbsent;
    const overallPercentage = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 0;

    return {
      success: true,
      subjects: subjectStats,
      overall: { present: totalPresent, absent: totalAbsent, total: totalMarked, percentage: overallPercentage },
      target: user.attendanceRequirement,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch stats.';
    console.error('Error in getAttendanceStats:', error);
    return { success: false, error: message };
  }
}

// Get attendance history — includes override subject info for past records
export async function getAttendanceHistory(subjectId?: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const records = await db.query.attendance.findMany({
      where: eq(attendance.userId, user.id),
      with: { timetable: { with: { subject: true } } },
      orderBy: [desc(attendance.date), desc(attendance.createdAt)],
      limit: 100,
    });

    // Fetch all overrides for this user
    const allOverrides =
      records.length > 0
        ? await db.select().from(lectureOverrides).where(eq(lectureOverrides.userId, user.id))
        : [];

    // Resolve unique override subject IDs
    const overrideSubjectIds = [
      ...new Set(allOverrides.map((o) => o.subjectId).filter((id): id is string => !!id)),
    ];
    const overrideSubjectList =
      overrideSubjectIds.length > 0
        ? await db.select().from(subjects).where(inArray(subjects.id, overrideSubjectIds))
        : [];

    const enriched = records.map((r) => {
      const override = allOverrides.find((o) => o.timetableId === r.timetableId && o.date === r.date);
      const overrideSubject = override?.subjectId
        ? (overrideSubjectList.find((s) => s.id === override.subjectId) ?? null)
        : null;
      return {
        ...r,
        overrideTeacher: override?.teacher ?? null,
        overrideRoom: override?.room ?? null,
        overrideNotes: override?.notes ?? null,
        overrideSubjectId: override?.subjectId ?? null,
        overrideSubject,
        hasOverride: !!override,
      };
    });

    // Filter by effective subject (uses override subject if set)
    const filtered = subjectId
      ? enriched.filter((r) => {
          const effectiveSub = r.overrideSubjectId ?? r.timetable?.subject?.id;
          return effectiveSub === subjectId;
        })
      : enriched;

    return { success: true, records: filtered };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch history.';
    console.error('Error in getAttendanceHistory:', error);
    return { success: false, error: message };
  }
}
