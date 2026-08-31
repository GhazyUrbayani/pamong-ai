import { db } from '../client';
import { students, messages } from '../schema';
import { eq, and, sql } from 'drizzle-orm';

export const studentQueries = {
  /** Get all students in a session */
  getBySession: (sessionId: string) =>
    db.select().from(students).where(eq(students.sessionId, sessionId)),

  /** Get one student by username */
  getByUsername: (username: string) =>
    db.select().from(students).where(eq(students.username, username)).get(),

  /** Get one student by id */
  getById: (id: string) =>
    db.select().from(students).where(eq(students.id, id)).get(),

  /** Insert multiple students */
  insertMany: (rows: typeof students.$inferInsert[]) =>
    db.insert(students).values(rows),

  /** Get message count for a student (user messages only, not AI) */
  getMessageCount: (studentId: string) =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(and(eq(messages.studentId, studentId), eq(messages.role, 'user')))
      .get(),

  /** Get message count by level for a student */
  getLevelDistribution: (studentId: string) =>
    db
      .select({
        level: messages.questionLevel,
        count: sql<number>`count(*)`,
      })
      .from(messages)
      .where(and(eq(messages.studentId, studentId), eq(messages.role, 'user')))
      .groupBy(messages.questionLevel),
};
