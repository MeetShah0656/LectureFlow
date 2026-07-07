'use server';

import { db } from '@/database/db';
import { users, settings, subjects, professors } from '@/database/schema';
import { createClient } from '@/lib/supabase/server';
import { eq, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const profile = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      with: {
        university: true,
        college: true,
        branch: true,
        semester: true,
        class: true,
        batch: true,
      },
    });

    const userSettings = await db.query.settings.findFirst({
      where: eq(settings.userId, user.id),
    });

    return { profile, settings: userSettings };
  } catch (error) {
    console.error('Failed to get profile from DB:', error);
    return null;
  }
}

export interface ProfileUpdateData {
  name: string;
  attendanceRequirement: number;
  academicYear: string;
  universityId: string;
  collegeId: string;
  branchId: string;
  semesterId: string;
  classId: string;
  batchId?: string | null;
}

export async function updateProfile(data: ProfileUpdateData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  await db.update(users)
    .set({
      name: data.name,
      attendanceRequirement: data.attendanceRequirement,
      academicYear: data.academicYear,
      universityId: data.universityId,
      collegeId: data.collegeId,
      branchId: data.branchId,
      semesterId: data.semesterId,
      classId: data.classId,
      batchId: data.batchId || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings');

  return { success: true };
}

export async function updateNotificationSettings(enabled: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  await db.insert(settings)
    .values({
      userId: user.id,
      notificationsEnabled: enabled,
    })
    .onConflictDoUpdate({
      target: settings.userId,
      set: {
        notificationsEnabled: enabled,
      },
    });

  revalidatePath('/dashboard/settings');
  return { success: true };
}

// Custom Subjects Actions
export async function getCustomSubjects() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    if (!dbUser || !dbUser.semesterId) return [];

    return await db
      .select()
      .from(subjects)
      .where(eq(subjects.semesterId, dbUser.semesterId))
      .orderBy(asc(subjects.name));
  } catch (error) {
    console.error('Error in getCustomSubjects:', error);
    return [];
  }
}

export async function addCustomSubject(name: string, code?: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    if (!dbUser || !dbUser.semesterId) throw new Error('Semester configuration not found.');

    const [newSubject] = await db
      .insert(subjects)
      .values({
        semesterId: dbUser.semesterId,
        name,
        code: code || null,
      })
      .returning();

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/timetable');
    revalidatePath('/dashboard/syllabus');

    return { success: true, subject: newSubject };
  } catch (error: any) {
    console.error('Error in addCustomSubject:', error);
    return { success: false, error: error.message || 'Failed to add subject.' };
  }
}

export async function deleteCustomSubject(subjectId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    await db.delete(subjects).where(eq(subjects.id, subjectId));

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/timetable');
    revalidatePath('/dashboard/syllabus');

    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteCustomSubject:', error);
    return { success: false, error: error.message || 'Failed to delete subject.' };
  }
}

// Professors/Teachers Actions
export async function getProfessors() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    return await db
      .select()
      .from(professors)
      .where(eq(professors.userId, user.id))
      .orderBy(asc(professors.name));
  } catch (error) {
    console.error('Error in getProfessors:', error);
    return [];
  }
}

export async function addProfessor(name: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const [newProf] = await db
      .insert(professors)
      .values({
        userId: user.id,
        name,
      })
      .returning();

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/timetable');

    return { success: true, professor: newProf };
  } catch (error: any) {
    console.error('Error in addProfessor:', error);
    return { success: false, error: error.message || 'Failed to add professor.' };
  }
}

export async function deleteProfessor(professorId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    await db.delete(professors).where(eq(professors.id, professorId));

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/timetable');

    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteProfessor:', error);
    return { success: false, error: error.message || 'Failed to delete professor.' };
  }
}
