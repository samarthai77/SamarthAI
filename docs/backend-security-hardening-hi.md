# SamarthAI Kavach Backend Security Hardening

तारीख: 27 अक्टूबर 2026। स्थिति: अलग branch में लागू और mock regression tests सफल; Production deployment नहीं हुआ।

## आधार और बदलावों की सुरक्षा

- Repository: `samarthai77/SamarthAI`। fetched main/base: `fbe8b27940a54172d01ef6851cc1a391b1dcb826`।
- Security branch: `codex/backend-security-hardening`। अलग managed worktree में काम हुआ।
- मूल checkout `codex/services-search-location`, HEAD `762be244fe53d331be1889f273374d850f1d991f` के पहले से मौजूद tracked/untracked बदलाव नहीं बदले गए।
- GitHub push/merge, Render environment update, database migration और Production deployment नहीं हुआ। वास्तविक credentials किसी test में इस्तेमाल नहीं हुए।

## कितनी समस्याएँ मिलीं और ठीक हुईं?

इस समीक्षा में **14 श्रेणियों की configuration/application सुरक्षा कमियाँ branch में सुधारी गईं**। यह 14 CVEs का दावा नहीं है। Render की बताई गई पुरानी 2 High findings के नाम/installed versions उपलब्ध नहीं हैं, इसलिए उनकी पहचान या Production में उनके समाधान की पुष्टि नहीं की गई है। नए lockfile के full और production npm audits में **0 Low, Moderate, High और Critical vulnerabilities** मिलीं।

| # | समस्या | branch में सुधार |
|---|---|---|
| 1 | Node runtime स्पष्ट नहीं | Node `24.22.1` exact pin: engines, .node-version, .nvmrc और Render Blueprint; engine-strict |
| 2 | dependency versions reproducible नहीं | 11 direct dependencies exact pin, नया lockfile, npm ci |
| 3 | upload से पहले authentication/authorization नहीं | profile, portfolio और admin banner पर parsing से पहले जाँच |
| 4 | MIME पर निर्भर image validation | JPEG/PNG/WebP signature, वास्तविक decoding, single-frame, 4096px dimensions और 16M pixel सीमा; WebP re-encoding/metadata stripping |
| 5 | upload/resource memory abuse | 5MB profile/portfolio, multipart files/fields/parts limits, 4 concurrent upload slots, bounded activity map; admin video की मौजूदा 50MB सीमा कायम |
| 6 | password policies असमान | नए/reset passwords: कम-से-कम 12 Unicode characters, अधिकतम 72 UTF-8 bytes; bcrypt cost 12; forms aligned |
| 7 | reset के बाद पुराना JWT valid | password hash का keyed HMAC session fingerprint; हर authenticated API request पर DB validation; disabled/deleted users denied |
| 8 | बड़े bodies limiter से पहले पढ़े जाते थे | rate limiting और image-route authentication पहले; सामान्य JSON 128KB; chat/scanner image JSON 9MB; compressed request bodies denied |
| 9 | external calls अनिश्चित समय तक रुक सकते थे | route/tool Supabase fetch और AI/email/weather fetch पर deadline; Razorpay Axios पर 15s timeout और redirects disabled; request/header receive timeouts |
| 10 | DB/provider error messages clients को मिलते थे | सामान्य error responses; malformed/oversized body और CORS errors का सुरक्षित handler |
| 11 | raw SDK errors credentials log कर सकते थे | routes/middleware logs केवल allowlisted category/code; startup database probe हटाया |
| 12 | CSP बंद था | प्रति-document script hashes, fixed-action delegated dynamic handlers, script unsafe-inline/eval बंद; object/frame restrictions |
| 13 | webhook replay identity unsigned header पर निर्भर | exact signed raw body का SHA-256 identity; strict HMAC format; existing processed-state dedup कायम |
| 14 | HMAC अकेला capture/payment entitlement नहीं साबित करता | provider से capture/order/amount/currency verification; current subscription/invoice state; delayed event protection; authenticated या unbounded/expired subscription से paid access नहीं |

## Node और dependencies

आधिकारिक 21 अक्टूबर 2026 release के आधार पर **Node.js 24.22.1 LTS** चुना और उसी आधिकारिक Windows runtime archive का SHA-256 प्रकाशित SHASUMS से मिलाकर tests चलाए। सिस्टम का Node नहीं बदला। सत्यापित test runtime: Node `v24.22.1`, npm `11.19.1`।

Render की priority: Dashboard `NODE_VERSION` > `.node-version` > `.nvmrc` > `package.json` engines। Blueprint में pin तैयार करना मौजूदा Dashboard environment बदलने का प्रमाण नहीं है। Dashboard पर conflicting override होने पर engine-strict build को रोक सकता है। **Production Node version अभी अपुष्ट है**। Running instance के अधिकृत Shell में `node --version` / `node -p "process.version"` तथा live deployment logs से पुष्टि करनी होगी; केवल local version या Dashboard setting पर्याप्त नहीं है।

| Dependency | exact version |
|---|---|
| express | 4.22.3 |
| cors | 2.8.6 |
| dotenv | 16.6.1 |
| bcryptjs | 2.4.3 |
| jsonwebtoken | 9.0.3 |
| @supabase/supabase-js | 2.118.0 |
| multer | 2.5.0 |
| express-rate-limit | 8.7.1 |
| helmet | 8.3.0 |
| razorpay | 2.9.8 |
| sharp | 0.35.5 |

Lockfile में 151 entries हैं, root सहित; optional/platform packages भी lock होते हैं। दोनों npm audit reports में transitive/optional dependency metadata शामिल है। कोई npm audit fix --force नहीं चलाया गया। Audit का शून्य परिणाम केवल ज्ञात registry advisories की स्थिति है, पूर्ण application सुरक्षा का प्रमाण नहीं।

## परीक्षण और प्रमाण

- Node 24.22.1 पर **92 tests passed; 0 failed; 0 skipped**: `security-tests.tap`।
- **41 backend JavaScript files** की syntax compilation सफल; HTML inline scripts भी test में compile हुए।
- `npm ci --ignore-scripts` और फिर सामान्य `npm ci` दोनों से clean installation सफल; sharp के prebuilt runtime पर वास्तविक image decoding tests सफल।
- `npm audit --json --ignore-scripts`: `security-audit-full.json`।
- `npm audit --omit=dev --json --ignore-scripts`: `security-audit-production.json`।
- `git diff --check` सफल।

| सुविधा | क्या जाँचा गया | सीमा |
|---|---|---|
| AI Chat / History | existing 55 tests: provider fallback, streaming, cancellation, history ownership/persistence, request dedup/replay/restart, frontend retry | वास्तविक paid AI providers इस्तेमाल नहीं हुए |
| Family | current-family isolation, non-admin mutation denial, location redaction | actual RPC definitions और DB constraints उपलब्ध नहीं |
| SOS | invalid GPS rejection, server-controlled contacts और emergency record | कोई वास्तविक emergency notification नहीं भेजी |
| GPS | family ownership और मौजूदा fail-closed consent behavior | सामान्य family tracking main में पहले से बंद है; उसे खोला नहीं गया |
| Scanner | authentication, input validation, mocked Gemini output | वास्तविक camera/AI end-to-end नहीं |
| Services | listing, cross-provider update denial, portfolio auth | live Supabase Storage नहीं |
| Auth | register/login/reset, old-password compatibility, reset-token reuse denial, JWT revocation, generic forgot response | वास्तविक email delivery नहीं |
| Payments | server price, cross-user verification denial, invalid HMAC, capture verification, replay, delayed webhook, paid invoice activation | Razorpay test-mode provider integration अभी बाकी |
| Subscription | authenticated/expired से paid access denied; valid bounded active period allowed | live billing data reconciliation बाकी |
| Referral | routes में कोई referral backend implementation नहीं मिला | referral business behavior को सफल test घोषित नहीं किया गया |
| Upload/CSP | real image decode, corrupt/spoofed/oversized rejection, limits, hashes, delegated handlers | वास्तविक browsers/payment iframe/permissions की staging QA बाकी |

## Supabase RLS और authorization समीक्षा

Backend service key इस्तेमाल करता है, इसलिए custom JWT से हर database query पर अपने आप user RLS लागू होने का अनुमान गलत है। Route-level ownership/family/admin checks आवश्यक हैं। Services, family, GPS, profile, payment owner checks तथा family/location fail-closed logic code में देखे और प्रमुख negative paths mocks से जाँचे गए।

`security-rls-review.sql` केवल metadata पढ़ने वाली queries देता है: RLS/policies, anon/authenticated grants, SECURITY DEFINER/search_path/execute ACL, indexes और storage bucket flags। यह SQL **चलाया नहीं गया**। Production schema और database authorization access उपलब्ध नहीं है, इसलिए वास्तविक RLS को सुरक्षित घोषित नहीं किया गया।

विशेष deployment gates:

1. users/password_reset_tokens/family/location/messages/payment tables पर anon/public access और broad `USING true` policies की समीक्षा। Public service listing और sensitive account data के grants अलग हों।
2. `approve_family_join_request`, account-deletion RPC तथा अन्य SECURITY DEFINER functions की वास्तविक ownership checks/search_path/EXECUTE grants की समीक्षा।
3. webhook event_id, provider invoice/subscription/payment identifiers, users email और chat request identity के unique indexes की पुष्टि। Concurrent multi-instance create-order/create-subscription तथा webhook retries के लिए DB-level constraints की live पुष्टि अभी बाकी है; process-local checks उनका विकल्प नहीं हैं।
4. Storage write policies user/server scope तक सीमित हों। Public profile pictures intentional हो सकते हैं; bucket public होने को अकेले breach न मानें।

## Compatibility और शेष जोखिम

- पुराने JWTs में नया fingerprint नहीं है: rollout के बाद **एक बार दोबारा login** आवश्यक होगा। यह जानबूझकर fail-closed behavior है। पुरानी account passwords से login चलता रहेगा; नई policy केवल registration/reset पर लागू है। कोई password hash migration आवश्यक नहीं है।
- Fingerprint validation हर authenticated request पर DB read करता है; latency/load staging में मापें। DB unavailable होने पर authentication 503 देता है।
- Authenticated-but-unpaid subscription अब paid नहीं मानी जाती। Billing periods गायब/expired होने पर access denied है; deploy से पहले पुराने subscription rows reconcile करें।
- Profile/portfolio images normalized WebP में save होंगी। Admin banner images/video का पूरा transcoding इस patch में नहीं किया गया; admin authorization और resource limits लागू हुए हैं।
- CSP static script hashes actual shipped files से startup पर बनते हैं; inline styles और approved handler hashes compatibility के लिए हैं। CSP को पूर्ण XSS protection न मानें। Dynamic family/admin handlers data arguments में बदले गए हैं। Browser staging में payment checkout, PDF preview, camera, GPS, family controls और service admin UI देखें।
- In-memory rate/concurrency limits प्रति-instance हैं। कई instances के rollout पर shared-store limits पर अलग operational decision लें।
- नए Render service के लिए आवश्यक secrets Dashboard/secret manager में होने चाहिए। Blueprint में secret values नहीं रखे गए हैं। कोई secret बनाया/बदला नहीं गया।

## Production से पहले बाकी काम

1. deployed SHA, actual runtime और Render की पुरानी दो High warnings का पूरा audit output प्राप्त करना।
2. staging पर उसी lockfile और Node 24.22.1 से सामान्य `npm ci`, tests और audits चलाना; Linux sharp optional binary install भी सत्यापित करना।
3. वास्तविक Supabase metadata/RPC/constraints review और Razorpay test-mode/email/AI integration smoke tests।
4. Browser staging QA, password/session re-login notice और billing-period reconciliation।
5. अलग review/approval के बाद ही branch push/PR/merge तथा Production deploy। इस कार्य में कोई remote push या deployment नहीं हुआ।

## Rollback plan

- Merge/deploy से पहले: branch/worktree को यथावत रखें; मूल checkout अप्रभावित है।
- बाद के अधिकृत rollout से पहले पिछले live deployment ID, SHA और runtime/config snapshot सुरक्षित metadata के रूप में दर्ज करें; secret values report में न रखें।
- Regression पर पहले previous Render deployment पर rollback करें या security commit को नई revert commit से revert करें। main को force reset/push न करें।
- पुरानी vulnerable Node release पर लौटना सामान्य rollback उपाय नहीं होना चाहिए। compatible application rollback के साथ patched Node बनाए रखने को प्राथमिकता दें।
- इस patch ने DB schema नहीं बदला, इसलिए database down migration नहीं है। Password reset से बदले password hashes rollback में वापस न करें।
- Current HMAC fingerprint tokens पुराने app के signature verifier से readable हैं; billing/webhook schema columns नहीं जोड़े गए। फिर भी rollback के बाद old session revocation protection हट जाएगी—इसे incident decision के रूप में दर्ज करें।

## आधिकारिक स्रोत

- https://nodejs.org/en/blog/vulnerability/october-2026-security-releases
- https://nodejs.org/en/blog/release/v24.22.1
- https://render.com/docs/node-version
- https://render.com/docs/ssh
- https://github.com/expressjs/multer/security/advisories/GHSA-5528-5vmv-3xc2
- https://sharp.pixelplumbing.com/api-constructor/

## बदली गई files (50)

- `.gitignore`
- `.node-version`
- `.npmrc`
- `.nvmrc`
- `docs/backend-security-hardening-hi.md`
- `docs/security-audit-full.json`
- `docs/security-audit-production.json`
- `docs/security-rls-review.sql`
- `docs/security-tests.tap`
- `frontend/family.html`
- `frontend/register.html`
- `frontend/reset-password.html`
- `frontend/security-actions.js`
- `frontend/service-admin.html`
- `middleware/activityTracker.js`
- `middleware/contentSecurityPolicy.js`
- `middleware/safeUpload.js`
- `middleware/sessionGuard.js`
- `package-lock.json`
- `package.json`
- `render.yaml`
- `routes/admin.js`
- `routes/auth.js`
- `routes/chat.js`
- `routes/complaints.js`
- `routes/family.js`
- `routes/gps.js`
- `routes/memory.js`
- `routes/messages.js`
- `routes/notifications.js`
- `routes/payment.js`
- `routes/requests.js`
- `routes/reviews.js`
- `routes/scanner.js`
- `routes/serviceadmin.js`
- `routes/serviceportfolio.js`
- `routes/services.js`
- `routes/sos.js`
- `routes/weather.js`
- `server.js`
- `services/aiGateway.js`
- `services/conversationEngine.js`
- `services/security.js`
- `services/securityLog.js`
- `services/tools/familyTool.js`
- `services/tools/gpsTool.js`
- `services/tools/servicesTool.js`
- `tests/helpers/securityDatabase.cjs`
- `tests/security-integration.test.cjs`
- `tests/security.test.cjs`
