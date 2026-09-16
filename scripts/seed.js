const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const db = new Database('pamong-ai.db');

// ─── Env ─────────────────────────────────────────────────────────────────────
// This script runs outside Next.js, which is what loads .env.local normally.
// Read it here so the seed embeds with the same provider the running app will
// use to embed queries. Mismatched providers produce unusable similarity scores.
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

// ─── RAG helpers ─────────────────────────────────────────────────────────────
// These MUST stay identical to services/rag.service.ts and services/llm.service.ts.
// Chunks seeded here are retrieved by the running app, so any divergence in
// chunking or embedding silently breaks relevance scoring.

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

// Must match GUARDIAN_CONSENT_STATEMENT in types/index.ts. This script runs outside
// the TypeScript build, so the string is duplicated rather than imported.
const GUARDIAN_CONSENT_STATEMENT =
  'v1: Saya menyatakan bahwa sekolah telah memperoleh persetujuan orang tua/wali ' +
  'untuk setiap siswa di kelas ini, sesuai UU No. 27 Tahun 2022 tentang Pelindungan ' +
  'Data Pribadi, atas pemrosesan pertanyaan dan transkrip belajar mereka oleh Pamong AI.';

/** Mirror of RAGService.chunkText */
function chunkText(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const chunks = [];
  const step = Math.max(1, CHUNK_SIZE - CHUNK_OVERLAP);

  for (let start = 0; start < normalized.length; start += step) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 20) chunks.push(chunk);
    if (end >= normalized.length) break;
  }

  return chunks;
}

/** Mirror of the 64-dimensional heuristic embedding in llm.service.ts */
function mockEmbed(text) {
  const vec = new Array(64).fill(0);
  const words = text.toLowerCase().split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (let j = 0; j < word.length; j++) {
      const idx = (word.charCodeAt(j) * (j + 1) + i) % 64;
      vec[idx] += 1;
    }
  }
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / mag);
}

function hasGeminiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  return Boolean(key.trim()) && !key.startsWith('YOUR_') && !key.startsWith('sk-...');
}

/**
 * Embed chunks with Gemini when a key is available, otherwise with the local
 * heuristic. Returns the vectors plus which path produced them, so the caller
 * can warn the operator.
 */
async function embedChunks(chunks) {
  if (!hasGeminiKey()) {
    return { vectors: chunks.map(mockEmbed), real: false };
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    });
    const model = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';

    const response = await ai.models.embedContent({ model, contents: chunks });
    const vectors = (response.embeddings || []).map((e) => e.values);

    if (vectors.length !== chunks.length || vectors.some((v) => !v || !v.length)) {
      throw new Error('incomplete embedding response');
    }
    return { vectors, real: true };
  } catch (err) {
    console.warn(`[Seed] Gemini embedding failed (${err.message}); using heuristic vectors.`);
    return { vectors: chunks.map(mockEmbed), real: false };
  }
}

/** Ingest a module file into a session's knowledge base. */
async function seedModule(sessionId, filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const chunks = chunkText(raw);
  if (chunks.length === 0) return { count: 0, real: false };

  const { vectors, real } = await embedChunks(chunks);

  db.prepare('DELETE FROM knowledge_chunks WHERE session_id = ?').run(sessionId);

  const insert = db.prepare(`
    INSERT INTO knowledge_chunks (id, session_id, chunk_text, embedding_json, chunk_index)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (let i = 0; i < chunks.length; i++) {
    insert.run(crypto.randomUUID(), sessionId, chunks[i], JSON.stringify(vectors[i]), i);
  }

  return { count: chunks.length, real };
}

loadEnvLocal();

async function seed() {
  console.log('[Seed] Seeding realistic Indonesian classroom & Bloom taxonomy chats...');

  // Ensure tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES teachers(id),
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      ai_theme TEXT NOT NULL DEFAULT 'umum',
      max_students INTEGER NOT NULL DEFAULT 20,
      quota_per_student INTEGER NOT NULL DEFAULT 20,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      guardian_consent_at INTEGER,
      guardian_consent_statement TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      chunk_text TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      chunk_index INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      room_code TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      student_id TEXT NOT NULL REFERENCES students(id),
      room_code TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      question_level TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // Ensure teacher exists
  const teacherEmail = 'guru@pamong-ai.id';
  let teacher = db.prepare('SELECT id FROM teachers WHERE email = ?').get(teacherEmail);
  const hash = await bcrypt.hash('demo1234', 10);
  
  if (!teacher) {
    const teacherId = 'teacher-ibu-sari-001';
    db.prepare(
      'INSERT INTO teachers (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(teacherId, 'Ibu Sari, S.Pd.', teacherEmail, hash, Date.now());
    teacher = { id: teacherId };
  }

  // Clear existing session data
  db.exec('DELETE FROM messages; DELETE FROM students; DELETE FROM knowledge_chunks; DELETE FROM sessions;');

  const now = Date.now();

  const CLASSROOM_DATA = [

    // ─── 4 SISWA TINGKAT ANALISIS (HOTS - 🟢 PROGRESIF) ─────────────────────────
    {
      name: 'Ahmad Fauzi',
      username: 'ahmad.fauzi',
      password: 'belajar123',
      chats: [
        {
          user: 'Apa perbedaan reaksi terang dan reaksi gelap pada fotosintesis?',
          level: 'hafalan',
          assistant: 'Reaksi terang berlangsung di tilakoid dan membutuhkan cahaya matahari serta air untuk menghasilkan ATP, NADPH, dan O2. Sedangkan reaksi gelap (siklus Calvin) berlangsung di stroma dan menggunakan ATP & NADPH tersebut untuk mengubah CO2 menjadi glukosa.',
        },
        {
          user: 'Mengapa fotolisis air sangat krusial dalam reaksi terang fotosistem II?',
          level: 'pemahaman',
          assistant: 'Fotolisis air (2 H2O → 4 H+ + 4 e- + O2) krusial karena elektron yang dihasilkan berfungsi menggantikan elektron yang hilang dari klorofil P680 di FS II saat tereksitasi oleh foton cahaya matahari. Tanpa donor elektron dari air, aliran elektron menuju FS I akan terhenti!',
        },
        {
          user: 'Bagaimana jika intensitas cahaya dinaikkan terus-menerus sementara konsentrasi CO2 di udara sangat minim, apakah laju fotosintesis tetap naik?',
          level: 'analisis',
          assistant: 'Laju fotosintesis TIDAK akan terus naik, melainkan mencapai titik jenuh (plateau) karena konsentrasi CO2 menjadi faktor pembatas (limiting factor). Reaksi terang menghasilkan ATP & NADPH berlebih, tetapi siklus Calvin kekurangan substrat CO2 untuk fiksasi RuBisCO.',
        },
        {
          user: 'Analisis dampak penggunaan herbisida penghambat fotosistem II terhadap produksi ATP dan sintesis glukosa tumbuhan!',
          level: 'analisis',
          assistant: 'Jika FS II dihambat, aliran elektron non-siklik terputus sehingga fotolisis air terhenti dan NADPH tidak terbentuk. Meskipun fotofosforilasi siklik pada FS I mungkin masih menghasilkan sedikit ATP, ketiadaan NADPH akan menghentikan reduksi PGA menjadi PGAL di siklus Calvin, menyebabkan sintesis glukosa gagal total.',
        },
      ],
    },
    {
      name: 'Dewi Lestari',
      username: 'dewi.lestari',
      password: 'belajar123',
      chats: [
        {
          user: 'Apa fungsi klorofil pada daun hijau?',
          level: 'hafalan',
          assistant: 'Klorofil berfungsi menyerap energi foton dari cahaya matahari, khususnya pada spektrum biru dan merah, untuk memulai reaksi fotokimia fotosintesis.',
        },
        {
          user: 'Bagaimana jalur fotosintesis tumbuhan CAM berbeda dengan tumbuhan C3 dan C4 dalam mengatasi kekeringan?',
          level: 'pemahaman',
          assistant: 'Tumbuhan CAM memisahkan fiksasi CO2 dan siklus Calvin berdasarkan WAKTU (temporal). Stomata terbuka di malam hari untuk mengikat CO2 menjadi asam malat, dan tertutup di siang hari untuk mencegah transpirasi berlebih sambil menjalankan siklus Calvin menggunakan energi cahaya.',
        },
        {
          user: 'Mengapa tumbuhan C4 lebih efisien melakukan fotosintesis di daerah tropis bersuhu tinggi dibanding tumbuhan C3?',
          level: 'analisis',
          assistant: 'Karena tumbuhan C4 menggunakan enzim PEP karboksilase yang memiliki afinitas tinggi terhadap CO2 dan tidak mengikat O2. Hal ini mencegah fotorespirasi (pemborosan energi saat RuBisCO mengikat O2), sehingga tumbuhan C4 tetap efisien meskipun stomata menyempit di suhu tinggi.',
        },
        {
          user: 'Jika terjadi mutasi yang menyebabkan stomata tidak dapat membuka di malam hari pada tumbuhan CAM, apa konsekuensi fisiologisnya?',
          level: 'analisis',
          assistant: 'Tumbuhan CAM tidak dapat mengikat CO2 di malam hari, sehingga cadangan malat di vakuola kosong. Pada siang hari, siklus Calvin tidak memiliki suplai karbon untuk menghasilkan PGAL/glukosa, yang berakibat pada penurunan biomassa dan kematian jaringan tumbuhan.',
        },
      ],
    },
    {
      name: 'Zahra Aulia',
      username: 'zahra.aulia',
      password: 'belajar123',
      chats: [
        {
          user: 'Di mana tempat terjadinya siklus Calvin pada kloroplas?',
          level: 'hafalan',
          assistant: 'Siklus Calvin berlangsung di dalam stroma kloroplas.',
        },
        {
          user: 'Jelaskan 3 tahapan utama dalam siklus Calvin!',
          level: 'pemahaman',
          assistant: 'Tiga tahapan utama siklus Calvin adalah: 1) Fiksasi Karbon (CO2 diikat oleh RuBP dibantu RuBisCO membentuk 3-PGA), 2) Reduksi (3-PGA direduksi menjadi PGAL/G3P dengan ATP & NADPH), dan 3) Regenerasi RuBP (PGAL disusun kembali menjadi RuBP dengan bantuan ATP).',
        },
        {
          user: 'Bandingkan kebutuhan energi antara pembentukan 1 molekul glukosa pada tumbuhan C3 vs tumbuhan C4!',
          level: 'analisis',
          assistant: 'Untuk 1 molekul glukosa (6 CO2), tumbuhan C3 membutuhkan 18 ATP dan 12 NADPH. Sedangkan tumbuhan C4 membutuhkan 30 ATP dan 12 NADPH (tambahan 12 ATP untuk mengonversi piruvat kembali menjadi PEP). Tumbuhan C4 membayar "biaya energi" lebih tinggi demi menghindari fotorespirasi.',
        },
      ],
    },
    {
      name: 'Kevin Sanjaya',
      username: 'kevin.sanjaya',
      password: 'belajar123',
      chats: [
        {
          user: 'Sebutkan pigmen fotosintesis selain klorofil a!',
          level: 'hafalan',
          assistant: 'Pigmen fotosintesis lainnya meliputi klorofil b, karotenoid (karoten dan xantofil), serta fikosianin dan fikoeritrin pada beberapa jenis alga.',
        },
        {
          user: 'Bagaimana spektrum cahaya merah dan biru mempengaruhi laju fotosintesis?',
          level: 'pemahaman',
          assistant: 'Klorofil memiliki puncak absorpsi paling tinggi pada spektrum cahaya biru (~430-450 nm) dan merah (~640-660 nm). Cahaya biru memberikan foton berenergi tinggi, sedangkan cahaya merah sangat efektif dalam mengeksitasi elektron klorofil P680 dan P700.',
        },
        {
          user: 'Evaluasi percobaan Ingenhousz jika air diganti dengan air mendidih yang didinginkan tanpa aerasi, apa yang terjadi pada gelembung udara?',
          level: 'analisis',
          assistant: 'Jumlah gelembung O2 akan menurun drastis atau tidak muncul sama sekali! Pemanasan air menghilangkan gas CO2 terlarut. Tanpa CO2 terlarut sebagai sumber karbon, siklus Calvin terhenti, yang akhirnya menumpuk NADPH dan menghambat fotolisis air penghasil O2 pada reaksi terang.',
        },
      ],
    },

    // ─── 7 SISWA TINGKAT PEMAHAMAN (MOTS - 🔵 KONSEPTUAL) ──────────────────────────
    {
      name: 'Siti Nurhaliza',
      username: 'siti.nurhaliza',
      password: 'belajar123',
      chats: [
        {
          user: 'Apa rumus kimia fotosintesis?',
          level: 'hafalan',
          assistant: '6 CO2 + 6 H2O + Energi Cahaya → C6H12O6 (Glukosa) + 6 O2',
        },
        {
          user: 'Mengapa tumbuhan menghasilkan oksigen saat terkena cahaya?',
          level: 'pemahaman',
          assistant: 'Oksigen dihasilkan dari proses fotolisis air (pemecahan molekul H2O oleh energi cahaya matahari pada Fotosistem II). Molekul air dipecah untuk mengambil elektronnya, dan oksigen dilepaskan sebagai produk sampingan ke atmosfer.',
        },
        {
          user: 'Bagaimana peran stomata dalam regulasi gas pada fotosintesis?',
          level: 'pemahaman',
          assistant: 'Stomata berfungsi sebagai pintu gerbang pertukaran gas: membuka untuk menyerap CO2 dari atmosfer yang dibutuhkan siklus Calvin, dan mengeluarkan O2 hasil reaksi terang, serta mengatur pelepasan uap air (transpirasi).',
        },
      ],
    },
    {
      name: 'Rian Hidayat',
      username: 'rian.hidayat',
      password: 'belajar123',
      chats: [
        {
          user: 'Apa nama enzim yang mengikat CO2 pada siklus Calvin?',
          level: 'hafalan',
          assistant: 'Enzim tersebut adalah RuBisCO (Ribulose-1,5-bisphosphate carboxylase-oxygenase).',
        },
        {
          user: 'Kenapa reaksi gelap disebut juga siklus Calvin?',
          level: 'pemahaman',
          assistant: 'Dinamakan siklus Calvin untuk menghormati penemunya, Melvin Calvin. Disebut siklus karena senyawa awal yaitu RuBP mengalami reaksi bertahap dan di akhir proses diregenerasi kembali untuk mengikat CO2 berikutnya.',
        },
        {
          user: 'Bagaimana ATP yang dibuat di reaksi terang dimanfaatkan pada reaksi gelap?',
          level: 'pemahaman',
          assistant: 'ATP menyediakan gugus fosfat dan energi untuk mengubah 3-PGA menjadi 1,3-bisfosfogliserat pada tahap reduksi, serta digunakan pada tahap regenerasi untuk menyusun kembali PGAL menjadi RuBP.',
        },
      ],
    },
    {
      name: 'Nabila Putri',
      username: 'nabila.putri',
      password: 'belajar123',
      chats: [
        {
          user: 'Sebutkan bagian-bagian dari kloroplas!',
          level: 'hafalan',
          assistant: 'Kloroplas terdiri dari membran luar, membran dalam, ruang antarmembran, stroma (cairan), tilakoid (kantung pipih), dan grana (tumpukan tilakoid).',
        },
        {
          user: 'Apa fungsi grana pada kloroplas?',
          level: 'pemahaman',
          assistant: 'Grana adalah tumpukan tilakoid yang berfungsi memperluas area permukaan penyerapan cahaya matahari dan menjadi tempat tertanamnya fotosistem I, fotosistem II, serta rantai transpor elektron untuk reaksi terang.',
        },
      ],
    },
    {
      name: 'Dimas Anggara',
      username: 'dimas.anggara',
      password: 'belajar123',
      chats: [
        {
          user: 'Apa nama organel sel tempat terjadinya fotosintesis?',
          level: 'hafalan',
          assistant: 'Kloroplas pada sel parenkim mesofil daun.',
        },
        {
          user: 'Mengapa daun yang ditutupi kertas timah pada percobaan Sachs tidak berwarna biru kehitaman saat ditetesi lugol?',
          level: 'pemahaman',
          assistant: 'Karena bagian daun yang tertutup tidak terkena cahaya sehingga tidak dapat melakukan reaksi fotosintesis. Akibatnya, tidak terbentuk amilum (pati). Uji lugol hanya bereaksi menghasilkan warna biru tua jika terdapat amilum.',
        },
        {
          user: 'Bagaimana glukosa hasil fotosintesis diubah dan diedarkan ke jaringan lain?',
          level: 'pemahaman',
          assistant: 'Glukosa diubah menjadi sukrosa untuk diangkut melalui pembuluh floem ke seluruh bagian tumbuhan (akar, batang, buah) dan sebagian disimpan sebagai cadangan makanan dalam bentuk amilum (pati) di leukoplas.',
        },
      ],
    },
    {
      name: 'Putri Maharani',
      username: 'putri.maharani',
      password: 'belajar123',
      chats: [
        {
          user: 'Apa kepanjangan dari ATP dan NADPH?',
          level: 'hafalan',
          assistant: 'ATP = Adenosine Triphosphate, NADPH = Nicotinamide Adenine Dinucleotide Phosphate Hydrogen.',
        },
        {
          user: 'Jelaskan mengapa fotosintesis disebut sebagai reaksi anabolisme!',
          level: 'pemahaman',
          assistant: 'Fotosintesis disebut anabolisme karena menyusun senyawa organik kompleks (glukosa C6H12O6) dari senyawa anorganik sederhana (CO2 dan H2O) dengan menyerap dan menyimpan energi (reaksi endergonik).',
        },
      ],
    },
    {
      name: 'Rizky Ramadhan',
      username: 'rizky.ramadhan',
      password: 'belajar123',
      chats: [
        {
          user: 'Berapa panjang gelombang cahaya yang diserap P700?',
          level: 'hafalan',
          assistant: 'P700 pada Fotosistem I menyerap optimal cahaya dengan panjang gelombang 700 nanometer (spektrum merah jauh).',
        },
        {
          user: 'Bagaimana mekanisme pembentukan gradien proton H+ di lumen tilakoid menghasilkan ATP?',
          level: 'pemahaman',
          assistant: 'Fotolisis air dan aliran elektron memompa ion H+ ke dalam lumen tilakoid. Akumulasi H+ menciptakan gradien elektrokimia. Ketika H+ mengalir kembali ke stroma melalui enzim ATP Sintase (kemiosmosis), energi kinetiknya digunakan untuk memfosforilasi ADP menjadi ATP.',
        },
      ],
    },
    {
      name: 'Tiara Andini',
      username: 'tiara.andini',
      password: 'belajar123',
      chats: [
        {
          user: 'Apa itu reaksi terang fotosintesis?',
          level: 'hafalan',
          assistant: 'Reaksi terang adalah tahap fotosintesis yang mutlak memerlukan energi foton cahaya matahari untuk mengonversi H2O menjadi O2, ATP, dan NADPH di membran tilakoid.',
        },
        {
          user: 'Mengapa tumbuhan tetap membutuhkan respirasi sel padahal sudah melakukan fotosintesis?',
          level: 'pemahaman',
          assistant: 'Fotosintesis menghasilkan bahan bakar (glukosa), namun untuk menggerakkan aktivitas seluler (pertumbuhan, pembelahan sel, transportasi aktif), glukosa tersebut harus dipecah di mitokondria melalui respirasi sel untuk menghasilkan ATP yang siap pakai.',
        },
      ],
    },

    // ─── 4 SISWA TINGKAT HAFALAN (LOTS - 🟠 BUTUH BIMBINGAN) ──────────
    {
      name: 'Budi Santoso',
      username: 'budi.santoso',
      password: 'belajar123',
      chats: [
        {
          user: 'Fotosintesis menghasilkan apa?',
          level: 'hafalan',
          assistant: 'Fotosintesis menghasilkan glukosa (C6H12O6) sebagai sumber makanan tumbuhan dan oksigen (O2) yang dilepaskan ke udara.',
        },
        {
          user: 'Apa warna daun yang banyak klorofil?',
          level: 'hafalan',
          assistant: 'Warna hijau, karena klorofil memantulkan cahaya hijau dan menyerap cahaya biru dan merah.',
        },
        {
          user: 'Di mana tempat fotosintesis?',
          level: 'hafalan',
          assistant: 'Di kloroplas yang terdapat pada sel-sel mesofil daun.',
        },
        {
          user: 'Siapa nama ilmuwan percobaan fotosintesis?',
          level: 'hafalan',
          assistant: 'Beberapa ilmuwan penting: Jan Ingenhousz (menemukan O2), Julius von Sachs (menemukan amilum), dan Melvin Calvin (siklus reaksi gelap).',
        },
      ],
    },
    {
      name: 'Anisa Rahmawati',
      username: 'anisa.rahma',
      password: 'belajar123',
      chats: [
        {
          user: 'Apa itu klorofil?',
          level: 'hafalan',
          assistant: 'Klorofil adalah pigmen hijau fotosintesis pada daun yang menangkap energi cahaya matahari.',
        },
        {
          user: 'Apa bahan utama fotosintesis?',
          level: 'hafalan',
          assistant: 'Karbon dioksida (CO2) dari udara dan air (H2O) dari dalam tanah.',
        },
        {
          user: 'Apakah malam hari ada reaksi terang?',
          level: 'hafalan',
          assistant: 'Tidak ada, reaksi terang membutuhkan energi cahaya matahari secara langsung.',
        },
      ],
    },
    {
      name: 'Fajar Nugraha',
      username: 'fajar.nugraha',
      password: 'belajar123',
      chats: [
        {
          user: 'Apa sebutan lain reaksi gelap?',
          level: 'hafalan',
          assistant: 'Siklus Calvin atau reaksi fiksasi karbon.',
        },
        {
          user: 'Di mana letak stroma?',
          level: 'hafalan',
          assistant: 'Stroma adalah cairan kental pengisi ruang di dalam kloroplas yang mengelilingi tilakoid.',
        },
      ],
    },
    {
      name: 'Hendra Setiawan',
      username: 'hendra.setiawan',
      password: 'belajar123',
      chats: [
        {
          user: 'Apa fungsi akar bagi fotosintesis?',
          level: 'hafalan',
          assistant: 'Menyerap air (H2O) dan unsur hara mineral dari dalam tanah untuk disalurkan ke daun melalui xilem.',
        },
        {
          user: 'Apa nama zat pewarna untuk uji amilum?',
          level: 'hafalan',
          assistant: 'Larutan Lugol atau Iodium (Iodine).',
        },
        {
          user: 'Sebutkan 2 tahap fotosintesis!',
          level: 'hafalan',
          assistant: 'Reaksi Terang (Light Reactions) dan Reaksi Gelap (Calvin Cycle).',
        },
      ],
    },

    // ─── 5 SISWA BARU / BELUM BANYAK BERTANYA (⚪ BARU) ──────────────────────────
    {
      name: 'Farhan Maulana',
      username: 'farhan.m',
      password: 'belajar123',
      chats: [
        {
          user: 'Bagaimana cara tumbuhan menyerap air untuk fotosintesis?',
          level: 'pemahaman',
          assistant: 'Air diserap oleh rambut akar secara osmosis, lalu bergerak menuju jaringan xilem dan diangkut menuju mesofil daun melalui daya hisap daun dan kapilaritas batang.',
        },
      ],
    },
    {
      name: 'Salma Salsabila',
      username: 'salma.salsabila',
      password: 'belajar123',
      chats: [
        {
          user: 'Apakah lumut juga melakukan fotosintesis?',
          level: 'hafalan',
          assistant: 'Ya, tumbuhan lumut (Bryophyta) memiliki klorofil dan melakukan fotosintesis autotrof.',
        },
      ],
    },
    {
      name: 'Yoga Pratama',
      username: 'yoga.pratama',
      password: 'belajar123',
      chats: [],
    },
    {
      name: 'Maya Safitri',
      username: 'maya.safitri',
      password: 'belajar123',
      chats: [],
    },
    {
      name: 'Gita Gutawa',
      username: 'gita.gutawa',
      password: 'belajar123',
      chats: [],
    },
  ];

  const SESSIONS_CONFIG = [
    {
      id: 'sesi-demo-biologi-fotosintesis',
      title: 'Kelas 10-A • Fotosintesis & Metabolisme Tumbuhan',
      subject: 'Biologi (Kelas 10-A)',
      aiTheme: 'biologi',
      suffix: '',
      sampleChats: [
        { user: 'Apa fungsi klorofil pada fotosintesis?', level: 'hafalan', assistant: 'Klorofil berfungsi menyerap foton energi cahaya matahari untuk memulai reaksi terang.' },
        { user: 'Mengapa reaksi gelap tetap butuh reaksi terang?', level: 'pemahaman', assistant: 'Karena reaksi gelap membutuhkan pasokan energi ATP dan NADPH hasil dari reaksi terang untuk memfiksasi CO2 menjadi glukosa.' },
        { user: 'Analisis pengaruh kekurangan air terhadap laju siklus Calvin!', level: 'analisis', assistant: 'Kekurangan air menyebabkan stomata menutup untuk mencegah transpirasi berlebih, sehingga suplai CO2 berkurang dan siklus Calvin melambat drastis.' },
      ]
    },
    {
      id: 'sesi-demo-biologi-sel-10b',
      title: 'Kelas 10-B • Struktur Sel & Transpor Membran',
      subject: 'Biologi (Kelas 10-B)',
      aiTheme: 'biologi',
      suffix: '.10b',
      sampleChats: [
        { user: 'Sebutkan fungsi mitokondria di dalam sel!', level: 'hafalan', assistant: 'Mitokondria berfungsi sebagai pusat respirasi seluler penghasil energi ATP.' },
        { user: 'Bagaimana perbedaan transpor aktif dan pasif pada membran?', level: 'pemahaman', assistant: 'Transpor pasif terjadi spontan searah gradien konsentrasi tanpa energi ATP, sedangkan transpor aktif melawan gradien dan membutuhkan energi ATP serta protein pembawa.' },
        { user: 'Prediksikan apa yang terjadi jika sel darah merah diletakkan dalam larutan garam hipertonik!', level: 'analisis', assistant: 'Air di dalam eritrosit akan keluar secara osmosis ke lingkungan luar yang pekat, menyebabkan eritrosit mengalami krenasi (mengerut).' },
      ]
    },
    {
      id: 'sesi-demo-biologi-sirkulasi-11ipa1',
      title: 'Kelas 11-IPA 1 • Sistem Sirkulasi & Fisiologi Darah',
      subject: 'Biologi (Kelas 11-IPA 1)',
      aiTheme: 'biologi',
      suffix: '.11a',
      sampleChats: [
        { user: 'Apa itu eritrosit dan leukosit?', level: 'hafalan', assistant: 'Eritrosit adalah sel darah merah pengangkut O2, sedangkan leukosit adalah sel darah putih untuk pertahanan imun tubuh.' },
        { user: 'Bagaimana mekanisme pembekuan darah saat tubuh terluka?', level: 'pemahaman', assistant: 'Trombosit pecah mengeluarkan trombokinase, yang bersama ion Ca2+ dan vitamin K mengubah protrombin menjadi trombin, lalu memicu fibrinogen membentuk jala benang fibrin menutup luka.' },
        { user: 'Mengapa penderita aterosklerosis memiliki risiko hipertensi dan serangan jantung lebih tinggi?', level: 'analisis', assistant: 'Plak kolesterol menyempitkan lumen pembuluh arteri sehingga resistensi perifer meningkat tajam, memaksa ventrikel kiri jantung memompa lebih kuat yang berakibat pada lonjakan tekanan darah (hipertensi).' },
      ]
    }
  ];

  for (const sConf of SESSIONS_CONFIG) {
    db.prepare(`
      INSERT INTO sessions (id, teacher_id, title, subject, ai_theme, max_students, quota_per_student, status, created_at, guardian_consent_at, guardian_consent_statement)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sConf.id,
      teacher.id,
      sConf.title,
      sConf.subject,
      sConf.aiTheme,
      20,
      20,
      'active',
      now - 7200000,
      // Demo classes carry the same attestation a real class would.
      now - 7200000,
      GUARDIAN_CONSENT_STATEMENT
    );


    for (let i = 0; i < CLASSROOM_DATA.length; i++) {
      const s = CLASSROOM_DATA[i];
      const username = sConf.suffix ? `${s.username}${sConf.suffix}` : s.username;
      const studentId = `std-${sConf.id}-${i + 1}`;

      db.prepare(`
        INSERT INTO students (id, session_id, username, password_hash, display_name, room_code, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        studentId,
        sConf.id,
        username,
        // Demo passwords are documented in the README; only the hash is stored.
        bcrypt.hashSync(s.password, 10),
        s.name,
        null,
        now - 7200000 + i * 10000
      );

      const chatsToUse = sConf.id === 'sesi-demo-biologi-fotosintesis'
        ? s.chats
        : (i < 8 ? sConf.sampleChats : i < 14 ? sConf.sampleChats.slice(0, 2) : i < 17 ? sConf.sampleChats.slice(0, 1) : []);

      let offset = 3600000;
      for (let j = 0; j < chatsToUse.length; j++) {
        const c = chatsToUse[j];
        const uId = `msg-u-${sConf.id}-${i}-${j}-${Date.now()}`;
        const aId = `msg-a-${sConf.id}-${i}-${j}-${Date.now()}`;
        const t = now - offset + j * 120000;

        db.prepare(`
          INSERT INTO messages (id, session_id, student_id, room_code, role, content, question_level, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uId, sConf.id, studentId, null, 'user', c.user, c.level, t);

        db.prepare(`
          INSERT INTO messages (id, session_id, student_id, room_code, role, content, question_level, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(aId, sConf.id, studentId, null, 'assistant', c.assistant, null, t + 1000);
      }
    }
  }

  console.log('[Seed] Database seeded with 3 classes (60 students) and full multi-class chat history!');

  // ─── Module ingestion ──────────────────────────────────────────────────────
  // Without this, every seeded session has an empty knowledge base and the tutor
  // has nothing to ground answers in — which makes the retrieval lock impossible
  // to evaluate. Only class 10-A gets a module; the other two are deliberately
  // left empty so the "teacher has not uploaded material yet" gate is demoable.
  const modulePath = path.join(process.cwd(), 'public', 'materi-contoh-fotosintesis.txt');

  if (fs.existsSync(modulePath)) {
    const { count, real } = await seedModule('sesi-demo-biologi-fotosintesis', modulePath);
    console.log(
      `[Seed] Module ingested for Kelas 10-A: ${count} chunks, ` +
        `${real ? 'Gemini embeddings' : 'heuristic embeddings'}.`
    );

    if (!real) {
      console.warn(
        '[Seed] WARNING: no usable GEMINI_API_KEY, so chunks were embedded with the\n' +
          '        64-dimensional heuristic. If you add a key later, RE-RUN THIS SEED —\n' +
          '        heuristic chunk vectors cannot be compared against Gemini query vectors,\n' +
          '        and retrieval will return irrelevant results until they match.'
      );
    }
  } else {
    console.warn(`[Seed] Module file not found at ${modulePath}; knowledge base left empty.`);
  }

  console.log('[Seed] Kelas 10-B and Kelas 11-IPA 1 intentionally have no module uploaded.');
}

seed().catch(console.error);

