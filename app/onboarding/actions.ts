'use server';

import { db } from '@/database/db';
import { universities, colleges, branches, semesters, classes, batches, users, settings } from '@/database/schema';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getUniversities() {
  return await db.select().from(universities);
}

export async function getColleges(universityId: string) {
  return await db.select().from(colleges).where(eq(colleges.universityId, universityId));
}

export async function getBranches(collegeId: string) {
  return await db.select().from(branches).where(eq(branches.collegeId, collegeId));
}

export async function getSemesters(branchId: string) {
  return await db.select().from(semesters).where(eq(semesters.branchId, branchId));
}

export async function getClasses(semesterId: string) {
  return await db.select().from(classes).where(eq(classes.semesterId, semesterId));
}

export async function getBatches(classId: string) {
  return await db.select().from(batches).where(eq(batches.classId, classId));
}

export interface OnboardingData {
  name: string;
  universityId: string;
  collegeId: string;
  branchId: string;
  semesterId: string;
  classId: string;
  batchId?: string;
  academicYear: string;
  attendanceRequirement: number;
}

export async function submitOnboarding(data: OnboardingData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Insert or update profile in users table
  await db.insert(users).values({
    id: user.id,
    email: user.email!,
    name: data.name,
    universityId: data.universityId,
    collegeId: data.collegeId,
    branchId: data.branchId,
    semesterId: data.semesterId,
    classId: data.classId,
    batchId: data.batchId || null,
    academicYear: data.academicYear,
    attendanceRequirement: data.attendanceRequirement,
    onboardingCompleted: true,
  }).onConflictDoUpdate({
    target: users.id,
    set: {
      name: data.name,
      universityId: data.universityId,
      collegeId: data.collegeId,
      branchId: data.branchId,
      semesterId: data.semesterId,
      classId: data.classId,
      batchId: data.batchId || null,
      academicYear: data.academicYear,
      attendanceRequirement: data.attendanceRequirement,
      onboardingCompleted: true,
      updatedAt: new Date(),
    }
  });

  // Create default settings for the user
  await db.insert(settings).values({
    userId: user.id,
    theme: 'system',
    notificationsEnabled: true,
  }).onConflictDoNothing({ target: settings.userId });

  // Set the onboarding completed cache cookie
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  cookieStore.set('onboarding_completed', 'true', {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  revalidatePath('/dashboard');
  revalidatePath('/');
  
  return { success: true };
}
