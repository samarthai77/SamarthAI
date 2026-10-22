# Chat request idempotency

The active text Chat client sends a random UUID `requestId` to the existing
authenticated `/api/autonomous/run` endpoint. Manual Retry reuses that UUID,
message, thread and language. A new intentional message gets a new UUID.
The existing single-tab Send guard remains. Retry does not resend GPS coordinates.

## Database prerequisite

The existing Supabase project must contain the separately verified
`public.chat_idempotency` table: `(user_id, request_id)` primary key, RLS enabled,
no anon/authenticated table access, service-role SELECT/INSERT/UPDATE only.
Columns: `user_id`, `request_id`, `conversation_id`, `fingerprint`, `token`,
`state`, `result`, `failure_code`, `created_at`, `finished_at`, `replay_expires_at`.
The backend fails closed if the ledger cannot be written or read.
No in-memory cache, new provider, or new location transfer is used.

## State and crash behavior

* The unique INSERT winner is the only request allowed to start generation.
  A lost claim acknowledgement never permits generation on Retry.
* In-progress duplicates receive `request_in_progress`; no provider is called.
  Orphan claims after a server crash are never taken over automatically, since
  the provider may already have billed work. An operator must investigate;
  a user can deliberately send a new message, potentially incurring new cost.
* Completed generation is durably recorded before history persistence. Retry
  recovers the same response and never reruns the planner, tools or provider.
* History uses a stable UUID derived from the authenticated user and request ID
  in the existing `chats.id` primary key. Concurrent recovery and an INSERT whose
  acknowledgement was lost cannot add another history row. On a conflict the
  backend verifies user, conversation, message and response before accepting it.
  This depends on the existing UUID/unique `chats.id` contract.
* History save failure is reported as `history_save_pending`; Retry resumes only
  history persistence. Generation and history are separate writes with explicit
  recovery, not one transaction.
* Failed generation is terminal for that UUID. No silent paid retry occurs.
* Disconnect with actual partial text retains the existing partial-save behavior;
  the saved partial answer is replayable. Before any text, an aborted request is
  terminal. Provider fallback within the first generation is unchanged.
* Conversation ownership is checked before fresh generation AND cached replay.
  Location is excluded from the fingerprint so permission revocation on Retry
  does not force another generation. Thread/message/mode/language still bind the ID.

## Retention and limits

Completed replay is available for 24 hours. Expired requests never regenerate;
their response copy is cleared on a subsequent access, while the unique-key
tombstone remains. This is lazy cleanup, not a scheduled physical-retention job.
The ledger is not exposed in Chat history. Existing conversation/account deletion
does not currently purge ledger rows; a separately authorized retention/deletion
job must address those copies. The ledger stays in the existing Supabase project;
this change provides no new India-residency guarantee.

Legacy callers omitting `requestId` receive a server-created ID for compatibility;
deduplication across separate legacy requests requires them to retain and resend
that ID. Independently submitted messages with different IDs are separate requests.
This reduces duplicate billing; it cannot reverse provider charges incurred before
an interruption or enforce exactly-once execution within an external provider.

## Verification

`node --test tests/chat.test.cjs tests/chat-idempotency.test.cjs tests/chat-request-id.test.cjs`

The tests use an atomic database fixture and mocked providers, including a fresh
Node-process replay from a durable-state snapshot. They do not claim a live Render
crash test, paid-provider billing verification, or a live Supabase concurrency test.
