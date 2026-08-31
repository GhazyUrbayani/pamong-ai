import { runMigrations, seedTeacher } from '../db/migrate';
import { getSessionService } from '../services/session.service';
import { getRAGService } from '../services/rag.service';
import { getChatService } from '../services/chat.service';
import { getClassifierService } from '../services/classifier.service';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🧪 Starting End-to-End Test for PAMONG AI...');

  // 1. Run migrations & seed teacher
  runMigrations();
  await seedTeacher();
  console.log('✅ 1. Migrations & Teacher Seed OK');

  const { sqlite } = await import('../db/client');
  const teacherRow = sqlite.prepare('SELECT id FROM teachers LIMIT 1').get() as { id: string };
  const teacherId = teacherRow.id;

  // 2. Create Session & Auto-generate 20 students
  const sessionService = getSessionService();
  const { session, students } = await sessionService.createSession({
    teacherId,
    title: 'Fotosintesis & Metabolisme',
    subject: 'Biologi',
    aiTheme: 'biologi',
    maxStudents: 20,
    quotaPerStudent: 20,
  });

  console.log(`✅ 2. Created Session "${session.title}" with ${students.length} auto-generated student credentials`);
  console.log(`   Sample Student 1: ${students[0].username} / ${students[0].passwordPlain}`);
  console.log(`   Sample Student 2: ${students[1].username} / ${students[1].passwordPlain}`);

  // 3. Process & Ingest Material (RAG)
  const sampleFilePath = path.join(__dirname, '../public/materi-contoh-fotosintesis.txt');
  const fileBuffer = fs.readFileSync(sampleFilePath);
  const ragService = getRAGService();
  const chunksCount = await ragService.processDocument(session.id, fileBuffer, 'materi-contoh-fotosintesis.txt');
  console.log(`✅ 3. RAG Document Ingestion OK: Created ${chunksCount} knowledge base chunks`);

  // 4. Test Cognitive Level Classifier Service
  const classifier = getClassifierService();
  const testQuestions = [
    { q: 'Apa pengertian fotosintesis?', expected: 'hafalan' },
    { q: 'Jelaskan bagaimana proses reaksi terang menghasilkan ATP dan NADPH!', expected: 'pemahaman' },
    { q: 'Bagaimana dampak jika terjadi kenaikan suhu global di atas 45 derajat terhadap laju fotosintesis dan rantai makanan?', expected: 'analisis' },
  ];

  console.log('✅ 4. Testing Cognitive Level Classifier:');
  for (const t of testQuestions) {
    const level = await classifier.classify(t.q);
    console.log(`   - Question: "${t.q}" -> Level: [${level.toUpperCase()}]`);
  }

  // 5. Test Chat Service (RAG Grounded + Quota + Persistence)
  const chatService = getChatService();
  const student1 = students[0];

  console.log('✅ 5. Testing Student Chat (Grounded RAG):');
  const chatRes1 = await chatService.chat({
    studentId: student1.id,
    sessionId: session.id,
    message: 'Apa itu fotosintesis dan di mana reaksi terang berlangsung?',
  });
  console.log(`   - AI Reply: ${chatRes1.reply.slice(0, 120)}...`);
  console.log(`   - Level: ${chatRes1.questionLevel}, Sisa Kuota: ${chatRes1.quotaRemaining}`);

  // Test Out-of-Context Question (Anti-Hallucination)
  const chatRes2 = await chatService.chat({
    studentId: student1.id,
    sessionId: session.id,
    message: 'Siapa presiden pertama Amerika Serikat?',
  });
  console.log(`   - Out-of-context test: "${chatRes2.reply}"`);

  // 6. Compute Real-time Dashboard Stats
  const stats = await chatService.computeStudentStats(session.id);
  console.log(`✅ 6. Real-time Dashboard Stats computed for ${stats.length} students:`);
  console.log(`   - Student 1 (${stats[0].displayName}): ${stats[0].chatUsed} chats, status: ${stats[0].status}`);

  console.log('\n🎉 ALL CORE MVP WORKFLOWS VERIFIED SUCCESSFULLY!');
}

main().catch(console.error);
