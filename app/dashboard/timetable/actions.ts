'use server';

import { db } from '@/database/db';
import { users, subjects, timetable, attendance, batches } from '@/database/schema';
import { createClient } from '@/lib/supabase/server';
import { eq, and, or, asc, isNull, lte, gte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

// Helper to get user + profile
async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  return dbUser ? { authId: user.id, ...dbUser } : null;
}

function getTodayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayDateStr(): string {
  return new Date(Date.now() - 86400000).toISOString().split('T')[0];
}

// Get all active timetable entries for the user (own entries + shared class entries)
export async function getUserTimetable() {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!user.semesterId) return { success: false, error: 'Please complete onboarding first.' };

    const todayStr = getTodayDateStr();

    // User's own active entries OR shared class-level active entries
    const userConditions = [eq(timetable.userId, user.id)];

    if (user.classId) {
      userConditions.push(
        and(
          eq(timetable.classId, user.classId),
          isNull(timetable.userId)
        )!
      );
    }

    const allEntries = await db.query.timetable.findMany({
      where: and(
        or(...userConditions),
        eq(timetable.isActive, true)
      ),
      with: {
        subject: true,
      },
      orderBy: [asc(timetable.dayOfWeek), asc(timetable.startTime)],
    });

    const entries = allEntries.filter((entry) => {
      if (!entry.effectiveUntil) return true;
      return entry.effectiveUntil.toString() >= todayStr;
    });

    return { success: true, entries };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch timetable.';
    console.error('Error in getUserTimetable:', error);
    return { success: false, error: message };
  }
}

// Get subjects for the user's semester (for add/edit dropdowns)
export async function getUserSubjects() {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!user.semesterId) return { success: false, error: 'Semester not configured.' };

    const semesterSubjects = await db
      .select()
      .from(subjects)
      .where(eq(subjects.semesterId, user.semesterId))
      .orderBy(asc(subjects.name));

    return { success: true, subjects: semesterSubjects };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch subjects.';
    console.error('Error in getUserSubjects:', error);
    return { success: false, error: message };
  }
}

// Add a new timetable entry
export interface TimetableEntryData {
  subjectId: string;
  dayOfWeek: number; // 1-7
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  room?: string;
  teacher?: string;
}

export async function addTimetableEntry(data: TimetableEntryData) {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const todayStr = getTodayDateStr();

    const [entry] = await db.insert(timetable).values({
      userId: user.id,
      classId: user.classId || null,
      batchId: user.batchId || null,
      subjectId: data.subjectId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      room: data.room || null,
      teacher: data.teacher || null,
      effectiveFrom: todayStr,
      effectiveUntil: null,
      isActive: true,
    }).returning();

    revalidatePath('/dashboard/timetable');
    revalidatePath('/dashboard');

    return { success: true, entry };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add entry.';
    console.error('Error in addTimetableEntry:', error);
    return { success: false, error: message };
  }
}

// Update an existing timetable entry (preserves historical attendance)
export async function updateTimetableEntry(id: string, data: Partial<TimetableEntryData>) {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    // Verify ownership
    const existing = await db.query.timetable.findFirst({
      where: and(eq(timetable.id, id), eq(timetable.userId, user.id)),
    });

    if (!existing) throw new Error('Entry not found or access denied.');

    // Check if there are past attendance records associated with this slot
    const pastAttendance = await db.query.attendance.findFirst({
      where: eq(attendance.timetableId, id),
    });

    const todayStr = getTodayDateStr();
    const yesterdayStr = getYesterdayDateStr();

    if (pastAttendance) {
      // Archive old slot to preserve historical attendance
      await db.update(timetable)
        .set({
          isActive: false,
          effectiveUntil: yesterdayStr,
        })
        .where(eq(timetable.id, id));

      // Create new active version with updated fields
      await db.insert(timetable).values({
        userId: user.id,
        classId: existing.classId,
        batchId: existing.batchId,
        subjectId: data.subjectId || existing.subjectId,
        dayOfWeek: data.dayOfWeek || existing.dayOfWeek,
        startTime: data.startTime || existing.startTime,
        endTime: data.endTime || existing.endTime,
        room: data.room !== undefined ? (data.room || null) : existing.room,
        teacher: data.teacher !== undefined ? (data.teacher || null) : existing.teacher,
        effectiveFrom: todayStr,
        effectiveUntil: null,
        isActive: true,
      });
    } else {
      // No past attendance, update in-place
      await db.update(timetable)
        .set({
          ...(data.subjectId && { subjectId: data.subjectId }),
          ...(data.dayOfWeek && { dayOfWeek: data.dayOfWeek }),
          ...(data.startTime && { startTime: data.startTime }),
          ...(data.endTime && { endTime: data.endTime }),
          ...(data.room !== undefined && { room: data.room || null }),
          ...(data.teacher !== undefined && { teacher: data.teacher || null }),
        })
        .where(eq(timetable.id, id));
    }

    revalidatePath('/dashboard/timetable');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update entry.';
    console.error('Error in updateTimetableEntry:', error);
    return { success: false, error: message };
  }
}

// Delete a timetable entry (soft-delete/archive if attendance exists to preserve past records)
export async function deleteTimetableEntry(id: string) {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    // Verify ownership
    const existing = await db.query.timetable.findFirst({
      where: and(eq(timetable.id, id), eq(timetable.userId, user.id)),
    });

    if (!existing) throw new Error('Entry not found or access denied.');

    const pastAttendance = await db.query.attendance.findFirst({
      where: eq(attendance.timetableId, id),
    });

    if (pastAttendance) {
      // Archive slot to preserve past attendance
      const yesterdayStr = getYesterdayDateStr();
      await db.update(timetable)
        .set({
          isActive: false,
          effectiveUntil: yesterdayStr,
        })
        .where(eq(timetable.id, id));
    } else {
      // Hard delete if no attendance attached
      await db.delete(timetable).where(eq(timetable.id, id));
    }

    revalidatePath('/dashboard/timetable');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete entry.';
    console.error('Error in deleteTimetableEntry:', error);
    return { success: false, error: message };
  }
}

// Clear all timetable entries owned by the user (preserves past attendance by archiving slots with attendance)
export async function clearUserTimetable() {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    const userEntries = await db.query.timetable.findMany({
      where: and(eq(timetable.userId, user.id), eq(timetable.isActive, true)),
    });

    const yesterdayStr = getYesterdayDateStr();

    for (const entry of userEntries) {
      const pastAttendance = await db.query.attendance.findFirst({
        where: eq(attendance.timetableId, entry.id),
      });

      if (pastAttendance) {
        await db.update(timetable)
          .set({
            isActive: false,
            effectiveUntil: yesterdayStr,
          })
          .where(eq(timetable.id, entry.id));
      } else {
        await db.delete(timetable).where(eq(timetable.id, entry.id));
      }
    }

    revalidatePath('/dashboard/timetable');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: any) {
    console.error('Error in clearUserTimetable:', error);
    return { success: false, error: error.message || 'Failed to clear timetable.' };
  }
}

