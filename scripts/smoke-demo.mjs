import { spawn, spawnSync } from 'node:child_process';

const baseUrl = 'http://127.0.0.1:3000';
const env = {
  ...process.env,
  PORT: '3000',
  JWT_SECRET: process.env.JWT_SECRET || 'smoke-only-secret',
  PAMONG_DEMO_MODE: 'true',
};

const seeded = spawnSync(process.execPath, ['scripts/seed.js'], { env, stdio: 'inherit' });
if (seeded.status !== 0) process.exit(seeded.status ?? 1);

const server = spawn('npm', ['start'], { env, stdio: 'inherit' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (ok, message) => { if (!ok) throw new Error(message); };

async function request(path, options = {}) {
  const response = await fetch(baseUrl + path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(path + ' returned ' + response.status);
  return body;
}

try {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(baseUrl + '/guru/login');
      if (response.ok) break;
    } catch {}
    await sleep(250);
  }

  const teacher = await request('/api/auth/guru', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'guru@pamong-ai.id', password: 'demo1234' }),
  });
  assert(teacher.token, 'Teacher token missing.');

  const student = await request('/api/auth/siswa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ahmad.fauzi', password: 'belajar123' }),
  });
  assert(student.token, 'Student token missing.');

  const chat = await request('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + student.token,
    },
    body: JSON.stringify({ message: 'Apa fungsi klorofil pada fotosintesis?' }),
  });
  assert(chat.questionLevel === 'unclassified', 'Demo classifier was counted as a valid category.');
  assert(chat.classificationProvenance === 'demo', 'Demo classifier provenance is not explicit.');

  const transcript = await request('/api/guru/student-chat/' + student.student.id, {
    headers: { Authorization: 'Bearer ' + teacher.token },
  });
  assert(transcript.messages.some((m) => m.classificationProvenance === 'synthetic'), 'Seed labels are not marked synthetic.');

  console.log('Demo smoke flow passed.');
  console.log('Seeded transcripts are synthetic.');
  console.log('Live AI was NOT tested; PAMONG_DEMO_MODE=true.');
} finally {
  server.kill('SIGTERM');
}
