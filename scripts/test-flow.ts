import { runMigrations, seedTeacher } from '../db/migrate';
import { getSessionService } from '../services/session.service';
import { getRAGService } from '../services/rag.service';
import { getChatService } from '../services/chat.service';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🧪 PAMONG AI manual smoke flow');
  runMigrations();
  await seedTeacher();

  const { sqlite } = await import('../db/client');
  const teacherRow = sqlite.prepare('SELECT id FROM teachers LIMIT 1').get() as { id: string };
  const { session, students } = await getSessionService().createSession({
    teacherId: teacherRow.id,
    title: 'Smoke Test',
    subject: 'Biologi',
    aiTheme: 'biologi',
    maxStudents: 2,
    quotaPerStudent: 3,
    guardianConsent: true,
  });

  const material = fs.readFileSync(path.join(__dirname, '../public/materi-contoh-fotosintesis.txt'));
  await getRAGService().processDocument(session.id, material, 'materi-contoh-fotosintesis.txt');

  const result = await getChatService().chat({
    studentId: students[0].id,
    sessionId: session.id,
    message: 'Mengapa cahaya dibutuhkan pada reaksi terang?',
  });

  console.log({
    reply: result.reply,
    questionCategory: result.questionLevel,
    classificationProvenance: result.classificationProvenance,
    answerProvenance: result.aiProvenance,
    quotaRemaining: result.quotaRemaining,
  });

  if (result.aiProvenance !== 'model') {
    console.warn('⚠️ Live answer model was NOT verified in this run.');
  }
  if (result.classificationProvenance !== 'model') {
    console.warn('⚠️ Live classifier was NOT verified in this run.');
  }
}

main().catch((err) => {
  console.error('Smoke flow failed:', err);
  process.exitCode = 1;
});
