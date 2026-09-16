# Architecture decisions

Why this system is shaped the way it is. Each entry states the decision, the reasoning, what it costs, and what would force a change. For what exists and what does not, see [README.md](README.md#status).

---

## 1. PWA, not a native app

**Decision.** Ship a single Next.js web app with a manifest and a hand-written service worker (`public/sw.js`), installable to the home screen. No React Native, no Play Store build.

**Why.** The target device is a shared or low-end Android phone in an Indonesian classroom, and the target installer is a teacher with a class waiting. A URL plus "add to home screen" costs nothing; a Play Store install costs storage the device may not have, a Google account the student may not control, and a review cycle between each demo and the next. School networks also block app stores more often than they block the web.

The offline story is thin by design. The service worker caches the app shell and serves `offline.html` for navigations that fail, but the tutor is useless without a network round-trip to the model anyway. Caching the shell means a dropped connection shows the product rather than a browser error — that is the whole ambition.

**Cost.** No push notifications on iOS without extra work, no background sync, no filesystem access beyond what the browser allows. iOS PWA install is a hidden gesture most users never discover.

**Revisit when.** Push notifications become a real requirement (attendance nudges, homework reminders), or offline question-queueing becomes worth building.

---

## 2. Per-session message quota, not per-day or unlimited

**Decision.** Each student gets a fixed number of messages per class session, default 20, capped at 50 (`sessions.quota_per_student`). The check runs before any model call ([chat.service.ts:72](services/chat.service.ts#L72)); when it trips, the service returns a closing message and never touches the LLM.

**Why — three reasons, in order of importance.**

*Pedagogical.* The product's thesis is that question quality matters more than question volume. A scarce budget makes a student think before typing. Unlimited chat produces exactly the behaviour PISA 2025 associates with worse outcomes — daily, low-effort AI use. A quota is the cheapest available nudge toward deliberation.

*Analytical.* Bloom's distribution per student is only comparable across students if the denominators are similar. With unlimited messages, one chatty student's 80 recall questions would drown out a careful student's 6 analytical ones in every class-level aggregate.

*Economic.* Every message costs two model calls — one classification, one answer. A 20-student class has a hard, predictable ceiling: 400 messages, 800 calls. A teacher in a public school can be told the cost of a lesson in advance.

**Why per-session rather than per-day.** A session maps to a lesson, which is the unit a teacher actually plans. A daily quota would leak across lessons and let a student spend Monday's budget on Tuesday's topic, which breaks the per-module analytics.

**Cost.** The count is `SELECT count(*) FROM messages WHERE student_id = ? AND role = 'user'` ([students.ts:23](db/queries/students.ts#L23)) — it counts a student's messages across all time rather than scoping to the session row. Because a student record belongs to exactly one session, these coincide today; if students are ever reused across sessions, the quota silently becomes lifetime-per-student. A genuine mistake typed by a student also burns a message.

**Revisit when.** Students span multiple sessions — at which point the count must be scoped by `session_id` first.

---

## 3. Auto-generated credentials, no student registration

**Decision.** Creating a session generates all student accounts up front — a display name from a fixed pool, plus a random password per student ([session.service.ts](services/session.service.ts)). The teacher hands them out. There is no signup form, no email, no password reset.

**Why.** Most target students are minors. A registration form asks for an email address, which is personal data the platform then has to lawfully collect, store, and justify under UU PDP — including guardian consent for a child's account. Not collecting it is cheaper and safer than collecting it well.

It also removes the worst ten minutes of any classroom software demo: forty teenagers inventing usernames, mistyping emails, and waiting on verification links. A printed credential list works on the first try.

Names are pre-generated rather than derived from a real class roster, so the system holds no student-provided identity at all. What it stores is a label the teacher assigns to a seat.

**Cost.** Two real problems, stated plainly:

- Passwords are stored in plaintext (`students.password_plain`) because the teacher must be able to re-display a password a student has lost. Hashing would make the credential-list feature impossible. This is a deliberate trade with a real cost — anyone who can read the database file reads every student password. See [PRIVACY.md](PRIVACY.md).
- Display names are pre-set, so a student cannot be matched to a roster without the teacher keeping a side mapping — which moves the personal data off-platform rather than eliminating it.

**What the generator guarantees.** Passwords come from `crypto.getRandomValues` over an alphabet with no ambiguous glyphs (`0/O`, `1/l/I` excluded), eight characters grouped as `xxxx-xxxx` — roughly 40 bits, readable aloud, typeable on a phone. Rejection sampling rather than `% alphabet.length`, because modulo folding would quietly bias early characters in a credential generator. Usernames carry a random per-session tag (`ahmad.fauzi.4azq`): `students.username` is globally unique in the schema, so without a tag the fixed name pool would collide with every previously created session.

**Revisit when.** The platform leaves single-classroom demos. Remaining bar for real deployment: hash at rest and show the password once at generation, accepting the loss of re-display.

---

## 4. RAG locked to one module per session

**Decision.** A session has exactly one knowledge base. Uploading a module deletes the session's previous chunks ([rag.service.ts:42](services/rag.service.ts#L42)); retrieval is filtered by `session_id` taken from the student's signed JWT, never from the request.

**Why.** This is the product, not an implementation detail. A general tutor answers whatever it is asked, which makes it a homework-completion tool and gives the teacher no control over what their students are told. Binding the tutor to the module the teacher uploaded means the teacher's material is the curriculum, and "I don't know, ask your teacher" is a correct and desirable answer.

The narrow scope also makes the Bloom signal interpretable. When every student in a class is asking about the same document, the distribution of cognitive levels reflects how they are engaging with *that material* — a comparison a teacher can act on. Across arbitrary topics it would mean nothing.

Replace-on-upload rather than append is deliberate: an accumulated knowledge base would blur which lesson a question belongs to, and a teacher correcting an error in a module would otherwise leave the wrong version retrievable.

**Why no vector database.** One session holds roughly 50 chunks. Cosine similarity over a JSON-decoded array in Node is microseconds ([embedding.ts](lib/embedding.ts)), and pgvector or Pinecone would add an operational dependency to save nothing. The storage format — embeddings as JSON text in a SQLite column — is honest about its scale: it is `JSON.parse`d on every query.

**Cost.** Retrieval is O(chunks) per question with a full table read and a parse of every embedding. Fine at 50 chunks per session; it degrades linearly and will not survive a shared, cross-session knowledge base. The similarity floor of `0.10` is low enough that almost any question retrieves something, which pushes the actual refusal decision onto the prompt rather than the retrieval layer — the known weak point documented in [README.md](README.md#how-the-retrieval-lock-works).

**Revisit when.** A session needs several modules, or chunk counts pass a few thousand. Then: a real vector index, and a relevance floor tuned against an eval set rather than guessed.

---

## 5. SQLite on local disk

**Decision.** `better-sqlite3` writing `pamong-ai.db` in the project root, with Drizzle for typing ([db/client.ts](db/client.ts)).

**Why.** Zero setup. A judge, a teacher, or a contributor clones the repo, runs two commands, and has a working system with realistic data. Synchronous queries also remove a whole class of async bugs from the request path.

**Cost.** This is the decision that most limits the project. The database is a file on one machine: no concurrent writers across processes, no managed backup, no replication, and no deploy to a stateless host without attaching a persistent volume. There is no migration tooling either — `db/migrate.ts` is a `CREATE TABLE IF NOT EXISTS` block, so schema changes to an existing database must be applied by hand.

**Revisit when.** Anything beyond a single-instance demo. Postgres, and at that point `knowledge_chunks.embedding_json` should become a real vector column.

---

## 6. Classification as a separate model call

**Decision.** Bloom classification is its own service and its own LLM call at `temperature: 0`, `maxTokens: 10` ([classifier.service.ts](services/classifier.service.ts)), run in parallel with retrieval, not folded into the answer prompt.

**Why.** Asking one call to both classify and answer makes the label a by-product of a creative generation — it drifts with temperature and gets shaped by whatever the model decided to say. A separate deterministic call produces a label that means the same thing across students and across sessions, which is a precondition for aggregating it on a dashboard. It also fails independently: a classification error defaults to `hafalan` and the student still gets their answer.

**Cost.** Two calls per message instead of one, and the label is never verified against anything. `hafalan` as the failure default biases the dashboard toward "needs support" when the API is flaky.

**Revisit when.** There is a labelled validation set. The default-on-failure should then be a distinct `unknown` value the dashboard can exclude, rather than a real level.

---

## 7. SSE with server-side polling for the dashboard

**Decision.** The dashboard holds an `EventSource` connection; the server recomputes every student's stats every 3 seconds and pushes them ([stream/route.ts](app/api/dashboard/%5BsesiId%5D/stream/route.ts)).

**Why.** True push needs pub/sub — another component to run. SSE over a polled recompute is visually identical to a teacher watching a class, needs no client-side polling logic, and reconnects on its own. The connection state drives the "Live" indicator, so the teacher can see when the feed has dropped.

**Cost.** The server recomputes all stats for every connected teacher every 3 seconds whether or not anything changed — several queries per student per tick. Acceptable for one teacher and twenty students; wasteful beyond that. `EventSource` cannot send headers, so the JWT travels as a query parameter and lands in access logs.

**Revisit when.** More than a handful of concurrent teachers, or the token-in-URL becomes unacceptable — whichever comes first.

---

## 8. Heuristic stub as fallback — kept, but labelled

**Decision.** When no API key is configured or a provider call fails, `LLMService` returns hard-coded text instead of raising ([llm.service.ts](services/llm.service.ts)). The stub is retained; what changed is that it no longer passes itself off as a real answer.

**Why keep the fallback.** Demo reliability: a conference network or an expired key should not produce a blank screen in front of an audience.

**Why it could not stay silent.** The stub text is indistinguishable from a grounded reply — it opens with "Berdasarkan modul materi kita" ("based on our class module") even when no module exists and no model ran. For a product whose central claim is that it refuses to speak outside the teacher's material, a stub that invents module-grounded-sounding text undermines the exact property it exists to protect. An observer could not tell whether they were watching the system work.

**How it is resolved.** `chatWithMeta()` returns `{ text, degraded }`, where `degraded` is true whenever the stub answered. `ChatService` propagates it into `ChatResponse.degraded`, and the student view renders an amber banner stating that the reply is a canned example and was **not** read from the teacher's module. The demo still survives a dead network; the output is no longer mistakable for a real answer.

`chat()` remains as a thin wrapper returning only the text, so the classifier — which has its own safe default and does not need the flag — was left untouched.

**Cost.** The flag is per-response and not persisted. A transcript read back later from the database cannot be told apart from a real one, so a stub reply saved during a demo is indistinguishable in the teacher's transcript view. Persisting it needs a schema column and a migration.

**Revisit when.** Transcripts are used for anything beyond live demonstration — then `degraded` belongs on the `messages` row, and the dashboard should exclude degraded replies from analytics.

---

## 9. Authorization is ownership-based, never role-based

**Decision.** Holding a `teacher` token grants nothing on its own. Every endpoint that returns teacher-visible data resolves the owning session and compares `session.teacherId` against the `sub` claim of the caller's token. Student endpoints never read an identifier from the request body — `studentId` and `sessionId` come from the signed token ([chat/route.ts](app/api/chat/route.ts)), so there is nothing for a student to tamper with.

**Why it is worth stating as a decision.** Two endpoints originally checked only `payload.role !== 'teacher'`. That reads like an authorization check and passes review by eye, but it answers the wrong question: *are you a teacher* rather than *is this yours*. Because the dashboard UI only ever links a teacher to their own sessions, the gap was invisible through the interface and reachable only by calling the API directly — the classic shape of a broken-access-control bug. The data behind those two endpoints is the most sensitive the system holds: a minor's full transcript, and their password in plaintext.

**The rule for contributors.** A role check is a filter, not a permission. If a handler takes an ID from the URL, it must resolve that ID to an owner and compare it to the token subject before returning anything. `sesi/[id]/route.ts` and `sesi/[id]/materi/route.ts` were already correct and are the pattern to copy.

**Cost.** One extra query per request on the two fixed endpoints — negligible against SQLite, and the SSE stream pays it once per connection rather than per tick.

**Residual.** An unknown student ID returns `404` while another teacher's student returns `403`, so ID guessing reveals that a record exists. No data is disclosed either way. Collapsing both to `404` would close the oracle at the cost of a less precise error; the distinction is recorded in [PRIVACY.md](PRIVACY.md) rather than silently chosen.

---

## 10. No fallback signing secret

**Decision.** `JWT_SECRET` has no default. In production a missing value throws instead of signing; in development a random 32-byte secret is generated per process, with a warning.

**Why.** The previous fallback was a string literal in this repository. Any deployment that forgot the environment variable would sign tokens with a value every reader of the source already has — enough to mint a teacher token and, before decision 9, read every student in the database. A committed default is worse than no default: it converts a loud configuration error into a silent authentication bypass.

**Why development differs.** Failing to start would break clone-and-run, which is the point of the demo setup. A random per-process secret costs a re-login after each restart — the login form pre-fills demo credentials, so that is one click — and cannot be guessed by anyone.

**Why it resolves lazily.** `next build` imports route handlers for analysis without loading `.env.local`. Resolving the secret at module load would make a missing variable fail the build rather than the request, which is the wrong signal in the wrong place.

---

## 11. Passwords are re-issued, never recovered

**Decision.** `students.password_hash` holds a bcrypt hash. The plaintext exists only in the response that creates or resets a credential. A teacher helping a student who lost their slip issues a new password rather than reading the old one back.

**Why this and not the obvious alternatives.** Storing plaintext made a lost password recoverable, which is exactly why decision 3 originally accepted it — the classroom workflow needs the teacher to be able to hand a password over a second time. But it meant anyone who could read `pamong-ai.db` read every student's password, and it put a password in the response body of a routine read endpoint.

Hashing alone would have broken the workflow. Hashing *plus* a reset action preserves it completely: the teacher's actual need is for the student to get back in, not for that specific string to reappear. Reset satisfies the need and makes the stored value worthless to an attacker.

**What follows from it.** The credential list in the teacher UI no longer displays passwords — it shows `tersimpan terenkripsi` and offers a key button per student and a bulk "re-issue and copy" action, which is what feeds the printed or WhatsApp credential list. The reset endpoint is the only place in the application that ever emits a student password, and it emits one it just generated.

**Cost.** Re-issuing for the whole class invalidates every old password at once, so a teacher who clicks it mid-lesson locks students out until they get the new slip; the action confirms first and says so. Sessions already signed in keep their JWT until it expires — the new password governs the next sign-in, not the current one.

**Migration.** `runMigrations()` detects a legacy `password_plain` column, hashes each value, and drops the column. Idempotent, and verified against a database built in the old shape.

---

## 12. Consent is attested by the teacher, not collected by the platform

**Decision.** A session cannot be created without the teacher confirming a versioned statement that the school obtained guardian consent. The timestamp and the exact statement text are stored on the session row. Enforced in the service as well as the route, so no code path bypasses it.

**Why the platform does not collect consent itself.** Collecting it would mean holding guardian identities and contact details — a new category of personal data, about people who are not users, for a platform whose entire design premise (decision 3) is to store as little about real people as possible. The school already has that relationship and that data. Duplicating it into a prototype would increase risk, not reduce it.

**What the record is for.** UU PDP obliges a controller to be able to *demonstrate* consent, not merely claim it. An attestation with a timestamp and a versioned statement is a real audit record: it says who asserted what, and when, under wording that cannot be retroactively changed without changing the version.

**Be honest about what it is not.** It is one teacher's assertion covering a whole class. It proves the platform asked and recorded; it does not prove any individual guardian agreed. There is no per-student consent state and no withdrawal flow — withdrawal today means the teacher erasing the session. That limit is stated plainly in [PRIVACY.md](PRIVACY.md) rather than papered over by the presence of a checkbox.
