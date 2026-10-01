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
  if (!result) return { category: 'unclassified', provenance: 'unavailable' };
  if (result.provenance === 'demo') return { category: 'unclassified', provenance: 'demo' };
  if (result.provenance === 'unavailable') return { category: 'unclassified', provenance: 'unavailable' };
  if (result.degraded || result.provenance !== 'model') return { category: 'unclassified', provenance: 'degraded' };
  const raw = String(result.text ?? '').trim().toLowerCase();
  if (raw === 'hafalan' || raw === 'pemahaman' || raw === 'analisis') return { category: raw, provenance: 'model' };
  return { category: 'unclassified', provenance: 'malformed' };
}

export async function classifyWithProvider(providerCall) {
  try {
    return resolveClassification(await providerCall());
  } catch {
    return resolveClassification(undefined, true);
  }
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

export async function runWithQuotaGate(used, quota, providerWork) {
  if (!hasQuota(used, quota)) return { allowed: false, value: undefined };
  return { allowed: true, value: await providerWork() };
}

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

export async function retrieveFromStoredChunks({
  dbChunks,
  query,
  embedQuery,
  rankChunks,
  topK = 3,
  minScore = 0.10,
}) {
  if (!dbChunks.length) return { status: 'empty_material', contextText: '', sources: [] };

  const first = dbChunks[0];
  if (
    !first.embeddingProvider ||
    !first.embeddingModel ||
    !first.embeddingDimensions ||
    dbChunks.some(
      (c) =>
        c.embeddingProvider !== first.embeddingProvider ||
        c.embeddingModel !== first.embeddingModel ||
        c.embeddingDimensions !== first.embeddingDimensions
    )
  ) {
    return { status: 'incompatible_embeddings', contextText: '', sources: [] };
  }

  let queryEmbedding;
  try {
    queryEmbedding = await embedQuery(query);
  } catch {
    return { status: 'provider_error', contextText: '', sources: [] };
  }

  if (
    !embeddingIdentityCompatible(queryEmbedding, {
      provider: first.embeddingProvider,
      model: first.embeddingModel,
      dimensions: first.embeddingDimensions,
    })
  ) {
    return { status: 'incompatible_embeddings', contextText: '', sources: [] };
  }

  let chunks;
  try {
    chunks = dbChunks.map((c) => {
      const embedding = JSON.parse(c.embeddingJson);
      if (!Array.isArray(embedding) || embedding.length !== first.embeddingDimensions) {
        throw new Error('incompatible embedding dimensions');
      }
      return { chunkText: c.chunkText, embedding, chunkIndex: c.chunkIndex };
    });
  } catch {
    return { status: 'incompatible_embeddings', contextText: '', sources: [] };
  }

  let top;
  try {
    top = rankChunks(queryEmbedding.values, chunks, topK, minScore);
  } catch {
    return { status: 'incompatible_embeddings', contextText: '', sources: [] };
  }

  if (!top.length) return { status: 'irrelevant', contextText: '', sources: [] };

  const ordered = [...top].sort((a, b) => a.chunkIndex - b.chunkIndex);
  return {
    status: 'ok',
    contextText: ordered.map((c) => c.chunkText).join('\n\n---\n\n'),
    sources: ordered.map(
      (c, i) => `[${i + 1}] Bagian ${c.chunkIndex + 1} dokumen (relevansi: ${(c.score * 100).toFixed(0)}%)`
    ),
  };
}
