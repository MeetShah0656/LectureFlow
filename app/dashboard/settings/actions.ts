'use server';

import { db } from '@/database/db';
import { users, settings } from '@/database/schema';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const profile = await db.query.users.findFirst({
      where: eq(users.id, user.id),
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
