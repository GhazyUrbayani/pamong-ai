import { sqlite } from './client';
import bcrypt from 'bcryptjs';

/**
 * Rich Synthetic Data Seeder for PAMONG AI Classroom Demo.
 * 
 * Sets up:
 * 1. Demo Teacher: guru@pamong-ai.id / demo1234 (Ibu Sari, S.Pd.)
 * 2. Active Session: Fotosintesis & Metabolisme Tumbuhan (Biologi)
 * 3. 20 Authentic Indonesian Students
 * 4. Realistic conversation history covering Bloom's Taxonomy:
 *    - 4 Students in Analisis / HOTS (🟢 Progresif)
 *    - 7 Students in Pemahaman / MOTS (🔵 Konseptual)
 *    - 4 Students in Hafalan / LOTS (🟠 Butuh Bimbingan Guru)
 *    - 5 Students with 0-1 messages (⚪ Baru Bergabung)
 */

interface MockStudent {
  name: string;
  username: string;
  password: string;
  chats: Array<{
    user: string;
    level: 'hafalan' | 'pemahaman' | 'analisis';
    assistant: string;
  }>;
}

const CLASSROOM_DATA: MockStudent[] = [
  // ─── 4 SISWA TINGKAT ANALISIS (HOTS - STATUS HIJAU) ─────────────────────────
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
        assistant: 'Laju fotosintesis TIDAK akan terus naik, melainkan mencapai titik jenuh (plateau) karena konsentrasi CO2 menjadi faktor pembatas (limiting factor). Reaksi terang mungkin menghasilkan banyak ATP dan NADPH, tetapi siklus Calvin kekurangan substrat CO2 untuk fiksasi oleh enzim RuBisCO.',
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
        assistant: 'Klorofil berfungsi menyerap energi foton dari cahaya matahari, khususnya pada panjang gelombang biru dan merah, untuk memulai reaksi fotokimia fotosintesis.',
      },
      {
        user: 'Bagaimana jalur fotosintesis tumbuhan CAM berbeda dengan tumbuhan C3 dan C4 dalam mengatasi kekeringan?',
        level: 'pemahaman',
        assistant: 'Tumbuhan CAM memisahkan fiksasi CO2 dan siklus Calvin berdasarkan WAKTU (temporal). Stomata terbuka di malam hari untuk mengikat CO2 menjadi asam malat, dan tertutup di siang hari untuk mencegah transpirasi berlebih sambil menjalankan siklus Calvin menggunakan energi cahaya.',
      },
      {
        user: 'Mengapa tumbuhan C4 lebih efisien melakukan fotosintesis di daerah tropis bersuhu tinggi dibanding tumbuhan C3?',
        level: 'analisis',
        assistant: 'Karena tumbuhan C4 menggunakan enzim PEP karboksilase yang memiliki afinitas jauh lebih tinggi terhadap CO2 dan tidak dapat mengikat O2. Hal ini mencegah fotorespirasi (pemborosan energi saat RuBisCO mengikat O2), sehingga tumbuhan C4 tetap efisien meskipun stomata menyempit di suhu tinggi.',
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

  // ─── 7 SISWA TINGKAT PEMAHAMAN (MOTS - KONSEPTUAL) ──────────────────────────
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

  // ─── 4 SISWA TINGKAT HAFALAN (LOTS - STATUS MERAH / BUTUH DORONGAN) ──────────
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

  // ─── 5 SISWA BARU / BELUM BANYAK BERTANYA ──────────────────────────────────
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

export async function seedClassroomDemo() {
  console.log('[Seed] Populating rich multi-class synthetic classroom data...');

  // 1. Ensure teacher Ibu Sari exists
  const teacherEmail = 'guru@pamong-ai.id';
  let teacher = sqlite.prepare('SELECT id FROM teachers WHERE email = ?').get(teacherEmail) as { id: string } | undefined;
  
  if (!teacher) {
    const teacherId = crypto.randomUUID();
    const hash = await bcrypt.hash('demo1234', 10);
    sqlite.prepare(
      'INSERT INTO teachers (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(teacherId, 'Ibu Sari, S.Pd.', teacherEmail, hash, Date.now());
    teacher = { id: teacherId };
  }

  // 2. Clean old sessions and replace with multi-class sessions
  sqlite.exec(`
    DELETE FROM messages;
    DELETE FROM students;
    DELETE FROM knowledge_chunks;
    DELETE FROM sessions;
  `);

  const now = Date.now();

  const SESSIONS_CONFIG = [
    {
      id: 'sesi-demo-biologi-fotosintesis',
      title: 'Kelas 10-A • Fotosintesis & Metabolisme Tumbuhan',
      subject: 'Biologi (Kelas 10-A)',
      aiTheme: 'biologi',
      suffix: '',
      sampleChats: [
        { u: 'Apa fungsi klorofil pada fotosintesis?', lvl: 'hafalan', a: 'Klorofil berfungsi menyerap foton energi cahaya matahari untuk memulai reaksi terang.' },
        { u: 'Mengapa reaksi gelap tetap butuh reaksi terang?', lvl: 'pemahaman', a: 'Karena reaksi gelap membutuhkan pasokan energi ATP dan NADPH hasil dari reaksi terang untuk memfiksasi CO2 menjadi glukosa.' },
        { u: 'Analisis pengaruh kekurangan air terhadap laju siklus Calvin!', lvl: 'analisis', a: 'Kekurangan air menyebabkan stomata menutup untuk mencegah transpirasi berlebih, sehingga suplai CO2 berkurang dan siklus Calvin melambat drastis.' },
      ]
    },
    {
      id: 'sesi-demo-biologi-sel-10b',
      title: 'Kelas 10-B • Struktur Sel & Transpor Membran',
      subject: 'Biologi (Kelas 10-B)',
      aiTheme: 'biologi',
      suffix: '.10b',
      sampleChats: [
        { u: 'Sebutkan fungsi mitokondria di dalam sel!', lvl: 'hafalan', a: 'Mitokondria berfungsi sebagai pusat respirasi seluler penghasil energi ATP.' },
        { u: 'Bagaimana perbedaan transpor aktif dan pasif pada membran?', lvl: 'pemahaman', a: 'Transpor pasif terjadi spontan searah gradien konsentrasi tanpa energi ATP, sedangkan transpor aktif melawan gradien dan membutuhkan energi ATP serta protein pembawa.' },
        { u: 'Prediksikan apa yang terjadi jika sel darah merah diletakkan dalam larutan garam hipertonik!', lvl: 'analisis', a: 'Air di dalam eritrosit akan keluar secara osmosis ke lingkungan luar yang pekat, menyebabkan eritrosit mengalami krenasi (mengerut).' },
      ]
    },
    {
      id: 'sesi-demo-biologi-sirkulasi-11ipa1',
      title: 'Kelas 11-IPA 1 • Sistem Sirkulasi & Fisiologi Darah',
      subject: 'Biologi (Kelas 11-IPA 1)',
      aiTheme: 'biologi',
      suffix: '.11a',
      sampleChats: [
        { u: 'Apa itu eritrosit dan leukosit?', lvl: 'hafalan', a: 'Eritrosit adalah sel darah merah pengangkut O2, sedangkan leukosit adalah sel darah putih untuk pertahanan imun tubuh.' },
        { u: 'Bagaimana mekanisme pembekuan darah saat tubuh terluka?', lvl: 'pemahaman', a: 'Trombosit pecah mengeluarkan trombokinase, yang bersama ion Ca2+ dan vitamin K mengubah protrombin menjadi trombin, lalu memicu fibrinogen membentuk jala benang fibrin menutup luka.' },
        { u: 'Mengapa penderita aterosklerosis memiliki risiko hipertensi dan serangan jantung lebih tinggi?', lvl: 'analisis', a: 'Plak kolesterol menyempitkan lumen pembuluh arteri sehingga resistensi perifer meningkat tajam, memaksa ventrikel kiri jantung memompa lebih kuat yang berakibat pada lonjakan tekanan darah (hipertensi).' },
      ]
    }
  ];

  for (const sConf of SESSIONS_CONFIG) {
    sqlite.prepare(`
      INSERT INTO sessions (id, teacher_id, title, subject, ai_theme, max_students, quota_per_student, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sConf.id,
      teacher.id,
      sConf.title,
      sConf.subject,
      sConf.aiTheme,
      20,
      20,
      'active',
      now - 7200000
    );

    // Populate 20 students per session
    for (let sIdx = 0; sIdx < CLASSROOM_DATA.length; sIdx++) {
      const studentData = CLASSROOM_DATA[sIdx];
      const username = sConf.suffix ? `${studentData.username}${sConf.suffix}` : studentData.username;
      const studentId = `student-${sConf.id}-${sIdx + 1}`;

      sqlite.prepare(`
        INSERT INTO students (id, session_id, username, password_plain, display_name, room_code, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        studentId,
        sConf.id,
        username,
        studentData.password,
        studentData.name,
        null,
        now - 3600000 + sIdx * 60000
      );

      // Distribute realistic chats
      const chatsToUse = sConf.id === 'sesi-demo-biologi-fotosintesis' 
        ? studentData.chats 
        : (sIdx < 8 ? sConf.sampleChats : sIdx < 14 ? sConf.sampleChats.slice(0, 2) : sIdx < 17 ? sConf.sampleChats.slice(0, 1) : []);

      let timeOffset = 1800000;
      for (let cIdx = 0; cIdx < chatsToUse.length; cIdx++) {
        const chat = chatsToUse[cIdx];
        const userMsg = 'user' in chat ? (chat as any).user : (chat as any).u;
        const level = 'level' in chat ? (chat as any).level : (chat as any).lvl;
        const assistantMsg = 'assistant' in chat ? (chat as any).assistant : (chat as any).a;

        const userMsgId = crypto.randomUUID();
        const assistantMsgId = crypto.randomUUID();
        const msgTime = now - timeOffset + cIdx * 120000;

        sqlite.prepare(`
          INSERT INTO messages (id, session_id, student_id, room_code, role, content, question_level, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(userMsgId, sConf.id, studentId, null, 'user', userMsg, level, msgTime);

        sqlite.prepare(`
          INSERT INTO messages (id, session_id, student_id, room_code, role, content, question_level, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(assistantMsgId, sConf.id, studentId, null, 'assistant', assistantMsg, null, msgTime + 1000);
      }
    }
  }

  console.log(`[Seed] Successfully created 3 classes (60 students) for Ibu Sari with rich multi-class data!`);
}

