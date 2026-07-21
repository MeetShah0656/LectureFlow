/**
 * Database Backup Script
 * Run: npx tsx database/backup.ts
 *
 * Exports timetable, attendance, and lecture_overrides to a timestamped JSON file.
 * To restore: npx tsx database/restore.ts backups/<filename>.json
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

const db = drizzle(pool, { schema });

async function backup() {
  console.log('🔒 Starting database backup...\n');

  try {
    const [
      timetableRows,
      attendanceRows,
      lectureOverrideRows,
      subjectRows,
      userRows,
    ] = await Promise.all([
      db.select().from(schema.timetable),
      db.select().from(schema.attendance),
      db.select().from(schema.lectureOverrides),
      db.select().from(schema.subjects),
      db.select().from(schema.users),
    ]);

    const backupData = {
      meta: {
        createdAt: new Date().toISOString(),
        counts: {
          timetable: timetableRows.length,
          attendance: attendanceRows.length,
          lectureOverrides: lectureOverrideRows.length,
          subjects: subjectRows.length,
          users: userRows.length,
        },
      },
      timetable: timetableRows,
      attendance: attendanceRows,
      lectureOverrides: lectureOverrideRows,
      subjects: subjectRows,
      users: userRows,
    };

    // Ensure backups directory exists
    const backupsDir = path.join(process.cwd(), 'database', 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup_${timestamp}.json`;
    const filepath = path.join(backupsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf-8');

    console.log('✅ Backup complete!\n');
    console.log(`📁 File: database/backups/${filename}`);
    console.log('\n📊 Rows backed up:');
    console.log(`   • timetable       : ${timetableRows.length} rows`);
    console.log(`   • attendance      : ${attendanceRows.length} rows`);
    console.log(`   • lectureOverrides: ${lectureOverrideRows.length} rows`);
    console.log(`   • subjects        : ${subjectRows.length} rows`);
    console.log(`   • users           : ${userRows.length} rows`);
    console.log('\nTo restore this backup later, run:');
    console.log(`   npx tsx database/restore.ts database/backups/${filename}\n`);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

backup();
