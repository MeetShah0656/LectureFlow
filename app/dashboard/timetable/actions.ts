'use server';

import { db } from '@/database/db';
import { users, subjects, timetable } from '@/database/schema';
import { createClient } from '@/lib/supabase/server';
import { eq, and, or, asc, isNull } from 'drizzle-orm';
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

// Get all timetable entries for the user (own entries + shared class entries)
export async function getUserTimetable() {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!user.semesterId) return { success: false, error: 'Please complete onboarding first.' };

    // Get entries: user's own entries OR shared class-level entries (no userId, matching classId)
    const conditions = [eq(timetable.userId, user.id)];

    if (user.classId) {
      conditions.push(
        and(
          eq(timetable.classId, user.classId),
          isNull(timetable.userId)
        )!
      );
    }

    const entries = await db.query.timetable.findMany({
      where: or(...conditions),
      with: {
        subject: true,
      },
      orderBy: [asc(timetable.dayOfWeek), asc(timetable.startTime)],
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

// Update an existing timetable entry (only owner can update)
export async function updateTimetableEntry(id: string, data: Partial<TimetableEntryData>) {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    // Verify ownership
    const existing = await db.query.timetable.findFirst({
      where: and(eq(timetable.id, id), eq(timetable.userId, user.id)),
    });

    if (!existing) throw new Error('Entry not found or access denied.');

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

    revalidatePath('/dashboard/timetable');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update entry.';
    console.error('Error in updateTimetableEntry:', error);
    return { success: false, error: message };
  }
}

// Delete a timetable entry (only owner can delete)
export async function deleteTimetableEntry(id: string) {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');

    // Verify ownership
    const existing = await db.query.timetable.findFirst({
      where: and(eq(timetable.id, id), eq(timetable.userId, user.id)),
    });

    if (!existing) throw new Error('Entry not found or access denied.');

    await db.delete(timetable).where(eq(timetable.id, id));

    revalidatePath('/dashboard/timetable');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete entry.';
    console.error('Error in deleteTimetableEntry:', error);
    return { success: false, error: message };
  }
}
