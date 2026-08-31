import { db } from '../client';
import { sessions } from '../schema';
import { eq, and } from 'drizzle-orm';

export const sessionQueries = {
  getById: (id: string) =>
    db.select().from(sessions).where(eq(sessions.id, id)).get(),

  getByTeacher: (teacherId: string) =>
    db.select().from(sessions).where(eq(sessions.teacherId, teacherId)),

  insert: (row: typeof sessions.$inferInsert) =>
    db.insert(sessions).values(row),

  updateStatus: (id: string, status: 'active' | 'closed') =>
    db.update(sessions).set({ status }).where(eq(sessions.id, id)),
};
