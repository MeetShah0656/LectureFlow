'use server';

import { db } from '@/database/db';
import { users, subjects, syllabus } from '@/database/schema';
import { createClient } from '@/lib/supabase/server';
import { eq, asc, inArray, and, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { parseFileWithGemini } from '@/lib/gemini';

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

// Helper to get db user
async function getDbUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });
}

// AI scan and parse syllabus image or PDF
export async function scanAndAddSyllabus(formData: FormData) {
  try {
    const user = await getDbUser();
    if (!user) throw new Error('Unauthorized');
    if (!user.semesterId) throw new Error('Onboarding profile or semester not found.');

    const file = formData.get('file') as File;
    if (!file) throw new Error('No file uploaded.');

    const systemPrompt = `Analyze the provided college syllabus document (image or PDF).
Extract the subjects and their respective topics. Match this JSON structure:
{
  "subjects": [
    {
      "name": "string",  // Name of the subject (e.g. "Software Engineering")
      "code": "string",  // Subject code if visible (e.g. "SE301"), or null
      "topics": [
        {
          "topic": "string",       // Topic / Unit name (e.g. "Unit 1: Software Process Models")
          "description": "string"  // Brief topic description, or null
        }
      ]
    }
  ]
}
Return ONLY a valid JSON object matching this structure. Do not wrap in markdown or add explanations.`;

    const userPrompt = "Identify the subjects, codes, and their lists of syllabus topics/units.";
    const result = await parseFileWithGemini(file, systemPrompt, userPrompt);

    if (!result || !Array.isArray(result.subjects)) {
      throw new Error('AI failed to parse the syllabus into subjects list.');
    }

    let topicsCount = 0;

    for (const sub of result.subjects) {
      if (!sub.name) continue;

      // Find or create subject
      let subjectId = '';
      const normName = sub.name.toLowerCase().trim();
      const normCode = sub.code ? sub.code.toLowerCase().trim() : '';

      const existingSubject = await db.query.subjects.findFirst({
        where: and(
          eq(subjects.semesterId, user.semesterId),
          or(
            eq(subjects.name, sub.name),
            sub.code ? eq(subjects.code, sub.code) : undefined
          )
        ),
      });

      if (existingSubject) {
        subjectId = existingSubject.id;
      } else {
        const [newSub] = await db
          .insert(subjects)
          .values({
            semesterId: user.semesterId,
            name: sub.name,
            code: sub.code || null,
          })
          .returning();
        subjectId = newSub.id;
      }

      // Add syllabus topics
      if (Array.isArray(sub.topics)) {
        // Get existing syllabus topics for this subject to compute order
        const existingTopics = await db
          .select()
          .from(syllabus)
          .where(eq(syllabus.subjectId, subjectId));

        let currentOrder = existingTopics.length;

        for (const t of sub.topics) {
          if (!t.topic) continue;

          // Check if topic already exists to prevent duplicate insertion
          const duplicate = existingTopics.find(
            (et) => et.topic.toLowerCase().trim() === t.topic.toLowerCase().trim()
          );
          if (duplicate) continue;

          currentOrder++;
          await db.insert(syllabus).values({
            subjectId,
            topic: t.topic,
            description: t.description || null,
            status: 'pending',
            order: currentOrder,
          });
          topicsCount++;
        }
      }
    }

    revalidatePath('/dashboard/syllabus');
    revalidatePath('/dashboard');

    return { success: true, count: topicsCount };
  } catch (error: any) {
    console.error('Error in scanAndAddSyllabus:', error);
    return { success: false, error: error.message || 'Failed to scan and parse syllabus.' };
  }
}

