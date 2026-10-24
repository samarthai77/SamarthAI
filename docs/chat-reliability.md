# Chat reliability release

Baseline: 1cd7e732f948e200e7e41d67fa211d9e95738987. No database migration or new runtime dependency.

## Behavior

- Existing API IP limiter remains 300 requests / 15 minutes, using Express's trusted-proxy/IP handling. Static assets and autonomous health no longer consume this quota.
- Authenticated `/api/autonomous/run` additionally allows 20 requests / minute per verified user. Retries/status checks count to prevent polling abuse. Limiter failures have `server_rate_limit`, Retry-After and retryAfter seconds, distinct from provider limits.
- Rate counters and provider cooldowns are process-local; horizontal instances each have their own budgets and restart resets them. Durable paid-request deduplication remains in Supabase. No distributed quota/billing guarantee is claimed.
- One 120-second request deadline covers SSE and JSON. Planner uses at most 30 seconds; provider attempts divide remaining time, reserve 15 seconds for final persistence, and honor cancellation. DB fetches are bounded by 15 seconds or remaining deadline. Transport closes on deadline even if a read-only tool ignores cancellation.
- Groq -> Gemini -> OpenAI uses configured keys only. A provider 429 cools that key using Retry-After (bounded 1-300 seconds); auth/config errors cool it for 60 seconds. No external quota lookup is added. Provider responses determine availability. No provider switch occurs after emitted text.
- SSE ready conveys the remaining deadline. Frontend has a 130-second outer cap and ten-second transport grace after the server deadline. Network/protocol/provider/database/auth/ledger errors have distinct messages. Cooldown blocks fresh Send and Retry but never Stop on an active generation.
- Same-ID Retry only checks/replays the existing request. Failed, expired or claims older than three minutes are never taken over. UI offers a new UUID only after a confirmation warning about additional processing/cost and uncertain original work.
- Completed response is durable before history save; stable history UUID and conflict verification preserve recovery on lost acknowledgements and concurrent retry. Disconnect cancellation and partial-save behavior remain. No transaction migration, ledger deletion, or idempotency lock release is introduced.

## Diagnostics and privacy

Chat diagnostic logs allow only valid request UUID, fixed stage/provider/code enums, numeric status/duration and fixed ledger state. Raw error bodies/messages, prompts, location, user IDs, tokens and credentials are not logged by the modified Chat path. Existing unrelated feature logging is not audited or changed.

**Zero Data Export is NOT satisfied by the existing architecture.** The normal planner/answer path sends messages and selected history/memory/context to configured Groq, Gemini and OpenAI public endpoints. Explicitly shared location is included in planner context. Fallback can send the same context to a second configured provider. Weather uses Google Weather and Open-Meteo geocoding; web search uses Tavily. Render/Supabase and the provider accounts have no verified India-only residency configuration in this session.

This release adds no provider, telemetry collector, paid service, location transfer or external destination. Retry does not resend GPS coordinates. Achieving strict zero export would require separately approved India-resident/self-hosted inference and tools or disabling external AI paths; this release does neither silently.

Ledger replay retention/deletion limitations from `chat-idempotency.md` remain: 24h replay, lazy payload expiry, no automatic takeover, and no new conversation/account-deletion cleanup job.

## Verification

Run: `node --test tests/chat.test.cjs tests/chat-idempotency.test.cjs tests/chat-request-id.test.cjs tests/chat-reliability.test.cjs`

55 automated tests include the original 30 cases, real local Express IP/user limiter behavior, provider Retry-After/cooldown, shared budgets/timeouts, SSE errors/JSON transport, privacy logging, explicit new-ID confirmation and Stop. Providers and Supabase are fixtures; a fresh Node-process test replays a saved fixture snapshot. These are not live paid-provider, live Supabase concurrency, or Render restart tests. Live authenticated provider/quota verification remains pending without credentials.
