'use server';

import { db } from '@/database/db';
import { users, subjects, timetable, batches } from '@/database/schema';
import { createClient } from '@/lib/supabase/server';
import { eq, and, or, asc, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { parseFileWithGemini } from '@/lib/gemini';

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

// AI scan and parse timetable image or PDF
export async function scanAndAddTimetable(formData: FormData) {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error('Unauthorized');
    if (!user.semesterId) throw new Error('Onboarding profile or semester not found.');

    const file = formData.get('file') as File;
    if (!file) throw new Error('No file uploaded.');

    // Fetch batch name if the user belongs to a lab batch
    let batchName = '';
    if (user.batchId) {
      const dbBatch = await db.query.batches.findFirst({
        where: eq(batches.id, user.batchId),
      });
      if (dbBatch) {
        batchName = dbBatch.name;
      }
    }

    const batchInstructions = batchName
      ? `The student belongs to **${batchName}** (sometimes referred to as Batch A, Batch B, Batch C, or Batch D). For any practicals/labs/workshops that are split by batches in the columns (e.g. columns under MONDAY/TUESDAY/etc. marked A, B, C, D):
- If the column matches **${batchName}**, extract it and mark its "isBatchSpecific" field as true.
- If it belongs to a different batch, DISCARD it completely. Do not include it.`
      : `The student does not belong to any specific lab batch. For batch-split classes, extract them normally, and set "isBatchSpecific" as false.`;

    const systemPrompt = `Analyze the provided college timetable document (image or PDF).
This is a weekly grid timetable. Study it carefully and extract all lecture/lab schedule slots.

### Layout Decoding Guide:
1. **Days of the week** are listed as column headers: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY.
2. **Time intervals** are listed in the first column:
   - "09:35 - 10:30"
   - "10:30 - 11:30"
   - "12:15 - 1:15"
   - "1:15 - 2:15"
   - "2:30 - 3:30"
   - "3:30 - 4:25"
   Note: "RECESS" rows are breaks, skip them.
3. **Classroom Location**: The default room is "Room 305" (from "Class Room No.:- 305" at the top).
4. **Subject Abbreviations**: Use the lookup table at the bottom left to get full subject names:
   - "MI" = "Microprocessor and Interfacing"
   - "PDS" = "Python for Data Science"
   - "DM" = "Data Mining Techniques"
   - "SS" = "System Software"
   - "CN" = "Computer Network"
   - "PM" = "Project Management"
5. **Teacher Initials**: Use the lookup table at the bottom center/right to get full teacher names:
   - "PDJ" = "Prof. Prexa Desai"
   - "JBS" = "Prof. Jayna Shah"
   - "PAP" = "Prof. Priyanka patel"
   - "MPP" or "MMP" = "Prof. Minal patel"
   - "NRS" = "Dr. Neha soni"
   - "HVC" = "Prof. Hetal Chauhan"
   - "MHS" = "Prof. Milind Shah"
   - "JP" = "Prof. Jeenal Patel"
6. **Class-Wide Lectures**:
   - These span the entire width of a day's column for a time slot.
   - Example: Monday 09:35 - 10:30 has "MI" as subject and "PDJ" as teacher. The room is "Room 305". "isBatchSpecific" is false.
7. **Batch-Specific Lab Sessions**:
   - Some slots are divided into columns labeled A, B, C, D representing student batches.
   - Inside each batch column, there is a subject code (top), a lab code (middle, e.g. F2, F1, F4, S2, S3, S4), and a teacher initial (bottom, e.g. PJD/PDJ, JBS, NRS).
   - Example: On Tuesday 12:15 - 1:15:
     - Batch A has "MI" lab in room "Lab F2" with teacher "PDJ" (mapped from PJD/PDJ).
     - Batch B has "PDS" lab in room "Lab F1" with teacher "JBS".
     - Batch C has "SS" lab in room "Lab F4" with teacher "NRS".

### Student Batch Filtering:
${batchInstructions}

Return a JSON array where each extracted slot matches this JSON structure:
[
  {
    "dayOfWeek": number, // 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday, 7 = Sunday
    "subject": "string", // Full subject name (expanded from abbreviation, e.g. "Microprocessor and Interfacing")
    "code": "string",    // Subject code (e.g. "MI", "PDS"), or null
    "startTime": "string", // "HH:MM" 24h format (e.g. "09:35" or "12:15")
    "endTime": "string",   // "HH:MM" 24h format (e.g. "10:30" or "13:15")
    "room": "string",      // Full room name (e.g. "Room 305" or "Lab F2")
    "teacher": "string",   // Full teacher name (expanded from initials, e.g. "Prof. Prexa Desai")
    "isBatchSpecific": boolean // true if it is a practical/lab session meant only for a specific batch, false otherwise
  }
]

Return ONLY a valid JSON array matching this format. Do not wrap in markdown or add explanations.`;

    const userPrompt = "Identify the weekly schedule classes, start times, end times, days, and subjects.";
    const parsedSlots = await parseFileWithGemini(file, systemPrompt, userPrompt);

    if (!Array.isArray(parsedSlots)) {
      throw new Error('AI failed to parse the timetable as a valid array.');
    }

    // Get current subjects to match
    const currentSubjects = await db
      .select()
      .from(subjects)
      .where(eq(subjects.semesterId, user.semesterId));

    const insertedEntries = [];

    for (const slot of parsedSlots) {
      if (!slot.subject || !slot.dayOfWeek || !slot.startTime || !slot.endTime) {
        continue; // skip malformed entries
      }

      // Find match
      let subjectId = '';
      const normSubjectName = slot.subject.toLowerCase().trim();
      const normSubjectCode = slot.code ? slot.code.toLowerCase().trim() : '';

      const match = currentSubjects.find(
        (s) =>
          s.name.toLowerCase().trim() === normSubjectName ||
          (s.code && s.code.toLowerCase().trim() === normSubjectCode) ||
          s.name.toLowerCase().includes(normSubjectName) ||
          normSubjectName.includes(s.name.toLowerCase())
      );

      if (match) {
        subjectId = match.id;
      } else {
        // Create subject dynamically if not found
        const [newSub] = await db
          .insert(subjects)
          .values({
            semesterId: user.semesterId,
            name: slot.subject,
            code: slot.code || null,
          })
          .returning();
        subjectId = newSub.id;
        // Add to list to avoid duplicate insertions
        currentSubjects.push(newSub);
      }

      // Insert timetable slot
      const [entry] = await db
        .insert(timetable)
        .values({
          userId: user.id,
          classId: user.classId || null,
          batchId: slot.isBatchSpecific ? (user.batchId || null) : null,
          subjectId,
          dayOfWeek: Number(slot.dayOfWeek),
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room || null,
          teacher: slot.teacher || null,
        })
        .returning();

      insertedEntries.push(entry);
    }

    revalidatePath('/dashboard/timetable');
    revalidatePath('/dashboard');

    return { success: true, count: insertedEntries.length };
  } catch (error: any) {
    console.error('Error in scanAndAddTimetable:', error);
    return { success: false, error: error.message || 'Failed to scan and parse timetable.' };
  }
}

