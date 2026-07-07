'use server';

import { db } from '@/database/db';
import { users, subjects, syllabus } from '@/database/schema';
import { createClient } from '@/lib/supabase/server';
import { eq, asc, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getSyllabusData() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (!dbUser || !dbUser.semesterId) {
      return { success: false, error: 'User onboarding profile or semester not found.' };
    }

    const semesterSubjects = await db
      .select()
      .from(subjects)
      .where(eq(subjects.semesterId, dbUser.semesterId));

    const subjectIds = semesterSubjects.map((sub) => sub.id);
    const allTopics = subjectIds.length > 0
      ? await db
          .select()
          .from(syllabus)
          .where(inArray(syllabus.subjectId, subjectIds))
          .orderBy(asc(syllabus.order))
      : [];

    const subjectsWithSyllabus = semesterSubjects.map((sub) => ({
      ...sub,
      topics: allTopics.filter((t) => t.subjectId === sub.id),
    }));

    return { success: true, subjects: subjectsWithSyllabus };
  } catch (error: any) {
    console.error('Error in getSyllabusData:', error);
    return { success: false, error: error.message || 'Failed to fetch syllabus data.' };
  }
}

export async function updateSyllabusTopicStatus(
  topicId: string,
  status: 'pending' | 'in_progress' | 'completed'
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    await db
      .update(syllabus)
      .set({ status })
      .where(eq(syllabus.id, topicId));

    revalidatePath('/dashboard/syllabus');
    revalidatePath('/dashboard');
    
    return { success: true };
  } catch (error: any) {
    console.error('Error in updateSyllabusTopicStatus:', error);
    return { success: false, error: error.message || 'Failed to update topic status.' };
  }
}



