# Pamong AI

Pamong AI is a competition MVP for teacher-scoped tutoring: a teacher creates a class session, uploads one module, students chat against that session, and the teacher sees the observed distribution of question forms.

## What the MVP does

- Teacher session creation and generated student credentials.
- PDF/TXT/MD material upload.
- Session-scoped retrieval over stored embeddings.
- Student chat with a quota.
- Three heuristic **question-form categories**:
  - `hafalan` → **Pertanyaan fakta**
  - `pemahaman` → **Pertanyaan penjelasan**
  - `analisis` → **Pertanyaan penerapan atau penalaran**
- Teacher dashboard showing the distribution of those categories.
- Explicit unclassified counts and classification provenance.
- Session ownership checks and hashed student passwords.

These categories describe the wording/request in a question. They are **not** validated measurements of Bloom level, cognitive ability, mastery, learning progress, LOTS/MOTS/HOTS, or educational effectiveness. A student asking an analytical question does not by itself demonstrate the ability to analyse.

## Classification integrity

The classifier is a separate LLM call, but only an **exact valid label from a real model** enters the valid-category denominator.

Each user message can carry `classification_provenance`:

- `model` — exact valid label from a real provider response
- `degraded` — demo/unavailable provider path
- `malformed` — model answered, but not with an exact allowed label
- `error` — classifier threw
- `not_run` — classification intentionally skipped
- `synthetic` — seeded/demo transcript written by this repository

Historical rows with no provenance are treated as legacy/unknown. Unknown, degraded, malformed, error, synthetic, and legacy rows are shown separately and excluded from percentages. This prevents provider failures from silently appearing as “Pertanyaan fakta”.

## Retrieval behavior

Retrieval is scoped by `session_id`. There are four distinct non-answer states:

1. **No material** — the session has zero chunks.
2. **No sufficiently relevant passage** — material exists, but no chunk meets the configured experimental similarity floor.
3. **Retrieval provider error** — query embedding could not be produced.
4. **Incompatible embeddings** — stored/query provider, model, or dimensions do not match.

All four states return fixed application messages. The LLM is not asked to invent a refusal sentence.

`RAG_MIN_SCORE` defaults to `0.10`. It is deliberately documented as experimental. Raising it without an evaluation set does not prove grounding.

Prompt-based grounding is also not a guarantee: when relevant chunks are retrieved, the answer model is instructed to use only those chunks, but there is no entailment verifier or citation-span checker yet.

## Embedding provenance

Every newly indexed chunk stores:

- `embedding_provider`
- `embedding_model`
- `embedding_dimensions`

The query embedding must match all three. Existing chunks created before these fields existed are not guessed or silently mixed with another vector space; the UI asks the teacher to re-upload the module.

Default Gemini embedding model: `gemini-embedding-001`.

## Provider failures and demo mode

Production-facing behavior does not silently substitute module-flavoured filler.

- With a working provider: provenance is `model`.
- With no provider/failure and `PAMONG_DEMO_MODE=false`: the app returns a clear unavailable message.
- With `PAMONG_DEMO_MODE=true`: the app can show an explicitly labelled demo response.

Demo outputs do not become valid classifier statistics.

## Deployment runtime compatibility

This MVP currently persists data with `better-sqlite3` in a local `pamong-ai.db` file. That requires a Node.js runtime where the native SQLite package can execute and the filesystem used for the database is writable and persistent.

A plain Cloudflare Workers/OpenNext deployment is **not a compatible persistence target for the current repository as-is**. Cloudflare Workers exposes many Node.js APIs, but native/local SQLite persistence used by `better-sqlite3` is not the storage architecture this MVP implements. Deploy the current MVP to a compatible Node host, or treat a move to Cloudflare D1/another Workers-native persistent database as a separate database-platform migration. That migration is intentionally outside this correction patch.

Auth routes keep database imports inside their request error boundaries so an incompatible runtime returns a structured JSON service error instead of an empty/non-JSON 500.

## Local setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Recommended environment values:

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.7-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
PAMONG_DEMO_MODE=false
RAG_MIN_SCORE=0.10
JWT_SECRET=...
```

If an existing database contains knowledge chunks from an older version, re-upload the module once so embedding provenance is recorded.

## Checks

Zero-secret policy tests:

```bash
npm test
```

Also run before submission:

```bash
npm run lint
npm run build
```

The policy tests cover valid/malformed/degraded/error classification states, denominator handling including all-unknown data, distinct no-material vs irrelevant responses, embedding identity mismatch, quota gating, and conversation isolation policy.

## Demo steps

1. Start the app and sign in as the teacher.
2. Create or open a teacher-owned session.
3. Upload a module.
4. Sign in as a student from that session.
5. Ask one direct fact question, one explanation question, and one application/reasoning question.
6. Open the teacher dashboard.
7. Confirm only model-provenance labels enter the percentage denominator and any unknown labels appear separately.
8. For a no-material demo, open a session with no module: the response should be deterministic and should not call the answer model.
9. For explicit offline UI demonstration, set `PAMONG_DEMO_MODE=true`; do not present those outputs as live educational results.

Seeded transcripts are synthetic examples. They are marked `synthetic`, not passed off as live classifier output.

## What is not claimed

This repository does not currently claim measured classifier accuracy, retrieval precision/recall, answer faithfulness, learning gains, classroom effectiveness, independent-answer assessment, spaced practice, or autonomous agents.

Later work should build a teacher-labelled evaluation set, measure classification agreement/errors, calibrate retrieval/refusal on realistic questions, and test classroom usability before making educational-effectiveness claims.
