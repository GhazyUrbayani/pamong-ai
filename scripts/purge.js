/**
 * Retention purge.
 *
 * UU PDP obliges a controller to delete personal data once the purpose it was
 * collected for is fulfilled. A class session's purpose ends with the term, so this
 * removes sessions older than the retention period along with everything attached
 * to them: transcripts, student records, and indexed module text.
 *
 * Usage:
 *   node scripts/purge.js            # delete sessions older than the retention period
 *   node scripts/purge.js --dry-run  # report what would be deleted, change nothing
 *   node scripts/purge.js --days=30  # override the period for this run
 *
 * Run it from cron, or by hand at the end of a term. Nothing schedules it
 * automatically — that is a deployment decision, and there is no deployment
 * configuration in this repository yet.
 */

const Database = require('better-sqlite3');
const path = require('path');

// Default retention: one school term. Override per run with --days, or set
// PAMONG_RETENTION_DAYS in the environment.
const DEFAULT_RETENTION_DAYS = 180;

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const daysArg = argv.find((a) => a.startsWith('--days='));

  const days = daysArg
    ? Number(daysArg.split('=')[1])
    : Number(process.env.PAMONG_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;

  if (!Number.isFinite(days) || days < 0) {
    console.error(`[purge] Invalid retention period: ${daysArg ?? days}`);
    process.exit(1);
  }

  return { dryRun, days };
}

function main() {
  const { dryRun, days } = parseArgs(process.argv.slice(2));

  const db = new Database(path.join(process.cwd(), 'pamong-ai.db'));
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const stale = db
    .prepare('SELECT id, title, created_at FROM sessions WHERE created_at < ?')
    .all(cutoff);

  if (stale.length === 0) {
    console.log(`[purge] No session older than ${days} days. Nothing to do.`);
    return;
  }

  console.log(
    `[purge] ${stale.length} session(s) older than ${days} days` +
      `${dryRun ? ' (dry run — nothing will be deleted)' : ''}:`
  );

  const countMessages = db.prepare('SELECT count(*) c FROM messages WHERE session_id = ?');
  const countStudents = db.prepare('SELECT count(*) c FROM students WHERE session_id = ?');
  const countChunks = db.prepare('SELECT count(*) c FROM knowledge_chunks WHERE session_id = ?');

  const deleteMessages = db.prepare('DELETE FROM messages WHERE session_id = ?');
  const deleteStudents = db.prepare('DELETE FROM students WHERE session_id = ?');
  const deleteChunks = db.prepare('DELETE FROM knowledge_chunks WHERE session_id = ?');
  const deleteSession = db.prepare('DELETE FROM sessions WHERE id = ?');

  // Children first: every child table has a foreign key to sessions.id.
  const purgeOne = db.transaction((sessionId) => {
    deleteMessages.run(sessionId);
    deleteChunks.run(sessionId);
    deleteStudents.run(sessionId);
    deleteSession.run(sessionId);
  });

  let totals = { sessions: 0, students: 0, messages: 0, chunks: 0 };

  for (const session of stale) {
    const messages = countMessages.get(session.id).c;
    const students = countStudents.get(session.id).c;
    const chunks = countChunks.get(session.id).c;
    const age = Math.floor((Date.now() - session.created_at) / (24 * 60 * 60 * 1000));

    console.log(
      `   - ${session.title} (${age} days old): ` +
        `${students} students, ${messages} messages, ${chunks} chunks`
    );

    if (!dryRun) purgeOne(session.id);

    totals = {
      sessions: totals.sessions + 1,
      students: totals.students + students,
      messages: totals.messages + messages,
      chunks: totals.chunks + chunks,
    };
  }

  console.log(
    `[purge] ${dryRun ? 'Would delete' : 'Deleted'}: ${totals.sessions} sessions, ` +
      `${totals.students} students, ${totals.messages} messages, ${totals.chunks} chunks.`
  );
}

main();
