export const QUESTION_CATEGORY_RUBRIC = {
  hafalan: { label: 'Pertanyaan fakta', description: 'Meminta fakta, istilah, definisi, nama, waktu, lokasi, atau daftar yang dapat dijawab secara langsung dari materi.' },
  pemahaman: { label: 'Pertanyaan penjelasan', description: 'Meminta penjelasan proses, hubungan, sebab-akibat, perbandingan, atau alasan berdasarkan materi.' },
  analisis: { label: 'Pertanyaan penerapan atau penalaran', description: 'Meminta penerapan materi pada situasi, prediksi konsekuensi, pemecahan masalah, evaluasi kasus, atau penalaran berbasis bukti.' },
};

export const FIXED_RETRIEVAL_REPLIES = {
  empty_material: 'Maaf, guru belum mengunggah materi pelajaran untuk sesi kelas ini. Tunggu bapak/ibu guru mengunggah modul dulu ya! 📚',
  irrelevant: 'Maaf, saya belum menemukan bagian materi yang cukup relevan untuk menjawab pertanyaan itu. Coba gunakan istilah yang ada di modul atau diskusikan dengan gurumu ya! 📚',
  provider_error: 'Maaf, pencarian materi sedang tidak tersedia. Coba lagi nanti atau minta bantuan gurumu ya.',
  incompatible_embeddings: 'Materi kelas ini perlu diindeks ulang sebelum dapat dipakai untuk pencarian. Minta guru mengunggah ulang modul, lalu coba lagi.',
};

export function resolveClassification(result, caughtError = false) {
  if (caughtError) return { category: 'unclassified', provenance: 'error' };
  if (!result || result.degraded || result.provenance !== 'model') return { category: 'unclassified', provenance: 'degraded' };
  const raw = String(result.text ?? '').trim().toLowerCase();
  if (raw === 'hafalan' || raw === 'pemahaman' || raw === 'analisis') return { category: raw, provenance: 'model' };
  return { category: 'unclassified', provenance: 'malformed' };
}

export function summarizeQuestionDistribution(rows) {
  const categories = { hafalan: 0, pemahaman: 0, analisis: 0 };
  let unclassified = 0;
  for (const row of rows) {
    const count = Number(row.count) || 0;
    const category = row.level;
    if (row.classificationProvenance === 'model' && (category === 'hafalan' || category === 'pemahaman' || category === 'analisis')) categories[category] += count;
    else unclassified += count;
  }
  const validClassified = categories.hafalan + categories.pemahaman + categories.analisis;
  return {
    categories,
    unclassified,
    validClassified,
    totalQuestions: validClassified + unclassified,
    percentages: {
      hafalan: validClassified ? categories.hafalan / validClassified : 0,
      pemahaman: validClassified ? categories.pemahaman / validClassified : 0,
      analisis: validClassified ? categories.analisis / validClassified : 0,
    },
  };
}

export function hasQuota(used, quota) { return used < quota; }

export function belongsToConversation(message, context) {
  if (message.sessionId !== context.sessionId) return false;
  if (context.roomCode) return message.roomCode === context.roomCode;
  return !message.roomCode && message.studentId === context.studentId;
}

export function embeddingIdentityCompatible(query, stored) {
  return Boolean(query && stored && query.provider && query.model && stored.provider && stored.model &&
    query.provider === stored.provider && query.model === stored.model &&
    Number(query.dimensions) > 0 && Number(query.dimensions) === Number(stored.dimensions));
}
