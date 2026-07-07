import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { config } from 'dotenv';

config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Please set the DATABASE_URL environment variable in your .env file or environment.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
});

const db = drizzle(pool, { schema });

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Clear all existing tables to prevent duplicate keys and orphaned records
    console.log('Clearing all existing database tables...');
    await db.delete(schema.attendance);
    await db.delete(schema.timetable);
    await db.delete(schema.syllabus);
    await db.delete(schema.subjects);
    await db.delete(schema.settings);
    await db.delete(schema.notifications);
    await db.delete(schema.users);
    await db.delete(schema.batches);
    await db.delete(schema.classes);
    await db.delete(schema.semesters);
    await db.delete(schema.branches);
    await db.delete(schema.colleges);
    await db.delete(schema.universities);

    // 1. Seed University
    console.log('Inserting default university...');
    const [svitUniv] = await db.insert(schema.universities).values({
      name: 'Sardar Vallabhbhai Patel Institute of Technology (SVIT)',
    }).onConflictDoNothing({ target: schema.universities.name }).returning();

    const universityId = svitUniv?.id || (await db.query.universities.findFirst({
      where: (u, { eq }) => eq(u.name, 'Sardar Vallabhbhai Patel Institute of Technology (SVIT)'),
    }))?.id;

    if (!universityId) {
      throw new Error('Failed to find or create the default university.');
    }

    // 2. Seed College
    console.log('Inserting default college...');
    const collegesToInsert = [
      { name: 'SVIT College of Engineering', universityId },
    ];
    
    let collegeId: string | undefined;
    for (const c of collegesToInsert) {
      const [inserted] = await db.insert(schema.colleges).values(c).returning();
      collegeId = inserted?.id;
    }

    if (!collegeId) {
      collegeId = (await db.query.colleges.findFirst({
        where: (col, { eq }) => eq(col.name, 'SVIT College of Engineering'),
      }))?.id;
    }

    if (!collegeId) {
      throw new Error('Failed to find or create the default college.');
    }

    // 3. Seed Branches
    console.log('Inserting branches...');
    const branchesList = [
      'Computer Engineering',
      'Information Technology',
      'Electronics & Communication',
      'Mechanical Engineering',
      'Civil Engineering',
      'Electrical Engineering',
    ];

    for (const branchName of branchesList) {
      const [branch] = await db.insert(schema.branches).values({
        name: branchName,
        collegeId,
      }).returning();

      const bId = branch?.id || (await db.query.branches.findFirst({
        where: (b, { and, eq }) => and(eq(b.name, branchName), eq(b.collegeId, collegeId!)),
      }))?.id;

      if (!bId) continue;

      // 4. Seed Semesters (1 to 8) for each branch
      console.log(`Inserting semesters for ${branchName}...`);
      for (let semNum = 1; semNum <= 8; semNum++) {
        const [sem] = await db.insert(schema.semesters).values({
          branchId: bId,
          name: `Semester ${semNum}`,
          number: semNum,
        }).returning();

        const semId = sem?.id || (await db.query.semesters.findFirst({
          where: (s, { and, eq }) => and(eq(s.number, semNum), eq(s.branchId, bId)),
        }))?.id;

        if (!semId) continue;

        // 5. Seed Classes (CE-1 to CE-4) for each semester
        const classesList = ['CE-1', 'CE-2', 'CE-3', 'CE-4'];
        for (const className of classesList) {
          const [cls] = await db.insert(schema.classes).values({
            semesterId: semId,
            name: className,
          }).returning();

          const classId = cls?.id || (await db.query.classes.findFirst({
            where: (c, { and, eq }) => and(eq(c.name, className), eq(c.semesterId, semId)),
          }))?.id;

          if (!classId) continue;

          // 6. Seed Batches (Batch A, Batch B, Batch C) for each class
          const batchesList = ['Batch A', 'Batch B', 'Batch C'];
          for (const batchName of batchesList) {
            await db.insert(schema.batches).values({
              classId,
              name: batchName,
            }).onConflictDoNothing();
          }
        }

        // 7. Seed subjects & syllabus for Computer Engineering, Semester 5 (as sample data)
        if (branchName === 'Computer Engineering' && semNum === 5) {
          console.log('Inserting sample subjects & syllabus topics for Computer Engineering Semester 5...');
          const subjectsList = [
            { name: 'Software Engineering', code: 'SE301' },
            { name: 'Analysis & Design of Algorithms', code: 'ADA302' },
            { name: 'Database Management Systems', code: 'DBMS303' },
            { name: 'Computer Networks', code: 'CN304' },
            { name: 'Cyber Security', code: 'CS305' },
          ];

          const syllabusData: Record<string, { topic: string; description: string }[]> = {
            'SE301': [
              { topic: 'Unit 1: Software Process Models', description: 'Waterfall, Spiral, V-Model, and Agile Scrum framework basics.' },
              { topic: 'Unit 2: Software Requirements Engineering', description: 'Requirement gathering, elicitation techniques, SRS document creation.' },
              { topic: 'Unit 3: Software Design & Architecture', description: 'Cohesion, coupling, object-oriented design patterns, UML diagrams.' },
              { topic: 'Unit 4: Verification & Validation', description: 'Unit testing, integration testing, system testing, black-box vs white-box.' },
              { topic: 'Unit 5: Project Management & Maintenance', description: 'Software sizing, COCOMO model, risk analysis, version control basics.' }
            ],
            'ADA302': [
              { topic: 'Unit 1: Algorithm Analysis & Foundations', description: 'Asymptotic notation (O, Ω, θ), recurrence relations, recursion trees.' },
              { topic: 'Unit 2: Divide & Conquer Paradigm', description: 'Binary search, Merge Sort, Quick Sort, Strassen’s matrix multiplication.' },
              { topic: 'Unit 3: Greedy & Dynamic Programming', description: 'Knapsack problem, Huffman codes, Prim/Kruskal, LCS, Matrix Chain Multiplication.' },
              { topic: 'Unit 4: Graph & Backtracking Algorithms', description: 'BFS, DFS, Dijkstra, N-Queens problem, Graph Coloring.' },
              { topic: 'Unit 5: Complexity Classes & Approximation', description: 'P, NP, NP-Hard, NP-Complete concepts, basic approximation algorithms.' }
            ],
            'DBMS303': [
              { topic: 'Unit 1: Introduction & ER Modeling', description: 'Database systems architecture, schemas, ER diagram design, constraints.' },
              { topic: 'Unit 2: Relational Query Languages', description: 'Relational algebra, SQL fundamentals, nested subqueries, joins.' },
              { topic: 'Unit 3: Database Design Theory', description: 'Functional dependencies, normalization forms (1NF, 2NF, 3NF, BCNF).' },
              { topic: 'Unit 4: Transaction & Concurrency Control', description: 'ACID properties, serializability, two-phase locking, deadlocks.' },
              { topic: 'Unit 5: Indexing & Storage Engine', description: 'RAID, file organization, B-trees and B+ trees indexing.' }
            ],
            'CN304': [
              { topic: 'Unit 1: Physical & Data Link Layers', description: 'Transmission media, framing, error detection/correction (CRC, Hamming).' },
              { topic: 'Unit 2: Media Access Control Sublayer', description: 'CSMA/CD, CSMA/CA, Ethernet, switching and VLANs.' },
              { topic: 'Unit 3: Network Layer Protocols', description: 'IPv4/IPv6 addressing, subnetting, routing algorithms (Link State, Distance Vector).' },
              { topic: 'Unit 4: Transport Layer Protocols', description: 'TCP connection state diagram, congestion control, UDP flow control.' },
              { topic: 'Unit 5: Application Layer Services', description: 'Domain Name System (DNS), HTTP/HTTPS protocols, SMTP and email routing.' }
            ],
            'CS305': [
              { topic: 'Unit 1: Security Principles & Cryptography', description: 'Confidentiality, Integrity, Availability, symmetric vs asymmetric encryption.' },
              { topic: 'Unit 2: Network & Web Security', description: 'Firewalls, Intrusion Detection Systems (IDS), SSL/TLS handshake, VPNs.' },
              { topic: 'Unit 3: Systems & Malware Security', description: 'Viruses, worms, trojans, buffer overflows, OS hardening techniques.' },
              { topic: 'Unit 4: Authentication & Access Control', description: 'Multi-factor authentication, RBAC, OAuth2, biometric controls.' },
              { topic: 'Unit 5: Cyber Laws & Forensic Basics', description: 'IT Act, security audits, digital signatures, incident response procedures.' }
            ]
          };

          for (const sub of subjectsList) {
            const [insertedSub] = await db.insert(schema.subjects).values({
              semesterId: semId,
              name: sub.name,
              code: sub.code,
            }).returning();

            const subjectId = insertedSub?.id || (await db.query.subjects.findFirst({
              where: (s, { and, eq }) => and(eq(s.code, sub.code), eq(s.semesterId, semId)),
            }))?.id;

            if (!subjectId) continue;

            const topics = syllabusData[sub.code] || [];
            for (let i = 0; i < topics.length; i++) {
              await db.insert(schema.syllabus).values({
                subjectId,
                topic: topics[i].topic,
                description: topics[i].description,
                status: 'pending',
                order: i + 1,
              });
            }
          }

          // 8. Seed sample timetable entries for CE-1 class
          console.log('Inserting sample timetable entries for CE Semester 5...');
          const firstClass = await db.query.classes.findFirst({
            where: (c, { and, eq }) => and(eq(c.name, 'CE-1'), eq(c.semesterId, semId)),
          });

          if (firstClass) {
            // Get subject IDs for timetable mapping
            const seededSubjects = await db.query.subjects.findMany({
              where: (s, { eq }) => eq(s.semesterId, semId),
            });

            const subjectMap: Record<string, string> = {};
            for (const s of seededSubjects) {
              if (s.code) subjectMap[s.code] = s.id;
            }

            // Sample weekly timetable (Mon-Sat)
            const timetableData = [
              // Monday
              { day: 1, subCode: 'SE301', start: '09:00', end: '09:55', room: 'Room 403', teacher: 'Prof. A. N. Shah' },
              { day: 1, subCode: 'DBMS303', start: '10:00', end: '10:55', room: 'Room 405', teacher: 'Prof. S. R. Patel' },
              { day: 1, subCode: 'CN304', start: '11:30', end: '12:25', room: 'Lab 3', teacher: 'Dr. K. R. Patel' },
              { day: 1, subCode: 'CS305', start: '14:00', end: '14:55', room: 'Room 401', teacher: 'Prof. R. M. Vyas' },
              // Tuesday
              { day: 2, subCode: 'ADA302', start: '09:00', end: '09:55', room: 'Room 404', teacher: 'Prof. M. K. Desai' },
              { day: 2, subCode: 'SE301', start: '10:00', end: '10:55', room: 'Room 403', teacher: 'Prof. A. N. Shah' },
              { day: 2, subCode: 'CS305', start: '11:30', end: '12:25', room: 'Room 401', teacher: 'Prof. R. M. Vyas' },
              { day: 2, subCode: 'DBMS303', start: '14:00', end: '15:55', room: 'Lab 2', teacher: 'Prof. S. R. Patel' },
              // Wednesday
              { day: 3, subCode: 'CN304', start: '09:00', end: '09:55', room: 'Room 402', teacher: 'Dr. K. R. Patel' },
              { day: 3, subCode: 'ADA302', start: '10:00', end: '10:55', room: 'Room 404', teacher: 'Prof. M. K. Desai' },
              { day: 3, subCode: 'SE301', start: '11:30', end: '12:25', room: 'Room 403', teacher: 'Prof. A. N. Shah' },
              // Thursday
              { day: 4, subCode: 'DBMS303', start: '09:00', end: '09:55', room: 'Room 405', teacher: 'Prof. S. R. Patel' },
              { day: 4, subCode: 'CS305', start: '10:00', end: '10:55', room: 'Room 401', teacher: 'Prof. R. M. Vyas' },
              { day: 4, subCode: 'ADA302', start: '11:30', end: '13:25', room: 'Lab 1', teacher: 'Prof. M. K. Desai' },
              { day: 4, subCode: 'CN304', start: '14:00', end: '14:55', room: 'Room 402', teacher: 'Dr. K. R. Patel' },
              // Friday
              { day: 5, subCode: 'SE301', start: '09:00', end: '09:55', room: 'Room 403', teacher: 'Prof. A. N. Shah' },
              { day: 5, subCode: 'CN304', start: '10:00', end: '11:55', room: 'Lab 3', teacher: 'Dr. K. R. Patel' },
              { day: 5, subCode: 'CS305', start: '14:00', end: '14:55', room: 'Room 401', teacher: 'Prof. R. M. Vyas' },
              // Saturday
              { day: 6, subCode: 'ADA302', start: '09:00', end: '09:55', room: 'Room 404', teacher: 'Prof. M. K. Desai' },
              { day: 6, subCode: 'DBMS303', start: '10:00', end: '10:55', room: 'Room 405', teacher: 'Prof. S. R. Patel' },
            ];

            for (const tt of timetableData) {
              const subjectId = subjectMap[tt.subCode];
              if (!subjectId) continue;

              await db.insert(schema.timetable).values({
                classId: firstClass.id,
                subjectId,
                dayOfWeek: tt.day,
                startTime: tt.start,
                endTime: tt.end,
                room: tt.room,
                teacher: tt.teacher,
              });
            }
            console.log(`Inserted ${timetableData.length} timetable entries.`);
          }
        }
      }
    }

    console.log('🎉 Seeding successfully completed!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
