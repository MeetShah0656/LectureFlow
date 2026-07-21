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
export async function getTodayAttendance(
  dateStr?: string,
  preloadedUser?: Awaited<ReturnType<typeof getAuthUser>>
) {
  try {
    const user = preloadedUser ?? await getAuthUser();
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

    const [rawAllDayEntries, todayRecords, dayOverrides] = await Promise.all([
      db
        .select({
          id: timetable.id,
          userId: timetable.userId,
          classId: timetable.classId,
          batchId: timetable.batchId,
          subjectId: timetable.subjectId,
          dayOfWeek: timetable.dayOfWeek,
          startTime: timetable.startTime,
          endTime: timetable.endTime,
          room: timetable.room,
          teacher: timetable.teacher,
          effectiveFrom: timetable.effectiveFrom,
          effectiveUntil: timetable.effectiveUntil,
          isActive: timetable.isActive,
          createdAt: timetable.createdAt,
          subId: subjects.id,
          subSemesterId: subjects.semesterId,
          subName: subjects.name,
          subCode: subjects.code,
          subCreatedAt: subjects.createdAt,
        })
        .from(timetable)
        .leftJoin(subjects, eq(timetable.subjectId, subjects.id))
        .where(
          and(
            eq(timetable.dayOfWeek, dayOfWeek),
            or(...userConditions)
          )
        )
        .orderBy(asc(timetable.startTime)),
      db.select().from(attendance).where(
        and(eq(attendance.userId, user.id), eq(attendance.date, targetDateStr))
      ),
      db.select().from(lectureOverrides).where(
        and(eq(lectureOverrides.userId, user.id), eq(lectureOverrides.date, targetDateStr))
      ),
    ]);

    // Filter entries active on targetDateStr
    const dateMatchedEntries = rawAllDayEntries
      .filter((entry) => {
        const from = entry.effectiveFrom ? entry.effectiveFrom.toString() : '1970-01-01';
        const until = entry.effectiveUntil ? entry.effectiveUntil.toString() : '9999-12-31';
        return from <= targetDateStr! && until >= targetDateStr!;
      })
      .map((e) => ({
        id: e.id,
        userId: e.userId,
        classId: e.classId,
        batchId: e.batchId,
        subjectId: e.subjectId,
        dayOfWeek: e.dayOfWeek,
        startTime: e.startTime,
        endTime: e.endTime,
        room: e.room,
        teacher: e.teacher,
        effectiveFrom: e.effectiveFrom,
        effectiveUntil: e.effectiveUntil,
        isActive: e.isActive,
        createdAt: e.createdAt,
        subject: e.subId
          ? {
              id: e.subId,
              semesterId: e.subSemesterId!,
              name: e.subName!,
              code: e.subCode,
              createdAt: e.subCreatedAt!,
            }
          : null,
      }));

    // Include any archived entries that have attendance marked on this specific date
    const existingEntryIds = new Set(dateMatchedEntries.map((e) => e.id));
    const extraTtIds = todayRecords
      .map((r) => r.timetableId)
      .filter((id) => !existingEntryIds.has(id));

    let extraEntries: typeof dateMatchedEntries = [];
    if (extraTtIds.length > 0) {
      const rawExtra = await db
        .select({
          id: timetable.id,
          userId: timetable.userId,
          classId: timetable.classId,
          batchId: timetable.batchId,
          subjectId: timetable.subjectId,
          dayOfWeek: timetable.dayOfWeek,
          startTime: timetable.startTime,
          endTime: timetable.endTime,
          room: timetable.room,
          teacher: timetable.teacher,
          effectiveFrom: timetable.effectiveFrom,
          effectiveUntil: timetable.effectiveUntil,
          isActive: timetable.isActive,
          createdAt: timetable.createdAt,
          subId: subjects.id,
          subSemesterId: subjects.semesterId,
          subName: subjects.name,
          subCode: subjects.code,
          subCreatedAt: subjects.createdAt,
        })
        .from(timetable)
        .leftJoin(subjects, eq(timetable.subjectId, subjects.id))
        .where(inArray(timetable.id, extraTtIds));

      extraEntries = rawExtra.map((e) => ({
        id: e.id,
        userId: e.userId,
        classId: e.classId,
        batchId: e.batchId,
        subjectId: e.subjectId,
        dayOfWeek: e.dayOfWeek,
        startTime: e.startTime,
        endTime: e.endTime,
        room: e.room,
        teacher: e.teacher,
        effectiveFrom: e.effectiveFrom,
        effectiveUntil: e.effectiveUntil,
        isActive: e.isActive,
        createdAt: e.createdAt,
        subject: e.subId
          ? {
              id: e.subId,
              semesterId: e.subSemesterId!,
              name: e.subName!,
              code: e.subCode,
              createdAt: e.subCreatedAt!,
            }
          : null,
      }));
    }

    let todayEntries = [...dateMatchedEntries, ...extraEntries].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );

    // ── Fallback: if no entries existed on this past date, use current active timetable ──
    // This handles the case where the timetable was empty on a past date (e.g. before
    // the user had set up their schedule) so they can still mark retroactive attendance.
    let usingFallback = false;
    const isPastDate = targetDateStr < new Date().toISOString().split('T')[0];
    if (todayEntries.length === 0 && isPastDate) {
      const rawFallback = await db
        .select({
          id: timetable.id,
          userId: timetable.userId,
          classId: timetable.classId,
          batchId: timetable.batchId,
          subjectId: timetable.subjectId,
          dayOfWeek: timetable.dayOfWeek,
          startTime: timetable.startTime,
          endTime: timetable.endTime,
          room: timetable.room,
          teacher: timetable.teacher,
          effectiveFrom: timetable.effectiveFrom,
          effectiveUntil: timetable.effectiveUntil,
          isActive: timetable.isActive,
          createdAt: timetable.createdAt,
          subId: subjects.id,
          subSemesterId: subjects.semesterId,
          subName: subjects.name,
          subCode: subjects.code,
          subCreatedAt: subjects.createdAt,
        })
        .from(timetable)
        .leftJoin(subjects, eq(timetable.subjectId, subjects.id))
        .where(
          and(
            eq(timetable.dayOfWeek, dayOfWeek),
            eq(timetable.isActive, true),
            or(...userConditions)
          )
        )
        .orderBy(asc(timetable.startTime));

      if (rawFallback.length > 0) {
        usingFallback = true;
        todayEntries = rawFallback.map((e) => ({
          id: e.id,
          userId: e.userId,
          classId: e.classId,
          batchId: e.batchId,
          subjectId: e.subjectId,
          dayOfWeek: e.dayOfWeek,
          startTime: e.startTime,
          endTime: e.endTime,
          room: e.room,
          teacher: e.teacher,
          effectiveFrom: e.effectiveFrom,
          effectiveUntil: e.effectiveUntil,
          isActive: e.isActive,
          createdAt: e.createdAt,
          subject: e.subId
            ? {
                id: e.subId,
                semesterId: e.subSemesterId!,
                name: e.subName!,
                code: e.subCode,
                createdAt: e.subCreatedAt!,
              }
            : null,
        }));
      }
    }

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

    return { success: true, entries: entriesWithStatus, todayDate: targetDateStr, usingFallback };
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

    // No revalidatePath — the client already updates state optimistically.
    // revalidatePath here would bust the server cache unnecessarily on every tap.
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

    // No revalidatePath — client state is already updated locally.
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
export async function getAttendanceStats(preloadedUser?: Awaited<ReturnType<typeof getAuthUser>>) {
  try {
    const user = preloadedUser ?? await getAuthUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!user.semesterId) return { success: false, error: 'Semester not configured.' };

    const userConditions = [eq(timetable.userId, user.id)];
    if (user.classId) {
      userConditions.push(
        and(eq(timetable.classId, user.classId), isNull(timetable.userId))!
      );
    }

    const [semesterSubjects, rawUserTimetable, allOverrides] = await Promise.all([
      db.select().from(subjects).where(eq(subjects.semesterId, user.semesterId)).orderBy(asc(subjects.name)),
      db
        .select({
          id: timetable.id,
          userId: timetable.userId,
          classId: timetable.classId,
          batchId: timetable.batchId,
          subjectId: timetable.subjectId,
          dayOfWeek: timetable.dayOfWeek,
          startTime: timetable.startTime,
          endTime: timetable.endTime,
          room: timetable.room,
          teacher: timetable.teacher,
          effectiveFrom: timetable.effectiveFrom,
          effectiveUntil: timetable.effectiveUntil,
          isActive: timetable.isActive,
          createdAt: timetable.createdAt,
          subId: subjects.id,
          subSemesterId: subjects.semesterId,
          subName: subjects.name,
          subCode: subjects.code,
          subCreatedAt: subjects.createdAt,
        })
        .from(timetable)
        .leftJoin(subjects, eq(timetable.subjectId, subjects.id))
        .where(or(...userConditions)),
      db.select().from(lectureOverrides).where(eq(lectureOverrides.userId, user.id)),
    ]);

    const userTimetable = rawUserTimetable.map((e) => ({
      id: e.id,
      userId: e.userId,
      classId: e.classId,
      batchId: e.batchId,
      subjectId: e.subjectId,
      dayOfWeek: e.dayOfWeek,
      startTime: e.startTime,
      endTime: e.endTime,
      room: e.room,
      teacher: e.teacher,
      effectiveFrom: e.effectiveFrom,
      effectiveUntil: e.effectiveUntil,
      isActive: e.isActive,
      createdAt: e.createdAt,
      subject: e.subId
        ? {
            id: e.subId,
            semesterId: e.subSemesterId!,
            name: e.subName!,
            code: e.subCode,
            createdAt: e.subCreatedAt!,
          }
        : null,
    }));

    const timetableIds = userTimetable.map((t) => t.id);

    const allRecords =
      timetableIds.length > 0
        ? await db.select().from(attendance).where(eq(attendance.userId, user.id))
        : [];

    function effectiveSubjectId(record: { timetableId: string; date: string }): string {
      const override = allOverrides.find(
        (o) => o.timetableId === record.timetableId && o.date === record.date && o.subjectId
      );
      if (override?.subjectId) return override.subjectId;
      return userTimetable.find((t) => t.id === record.timetableId)?.subjectId ?? '';
    }

    const subjectStats = semesterSubjects.map((sub) => {
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
// Fix: fetch overrides in PARALLEL with main query instead of sequentially
export async function getAttendanceHistory(user?: Awaited<ReturnType<typeof getAuthUser>>) {
  const authUser = user ?? await getAuthUser();
  if (!authUser) return { success: false, error: 'Unauthorized' };

  try {
    // Run main attendance query AND overrides fetch in parallel
    const [rawRecords, allOverrides] = await Promise.all([
      db
        .select({
          id: attendance.id,
          userId: attendance.userId,
          timetableId: attendance.timetableId,
          date: attendance.date,
          status: attendance.status,
          createdAt: attendance.createdAt,
          ttId: timetable.id,
          ttUserId: timetable.userId,
          ttClassId: timetable.classId,
          ttBatchId: timetable.batchId,
          ttSubjectId: timetable.subjectId,
          ttDayOfWeek: timetable.dayOfWeek,
          ttStartTime: timetable.startTime,
          ttEndTime: timetable.endTime,
          ttRoom: timetable.room,
          ttTeacher: timetable.teacher,
          ttEffectiveFrom: timetable.effectiveFrom,
          ttEffectiveUntil: timetable.effectiveUntil,
          ttIsActive: timetable.isActive,
          ttCreatedAt: timetable.createdAt,
          subId: subjects.id,
          subSemesterId: subjects.semesterId,
          subName: subjects.name,
          subCode: subjects.code,
          subCreatedAt: subjects.createdAt,
        })
        .from(attendance)
        .leftJoin(timetable, eq(attendance.timetableId, timetable.id))
        .leftJoin(subjects, eq(timetable.subjectId, subjects.id))
        .where(eq(attendance.userId, authUser.id))
        .orderBy(desc(attendance.date), desc(attendance.createdAt))
        .limit(100),
      db.select().from(lectureOverrides).where(eq(lectureOverrides.userId, authUser.id)),
    ]);

    const records = rawRecords.map((r) => ({
      id: r.id,
      userId: r.userId,
      timetableId: r.timetableId,
      date: r.date,
      status: r.status,
      createdAt: r.createdAt,
      timetable: r.ttId
        ? {
            id: r.ttId,
            userId: r.ttUserId,
            classId: r.ttClassId,
            batchId: r.ttBatchId,
            subjectId: r.ttSubjectId,
            dayOfWeek: r.ttDayOfWeek,
            startTime: r.ttStartTime,
            endTime: r.ttEndTime,
            room: r.ttRoom,
            teacher: r.ttTeacher,
            effectiveFrom: r.ttEffectiveFrom,
            effectiveUntil: r.ttEffectiveUntil,
            isActive: r.ttIsActive,
            createdAt: r.ttCreatedAt,
            subject: r.subId
              ? {
                  id: r.subId,
                  semesterId: r.subSemesterId!,
                  name: r.subName!,
                  code: r.subCode,
                  createdAt: r.subCreatedAt!,
                }
              : null,
          }
        : null,
    }));

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

    return { success: true, records: enriched };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch history.';
    console.error('Error in getAttendanceHistory:', error);
    return { success: false, error: message };
  }
}

// ─── COMBINED LOADER ──────────────────────────────────────────────────────────
// Authenticates ONCE, then fetches today's schedule + stats + history all in
// parallel. Replaces 3 separate server action calls (which each did auth
// independently = 6 network round-trips just for auth).
export async function getAllAttendanceData(dateStr?: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!user.semesterId) return { success: false, error: 'Please complete onboarding first.' };

    // Run all 3 fetches in true parallel — single auth overhead
    const [todayRes, statsRes, historyRes] = await Promise.all([
      getTodayAttendance(dateStr, user),
      getAttendanceStats(user),
      getAttendanceHistory(user),
    ]);

    return { success: true, todayRes, statsRes, historyRes };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load attendance data.';
    console.error('Error in getAllAttendanceData:', error);
    return { success: false, error: message };
  }
}
