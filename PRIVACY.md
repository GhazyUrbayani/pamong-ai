# Privacy and data handling

This document describes what Pamong AI actually stores and who can actually read it, as implemented in this repository today — not what a production deployment ought to do. Where the implementation falls short of Indonesia's [UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi](https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022) ("UU PDP"), it is recorded below as a **known gap** rather than papered over.

Pamong AI in its current state is a prototype. It has not been assessed against UU PDP by counsel, and nothing here is legal advice. Several gaps recorded in earlier revisions have been closed — credentials are hashed, teacher access is scoped to owned sessions, logins are throttled, consent is attested and recorded, and erasure and retention paths exist. **What remains open is listed in full at the end, and the largest of it is deployment-shaped: no region guarantee, no scheduled purge, no breach detection. Real student data should wait on those.**

---

## What is stored

Everything lives in one SQLite file, `pamong-ai.db`, created in the project root. Schema: [`db/schema.ts`](db/schema.ts).

### Teachers (`teachers`)

| Field | Content | Notes |
|---|---|---|
| `name` | Teacher's name | Entered at seed time |
| `email` | Teacher's email | Login identifier; unique |
| `password_hash` | bcrypt hash, cost 10 | Plaintext never stored |

### Students (`students`)

| Field | Content | Notes |
|---|---|---|
| `username` | Generated, e.g. `ahmad.fauzi` | From a fixed pool, not supplied by the student |
| `password_hash` | bcrypt hash, cost 10 | Plaintext is shown to the teacher once at generation or reset and never stored |
| `display_name` | Generated Indonesian name | From a fixed pool, not a real roster |
| `session_id` | Class the student belongs to | |
| `room_code` | Optional group identifier | Shares a transcript across a group when set |

No student email, phone number, date of birth, photograph, national identity number, location, or device identifier is collected anywhere in the codebase. The account is a seat in a class, not a person's identity — **unless** a teacher maps seats to real students on paper or renames them, which is outside the system's control and moves the linkage off-platform rather than removing it.

### Sessions (`sessions`)

Class metadata (title, subject, quota), plus the guardian-consent record: `guardian_consent_at` and `guardian_consent_statement` — when the teacher attested that consent was obtained, and the exact versioned wording they attested to.

### Messages (`messages`)

Every student question and every AI answer is stored in full, with `student_id`, `session_id`, `role`, the legacy-named question category field (`question_level`), `classification_provenance`, and a millisecond timestamp. The category describes question form; it is not a validated cognitive-level assessment. This is the most sensitive data the system holds: free text typed by a minor, which may contain anything the student chose to type, including personal information the schema never asked for.

### Module content (`knowledge_chunks`)

Text extracted from the teacher's uploaded file, split into ~500-character chunks, with its embedding vector stored as a JSON string plus embedding provider, model, and dimensions. Deleted and replaced when the teacher re-uploads for that session. The original uploaded file is not retained — only the extracted text.

### Not stored

No cookies are set by the application. Authentication tokens (`jose` JWT, 24-hour expiry) are held in the browser's `localStorage`. There is no analytics, no telemetry, no third-party tracking script, and no access logging beyond whatever the host process writes to stdout.

---

## Who can read a transcript

| Actor | Access | Enforced where |
|---|---|---|
| The student | Their own transcript, or their room's shared transcript | [`chat/history/route.ts`](app/api/chat/history/route.ts) — scoped to the `sub` claim in their own JWT |
| The owning teacher | Their own students' full transcripts. No password: nothing readable is stored | [`guru/student-chat/[studentId]/route.ts`](app/api/guru/student-chat/%5BstudentId%5D/route.ts) — resolves the student's session and checks `teacherId` |
| The owning teacher | Their own sessions' aggregated stats | [`dashboard/[sesiId]/stream/route.ts`](app/api/dashboard/%5BsesiId%5D/stream/route.ts) — checks `teacherId` before opening the stream |
| The owning teacher | Their session and its student list | [`sesi/[id]/route.ts:23`](app/api/sesi/%5Bid%5D/route.ts#L23) |
| Another teacher | Nothing. Every teacher endpoint is scoped to sessions that teacher owns | verified: a second teacher account receives `403` on both endpoints above |
| Guardians | No access. There is no guardian account, view, or export | See known gap 3 |
| The owning teacher | A newly issued password, once, at the moment they reset it | [`sesi/[id]/kredensial/route.ts`](app/api/sesi/%5Bid%5D/kredensial/route.ts) — the only endpoint that emits a password, and only one it just created |
| The model provider | Each question, the retrieved module chunks, and recent turns are sent to Google (or an OpenAI-compatible endpoint) at inference time | [`llm.service.ts`](services/llm.service.ts) |

Every endpoint that returns teacher-visible data now resolves the owning session and compares its `teacherId` against the `sub` claim of the caller's token; a teacher role alone is never sufficient. One residual: a request for a student who exists but belongs to another teacher returns `403` while a wholly unknown student returns `404`, so a teacher who guesses IDs can learn that a student record exists. No transcript, password, or analytics data is exposed either way.

---

## Retention

**Default retention is 180 days from session creation — roughly one school term — and it is enforced by a script, not a scheduler.**

`node scripts/purge.js` deletes every session past the period along with all of its transcripts, student records, and indexed module text. `--dry-run` reports what would go without touching anything; `--days=N` or `PAMONG_RETENTION_DAYS` overrides the period. It is transactional per session: a session and its children are removed together or not at all.

Two erasure paths exist besides the purge:

- `DELETE /api/sesi/[id]` — immediate, irreversible erasure of one session and everything in it, restricted to the teacher who owns it. This is the data-subject erasure route. It is API-only by design: there is no button in the teacher UI, so a demo cannot be wiped by a stray click.
- Re-uploading a module replaces that session's `knowledge_chunks` ([`rag.service.ts:42`](services/rag.service.ts#L42)).

**Nothing runs the purge automatically.** There is no deployment configuration in this repository, and therefore nothing to schedule it from — so in practice data is kept until someone runs it. That is the honest state: the retention *mechanism* exists and works, the retention *guarantee* does not. Whoever deploys this must wire the script to cron or an equivalent.

---

## Storage region

The database is a file on whichever machine runs the process. In development that is the developer's laptop. **There is no deployment configuration in this repository** — no Dockerfile, no CI, no Azure or other cloud manifest — so no region is currently pinned, guaranteed, or verifiable by anything in the code.

Inference data leaves the machine. With `GEMINI_API_KEY` set, questions and retrieved module text go to Google's Generative Language API; with `OPENAI_API_KEY` set, to the configured OpenAI-compatible endpoint. Neither call pins a region, and neither provider's data-processing terms have been reviewed for this project. This is a cross-border transfer of personal data and UU PDP constrains it — the receiving jurisdiction must offer adequate protection, or the transfer needs an appropriate safeguard or the data subject's consent. Nothing in the code establishes any of those.

---

## Guardian consent

**The consent is obtained by the school. The platform records the attestation that it was.**

UU PDP requires that a child's personal data be processed with the consent of a parent or guardian (Art. 25), and obliges the controller to be able to *demonstrate* that consent — not merely assert it (Arts. 20–22).

No session can exist without an attestation. Creating a class requires the teacher to confirm a versioned statement, and the submit button stays disabled until they do. The confirmation is validated in the API route *and* in `SessionService.createSession`, so no code path can create a session that processes a child's data without one. What is stored is the timestamp and the exact statement text, alongside the teacher who made it — an auditable record of who attested to what, and when. The statement is versioned (`v1: …`) so that rewording it later cannot silently reinterpret records made under the old text.

**What this is not.** It is a teacher's attestation, not a per-guardian record. The platform holds no signed form, no guardian identity, and no per-student consent row, because the school collects consent through its own process and the platform deliberately stores no guardian personal data. There is also no withdrawal flow: a guardian who withdraws consent must go to the school, and the teacher acts on it by erasing the session (`DELETE /api/sesi/[id]`) or resetting that student. Closing that properly means per-student consent state and a withdrawal route — see known gap 3.

---

## Known gaps

Ordered by severity. Each is a real deviation from what UU PDP requires of a personal-data controller. Items struck through have been closed and are kept here so the record of what was wrong stays visible; the rest are open.

**1. ~~Student passwords are stored in plaintext.~~ Fixed.** `students.password_plain` previously held every password as typed, and the teacher-facing API returned it. Passwords are now bcrypt hashes (cost 10); the plaintext exists only in the response that creates or resets a credential, and no read endpoint emits one. Because nothing can be read back, a teacher helping a student who lost their slip *issues a new password* rather than recovering the old one — `POST /api/sesi/[id]/kredensial`, ownership-checked, returning the new value once. Existing databases are migrated on startup: plaintext is hashed and the column dropped. Passwords are also random per student (~40 bits) rather than drawn from a six-entry pool, so a classmate cannot guess one. Verified end to end: old password rejected, new password accepted, nothing named "password" left in the student-chat response.

**2. ~~Teacher authorization is role-only on two endpoints.~~ Fixed.** `GET /api/guru/student-chat/[studentId]` and `GET /api/dashboard/[sesiId]/stream` previously checked only that the JWT role was `teacher`, so any valid teacher token read any student's transcript and plaintext password. Both now resolve the owning session and verify `session.teacherId === payload.sub`. Verified with a second teacher account: `403` on both endpoints, with no regression for the owner.

**3. Consent is attested, not collected per guardian.** A session cannot be created without a teacher attestation, and that attestation is stored with its timestamp and statement version — so the controller can demonstrate a claim of consent for every class. What is still missing is the layer beneath it: no per-student consent state, no record of the guardian who gave it, and no withdrawal flow inside the product. Withdrawal today means asking the teacher to erase the session. *Fix:* per-student consent rows and a withdrawal action that erases that student's data specifically.

**4. Retention is enforced by hand, not by a scheduler.** An erasure path now exists (`DELETE /api/sesi/[id]`, owner-only, cascading) and so does a retention purge (`scripts/purge.js`, default 180 days, transactional, with `--dry-run`). Neither runs on its own: there is no deployment configuration in this repository to schedule the purge from, so data is kept until someone executes it. Still missing for the full set of data-subject rights: no student-facing export, and no correction route. *Fix:* schedule the purge wherever this is deployed, and add export/correction endpoints.

**5. No region guarantee and unreviewed cross-border transfer.** See "Storage region". Questions typed by minors are sent to a foreign model provider under terms nobody on this project has reviewed. *Fix:* review the provider's data-processing terms, pin a region where the provider offers one, disclose the transfer in a student-facing notice, and record it in a processing register.

**6. No breach detection or notification procedure.** UU PDP Art. 46 requires written notification to affected data subjects and to the supervisory authority within 3×24 hours of a data protection failure. There is no logging that would detect unauthorized access, no incident procedure, and no contact route to students or guardians through which a notification could be delivered.

**7. Transcripts are shared within a room.** When `room_code` is set, `messageQueries.getByRoom` returns every message from every student sharing that code, so students in a room read each other's questions. This is intentional for collaborative work, but it is a disclosure of one student's free text to their classmates and no notice anywhere tells them so.

**8. ~~The JWT secret has a hardcoded fallback.~~ Fixed.** `lib/auth.ts` previously fell back to a literal string published in this repository, so a deployment that forgot `JWT_SECRET` signed tokens with a value anyone could read — and therefore forge. The constant is gone: in production a missing `JWT_SECRET` now throws rather than signing anything, and in development a random per-process secret is generated with a warning. Verified: a token signed with the old constant is rejected with `401` on every teacher endpoint.

**9. ~~No rate limiting on authentication.~~ Fixed, with a caveat.** Both login endpoints now throttle on two axes: 10 attempts per account and 40 per address in a 5-minute window, refusing with `429` and a `Retry-After` header, and clearing on a successful login so honest users are never locked out. The throttle runs before any database or bcrypt work, so it also blunts the CPU-exhaustion angle. Verified: the 11th consecutive failure returns `429 Retry-After: 300`. **Caveat:** the counter is in-process. It resets on restart and does not coordinate across instances, so it must move to a shared store before this is scaled horizontally. Failed-login *logging* is still absent, which gap 6 depends on.

**10. No processing register, no privacy notice, no DPO.** There is no record of processing activities, no student- or guardian-facing privacy notice in the application, and no designated data protection officer — obligations UU PDP places on controllers processing children's data at scale.

---

## Reporting a privacy issue

Open a GitHub issue for anything non-sensitive. For a suspected data exposure, contact the repository owner directly rather than filing publicly.
