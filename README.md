## 🚀 Live Demo

[Open Incognito](https://intstudy-0-college-round.vercel.app)

## What this is

Incognito (Veilora) is a privacy-preserving campus complaint system. Students
prove they are enrolled using a client-side Semaphore zero-knowledge proof, so a
complaint is verified as coming from a real student **without** revealing which
student sent it. The backend never stores complaint text, identities, or
per-submission records.

## Data flow

1. **Enroll** - a student registers a Semaphore identity; only the public
   commitment is stored.
2. **Report** - the browser generates a Semaphore proof binding the exact
   complaint text to a `topic + serverDay` scope, then submits
   `{ proof, topicId, text }`.
3. **Verify** - the backend verifies the proof and rejects duplicate nullifiers
   (one report per topic per day per student).
4. **Moderate** - deterministic, in-memory moderation rejects spam/links and
   short text. Rejections never consume the student's nullifier.
5. **Aggregate** - an atomic transaction inserts the nullifier and increments an
   aggregate bucket `(topic_id, server_day)`. **The complaint text is never
   persisted.**
6. **AI themes (optional)** - the in-memory text is analyzed (best-effort) into a
   few generalized themes + a short neutral summary, stored only as aggregate
   support counts in `insight_themes`.
7. **Read** - `GET /api/insights` returns topic/day counters and theme aggregates,
   suppressing anything below the k-anonymity threshold (**k = 3**).

## AI Insights configuration (optional)

AI analysis is **disabled by default** and is **best-effort**: if it is not
configured, times out, or returns unusable output, anonymous submission still
succeeds and only aggregate counters are recorded.

The default provider is any **OpenAI-compatible Chat Completions API** (Groq is
a good free dev option). A **Google Gemini** adapter is also included.

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `AI_PROVIDER=openai` and put your key in `AI_API_KEY` (for Gemini use
   `AI_PROVIDER=gemini` and `GEMINI_API_KEY`).
3. Optionally override `AI_BASE_URL`, `AI_MODEL`, `AI_TIMEOUT_MS`,
   `AI_MAX_RETRIES`, `AI_MAX_INPUT_CHARS`.

Example (Groq):

```
AI_PROVIDER=openai
AI_API_KEY=your_groq_key_here
# AI_BASE_URL=https://api.groq.com/openai/v1
# AI_MODEL=openai/gpt-oss-20b
```

## Privacy guarantees

- Only the anonymous complaint text and its topic are sent to the AI provider.
  Proofs, nullifiers, commitments, roll numbers, names, DOB, and tracking codes
  are **never** sent.
- Complaint text is treated strictly as untrusted **data**, never as instructions.
- Provider output is validated and sanitized **server-side** (emails, phone
  numbers, IDs, roll numbers, URLs, addresses, and self-identifying phrases are
  dropped), so privacy never depends on the prompt alone.
- Raw complaint text is never stored and never logged.
- Every displayed count, theme, and summary requires at least **k = 3**
  supporting reports.

## Limitations

- AI themes/summaries are model-generated, generalized, and may be incomplete or
  imprecise. They are clearly labeled "AI-generated" in the UI.
- Moderation is a deterministic MVP (regex/heuristics), not a full content
  classifier.
- The Semaphore group is held in memory and rebuilt from stored commitments.
- `npm test` runs each suite individually; some suites keep a Node process alive
  after completion (pre-existing), so run suites directly rather than as one
  chained `npm test` if it appears to hang.

## Running the tests

Backend (Node 22 recommended), run suites individually:

```
cd backend
node tests/test_database.js
node tests/test_ai_insights.js
node tests/test_submission.js
```

Frontend build/typecheck:

```
cd frontend
npm run build
```
