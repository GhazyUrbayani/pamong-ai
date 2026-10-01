# Pamong AI — MVP architecture decisions

## 1. One teacher session is one retrieval boundary

A student token carries its session ID. Retrieval reads chunks only for that session. Re-upload replaces the session's prior chunks. This is deliberately narrow for an MVP and avoids a cross-class knowledge base.

## 2. Question categories describe requests, not learner ability

The database keeps the historical keys `hafalan`, `pemahaman`, and `analisis` for compatibility. Their current rubric is:

- `hafalan`: direct fact/term/definition/list request
- `pemahaman`: explanation/process/relation/comparison/why request
- `analisis`: application/scenario/consequence/problem/evaluation/reasoning request

The keys must not be presented as C1–C6, LOTS/MOTS/HOTS, mastery, or learning progress. The classifier observes the form of a question only.

## 3. Classification provenance is first-class

`ClassifierService` calls `chatWithMeta()`. A real provider response must be an exact allowed key. Otherwise the message is `unclassified` with explicit provenance such as `demo`, `unavailable`, `degraded` (legacy/future fallback), `malformed`, or `error`.

Dashboard percentages use only `classification_provenance = 'model'`. Legacy rows with null provenance and synthetic seed rows are counted separately.

Temperature 0 is a generation setting, not proof of deterministic correctness.

## 4. Missing context is handled by application control flow

`RAGService.retrieve()` returns a status:

- `ok`
- `empty_material`
- `irrelevant`
- `provider_error`
- `incompatible_embeddings`

For every non-`ok` status, `ChatService` returns a fixed application message and does not call the answer model. “No teacher material” is therefore never used to hide a retrieval-provider failure.

## 5. Embedding identity must match

New knowledge chunks store provider, model, and dimensions. Query embeddings must match all three before cosine similarity runs.

Older chunks without provenance are intentionally rejected and require re-indexing. Heuristic demo vectors can only be compared with the same explicit heuristic identity. Provider vectors and heuristic vectors are never silently mixed.

## 6. Similarity threshold remains experimental

The default floor is `RAG_MIN_SCORE=0.10`. It is configurable, but not calibrated. A threshold change is not evidence that grounding is solved.

The generation step is still prompt-grounded; there is no post-generation entailment validator. Retrieval and educational quality remain unmeasured.

## 7. Provider failure and explicit demo mode

Without a usable provider, normal mode returns a clear unavailable response. An offline heuristic exists only when `PAMONG_DEMO_MODE=true`, and its classification output is labelled `demo`.

Classifier statistics include only `model` provenance. Demo, unavailable, degraded, malformed, error, synthetic, and legacy rows remain outside the valid denominator.

## 8. Quota gate precedes model work

Student/session ownership is validated first. The quota gate then wraps retrieval/classification provider work, so an exhausted quota prevents those provider calls.

## 9. Conversation isolation

Solo history is scoped to the current student. Room history is scoped to the same session and room code. The chat service additionally filters the retrieved history with the same policy before it enters a model context.

## 10. Storage and scaling

SQLite plus in-process cosine similarity is appropriate for the single-instance competition MVP. It is not a production scaling design. A larger deployment would move to a managed database/vector index and shared rate-limit/state infrastructure.

## 11. Evaluation remains future work

The MVP needs a teacher-labelled question set, classification agreement/error reporting, retrieval/refusal calibration, and classroom usability testing before stronger educational claims are appropriate.


## 12. Login is an MVP demonstration boundary

The login UI is explicitly labelled as competition-MVP access. Teacher login uses the documented demo identity. Student logins normally verify generated credentials against SQLite; the four documented seeded student identities have a stateless fallback only when SQLite cannot load. This fallback is not presented as production authentication and does not make downstream SQLite-backed routes Workers-compatible.


## 13. Data-source mode boundary

The teacher dashboard exposes an explicit `demo` / `real` data-source control. Demo mode reads fixed synthetic classes and transcripts from `lib/mvp-demo-data.ts`; Real Data mode uses the database only. A Real Data failure is surfaced as unavailable rather than falling back to synthetic content. This keeps provenance visible to judges and prevents mock examples from being mistaken for measured classroom activity.
