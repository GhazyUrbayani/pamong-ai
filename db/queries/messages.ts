import { db } from '../client';
import { messages, knowledgeChunks } from '../schema';
import { eq, and, desc } from 'drizzle-orm';

export const messageQueries = {
  /** Delete every message in a session (erasure) */
  deleteBySession: (sessionId: string) =>
    db.delete(messages).where(eq(messages.sessionId, sessionId)),

  /** Get all messages in a session room (for shared collaboration) */
  getByRoom: (sessionId: string, roomCode: string) =>
    db
      .select()
      .from(messages)
      .where(and(eq(messages.sessionId, sessionId), eq(messages.roomCode, roomCode)))
      .orderBy(messages.createdAt),

  /** Get all messages for a solo student (no room) */
  getBySoloStudent: (studentId: string) =>
    db
      .select()
      .from(messages)
      .where(eq(messages.studentId, studentId))
      .orderBy(messages.createdAt),

  insert: (row: typeof messages.$inferInsert) =>
    db.insert(messages).values(row),

  /** Get all messages in session for dashboard */
  getBySession: (sessionId: string) =>
    db.select().from(messages).where(eq(messages.sessionId, sessionId)),
};

export const chunkQueries = {
  getBySession: (sessionId: string) =>
    db
      .select()
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.sessionId, sessionId))
      .orderBy(knowledgeChunks.chunkIndex),

  insertMany: (rows: typeof knowledgeChunks.$inferInsert[]) =>
    db.insert(knowledgeChunks).values(rows),

  deleteBySession: (sessionId: string) =>
    db.delete(knowledgeChunks).where(eq(knowledgeChunks.sessionId, sessionId)),
};
