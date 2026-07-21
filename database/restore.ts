/**
 * Database Restore Script
 * Run: npx tsx database/restore.ts database/backups/<filename>.json
 *
 * Restores timetable, attendance, and lecture_overrides from a backup JSON file.
 * WARNING: This will UPSERT data — it won't delete rows that don't exist in the backup.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

const db = drizzle(pool, { schema });

async function restore() {
  const backupFile = process.argv[2];

  if (!backupFile) {
    console.error('❌ Please provide a backup file path.');
    console.error('   Usage: npx tsx database/restore.ts database/backups/<filename>.json');
    process.exit(1);
  }

  const filepath = path.resolve(process.cwd(), backupFile);

  if (!fs.existsSync(filepath)) {
    console.error(`❌ File not found: ${filepath}`);
    process.exit(1);
  }

  console.log(`🔄 Restoring from: ${backupFile}\n`);

  const raw = fs.readFileSync(filepath, 'utf-8');
  const data = JSON.parse(raw);

  console.log('📊 Backup metadata:');
  console.log(`   Created at : ${data.meta.createdAt}`);
  console.log(`   Rows:`)
  for (const [table, count] of Object.entries(data.meta.counts)) {
    console.log(`     • ${table.padEnd(18)}: ${count}`);
  }

  console.log('\n⚠️  This will UPSERT (insert or update) all rows from the backup.');
  console.log('   Rows not in the backup will NOT be deleted.');
  console.log('\nStarting restore in 3 seconds... (Ctrl+C to cancel)\n');

  await new Promise((res) => setTimeout(res, 3000));

  try {
    // Restore timetable
    if (data.timetable?.length > 0) {
      await db.insert(schema.timetable)
        .values(data.timetable)
        .onConflictDoUpdate({
          target: schema.timetable.id,
          set: {
            userId: sql`excluded.user_id`,
            classId: sql`excluded.class_id`,
            batchId: sql`excluded.batch_id`,
            subjectId: sql`excluded.subject_id`,
            dayOfWeek: sql`excluded.day_of_week`,
            startTime: sql`excluded.start_time`,
            endTime: sql`excluded.end_time`,
            room: sql`excluded.room`,
            teacher: sql`excluded.teacher`,
            effectiveFrom: sql`excluded.effective_from`,
            effectiveUntil: sql`excluded.effective_until`,
            isActive: sql`excluded.is_active`,
          },
        });
      console.log(`✅ timetable       restored (${data.timetable.length} rows)`);
    }

    // Restore attendance
    if (data.attendance?.length > 0) {
      await db.insert(schema.attendance)
        .values(data.attendance)
        .onConflictDoUpdate({
          target: schema.attendance.id,
          set: {
            status: sql`excluded.status`,
          },
        });
      console.log(`✅ attendance      restored (${data.attendance.length} rows)`);
    }

    // Restore lecture overrides
    if (data.lectureOverrides?.length > 0) {
      await db.insert(schema.lectureOverrides)
        .values(data.lectureOverrides)
        .onConflictDoUpdate({
          target: schema.lectureOverrides.id,
          set: {
            teacher: sql`excluded.teacher`,
            room: sql`excluded.room`,
            notes: sql`excluded.notes`,
            subjectId: sql`excluded.subject_id`,
          },
        });
      console.log(`✅ lectureOverrides restored (${data.lectureOverrides.length} rows)`);
    }

    console.log('\n🎉 Restore complete!\n');
  } catch (error) {
    console.error('\n❌ Restore failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

restore();
