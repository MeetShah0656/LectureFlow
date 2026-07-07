import { pgTable, uuid, text, integer, boolean, timestamp, date, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Universities Table
export const universities = pgTable('universities', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('university_name_idx').on(table.name),
]);

export const universitiesRelations = relations(universities, ({ many }) => ({
  colleges: many(colleges),
  users: many(users),
}));

// 2. Colleges Table
export const colleges = pgTable('colleges', {
  id: uuid('id').defaultRandom().primaryKey(),
  universityId: uuid('university_id')
    .references(() => universities.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('college_university_idx').on(table.universityId),
]);

export const collegesRelations = relations(colleges, ({ one, many }) => ({
  university: one(universities, {
    fields: [colleges.universityId],
    references: [universities.id],
  }),
  branches: many(branches),
  users: many(users),
}));

// 3. Branches Table
export const branches = pgTable('branches', {
  id: uuid('id').defaultRandom().primaryKey(),
  collegeId: uuid('college_id')
    .references(() => colleges.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('branch_college_idx').on(table.collegeId),
]);

export const branchesRelations = relations(branches, ({ one, many }) => ({
  college: one(colleges, {
    fields: [branches.collegeId],
    references: [colleges.id],
  }),
  semesters: many(semesters),
  users: many(users),
}));

// 4. Semesters Table
export const semesters = pgTable('semesters', {
  id: uuid('id').defaultRandom().primaryKey(),
  branchId: uuid('branch_id')
    .references(() => branches.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(), // e.g. "Semester 5"
  number: integer('number').notNull(), // e.g. 5
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('semester_branch_idx').on(table.branchId),
]);

export const semestersRelations = relations(semesters, ({ one, many }) => ({
  branch: one(branches, {
    fields: [semesters.branchId],
    references: [branches.id],
  }),
  classes: many(classes),
  subjects: many(subjects),
  users: many(users),
}));

// 5. Classes Table
export const classes = pgTable('classes', {
  id: uuid('id').defaultRandom().primaryKey(),
  semesterId: uuid('semester_id')
    .references(() => semesters.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(), // e.g. "Div A"
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('class_semester_idx').on(table.semesterId),
]);

export const classesRelations = relations(classes, ({ one, many }) => ({
  semester: one(semesters, {
    fields: [classes.semesterId],
    references: [semesters.id],
  }),
  batches: many(batches),
  timetable: many(timetable),
  users: many(users),
}));

// 6. Batches Table
export const batches = pgTable('batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  classId: uuid('class_id')
    .references(() => classes.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(), // e.g. "Batch B1"
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('batch_class_idx').on(table.classId),
]);

export const batchesRelations = relations(batches, ({ one, many }) => ({
  class: one(classes, {
    fields: [batches.classId],
    references: [classes.id],
  }),
  users: many(users),
  timetable: many(timetable),
}));

// 7. Users Table
export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // references auth.users(id) from Supabase
  email: text('email').notNull().unique(),
  name: text('name'),
  universityId: uuid('university_id').references(() => universities.id),
  collegeId: uuid('college_id').references(() => colleges.id),
  branchId: uuid('branch_id').references(() => branches.id),
  semesterId: uuid('semester_id').references(() => semesters.id),
  classId: uuid('class_id').references(() => classes.id),
  batchId: uuid('batch_id').references(() => batches.id),
  academicYear: text('academic_year'), // e.g., "2026-27"
  attendanceRequirement: integer('attendance_requirement').default(75).notNull(),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('user_email_idx').on(table.email),
  index('user_university_idx').on(table.universityId),
  index('user_college_idx').on(table.collegeId),
  index('user_branch_idx').on(table.branchId),
  index('user_semester_idx').on(table.semesterId),
  index('user_class_idx').on(table.classId),
  index('user_batch_idx').on(table.batchId),
]);

export const usersRelations = relations(users, ({ one, many }) => ({
  university: one(universities, {
    fields: [users.universityId],
    references: [universities.id],
  }),
  college: one(colleges, {
    fields: [users.collegeId],
    references: [colleges.id],
  }),
  branch: one(branches, {
    fields: [users.branchId],
    references: [branches.id],
  }),
  semester: one(semesters, {
    fields: [users.semesterId],
    references: [semesters.id],
  }),
  class: one(classes, {
    fields: [users.classId],
    references: [classes.id],
  }),
  batch: one(batches, {
    fields: [users.batchId],
    references: [batches.id],
  }),
  attendance: many(attendance),
  timetable: many(timetable),
  settings: one(settings, {
    fields: [users.id],
    references: [settings.userId],
  }),
  notifications: many(notifications),
}));

// 8. Subjects Table
export const subjects = pgTable('subjects', {
  id: uuid('id').defaultRandom().primaryKey(),
  semesterId: uuid('semester_id')
    .references(() => semesters.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  code: text('code'), // e.g. "CS501"
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('subject_semester_idx').on(table.semesterId),
]);

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  semester: one(semesters, {
    fields: [subjects.semesterId],
    references: [semesters.id],
  }),
  timetable: many(timetable),
  syllabus: many(syllabus),
}));

// 9. Timetable Table
export const timetable = pgTable('timetable', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  classId: uuid('class_id').references(() => classes.id, { onDelete: 'cascade' }),
  batchId: uuid('batch_id').references(() => batches.id, { onDelete: 'cascade' }),
  subjectId: uuid('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  dayOfWeek: integer('day_of_week').notNull(), // 1 = Monday, 7 = Sunday
  startTime: text('start_time').notNull(), // "HH:MM" e.g. "09:00"
  endTime: text('end_time').notNull(), // "HH:MM" e.g. "09:55"
  room: text('room'), // e.g. "Room 403"
  teacher: text('teacher'), // e.g. "Dr. John Doe"
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('timetable_user_idx').on(table.userId),
  index('timetable_class_idx').on(table.classId),
  index('timetable_batch_idx').on(table.batchId),
  index('timetable_subject_idx').on(table.subjectId),
  index('timetable_day_idx').on(table.dayOfWeek),
]);

export const timetableRelations = relations(timetable, ({ one, many }) => ({
  user: one(users, {
    fields: [timetable.userId],
    references: [users.id],
  }),
  class: one(classes, {
    fields: [timetable.classId],
    references: [classes.id],
  }),
  batch: one(batches, {
    fields: [timetable.batchId],
    references: [batches.id],
  }),
  subject: one(subjects, {
    fields: [timetable.subjectId],
    references: [subjects.id],
  }),
  attendance: many(attendance),
}));

// 10. Attendance Table
export const attendance = pgTable('attendance', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  timetableId: uuid('timetable_id')
    .references(() => timetable.id, { onDelete: 'cascade' })
    .notNull(),
  date: date('date').notNull(),
  status: text('status').notNull(), // 'present', 'absent', 'late', 'excused'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('attendance_user_idx').on(table.userId),
  index('attendance_timetable_idx').on(table.timetableId),
  index('attendance_date_idx').on(table.date),
]);

export const attendanceRelations = relations(attendance, ({ one }) => ({
  user: one(users, {
    fields: [attendance.userId],
    references: [users.id],
  }),
  timetable: one(timetable, {
    fields: [attendance.timetableId],
    references: [timetable.id],
  }),
}));

// 11. Syllabus Table
export const syllabus = pgTable('syllabus', {
  id: uuid('id').defaultRandom().primaryKey(),
  subjectId: uuid('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  topic: text('topic').notNull(),
  description: text('description'),
  status: text('status').default('pending').notNull(), // 'pending', 'in_progress', 'completed'
  order: integer('order').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('syllabus_subject_idx').on(table.subjectId),
]);

export const syllabusRelations = relations(syllabus, ({ one }) => ({
  subject: one(subjects, {
    fields: [syllabus.subjectId],
    references: [subjects.id],
  }),
}));

// 12. Settings Table
export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  theme: text('theme').default('system').notNull(),
  notificationsEnabled: boolean('notifications_enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('settings_user_idx').on(table.userId),
]);

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(users, {
    fields: [settings.userId],
    references: [users.id],
  }),
}));

// 13. Notifications Table
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('notifications_user_idx').on(table.userId),
]);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
