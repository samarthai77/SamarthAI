# SamarthAI Kavach — Login Session Fix

स्थिति: implementation और local automated verification पूरे। Deployment authorization के बाद सभी 27 implementation/test files और इस रिपोर्ट की समीक्षा की गई। Production rollout verified backup, migration confirmation और वास्तविक HTTPS smoke checks पर रुका है। Production Supabase में migration नहीं चलाई गई। Reviewed work को `codex/auth-session-stability` branch पर सुरक्षित रखना production/main deployment की सफलता नहीं है।

## काम कहाँ सुरक्षित है

- Base: GitHub `origin/main`, `fbe8b27940a54172d01ef6851cc1a391b1dcb826`.
- Branch: `codex/auth-session-stability`.
- अलग स्थानीय worktree: `auth-session-integration`; मूल dirty checkout से अलग रखा गया।
- मूल checkout के existing dirty changes सुरक्षित हैं। CHIKOLIGHT को नहीं छुआ गया।

## लागू व्यवहार

1. मौजूदा bcrypt + custom JWT architecture बरकरार। Access JWT अधिकतम 15 मिनट; refresh session में SQL के अनुसार 7 दिन idle expiry और 30 दिन absolute expiry।
2. Refresh envelope का HMAC session ID, generation और secret से बँधा है। MAC सत्यापित होने से पहले rotation RPC नहीं चलती। Deterministic successor के कारण concurrent servers, duplicate refresh और lost responses एक ही successor देते हैं। Key मौजूदा JWT_SECRET से अलग purposes के लिए derive होती है; कोई नया paid service या secret आवश्यक नहीं। JWT_SECRET स्थिर और पर्याप्त मजबूत रहना चाहिए।
3. Refresh secret केवल host-only `__Host-samarth_refresh` cookie: Secure, HttpOnly, SameSite=Lax, Path=/; कोई Domain attribute नहीं। Refresh token JSON, localStorage या logs में नहीं जाता। सामान्य API authorization अभी भी Bearer access JWT से होता है।
4. Cookie operations पर exact allowed Origin, CSRF cookie/header comparison और cross-site rejection। CORS में X-CSRF-Token जोड़ा। Production में HTTP cookie issuance बंद है।
5. सभी Bearer API requests पर shared session gate, activity tracker और route actions से पहले। Case-insensitive Express paths भी सुरक्षित हैं। Existing per-route Family/Admin/Services authorization बरकरार है।
6. Expiry से पहले refresh, structured auth_expired 401 पर अधिकतम एक replay, same request body/ID, SSE response को बिना buffer किए लौटाना। Ordinary 401, business 403, 429 या network failure पर business request replay नहीं होती।
7. Shared in-tab refresh promise; Web Locks उपलब्ध होने पर tabs में refresh और login/logout/reset cookie mutations serialize होती हैं। Startup restoration, browser refresh, online और mobile background-resume events जुड़े हैं।
8. Network/DB/429 failure पर session मिटती नहीं; cooldown और retry status मिलता है। Confirmed revoked/disabled session पर protected pages login पर लौटते हैं। Logout server acknowledgement के बाद होता है; offline failure को सफल logout नहीं बताया जाता।
9. Single-session logout, logout-all, atomic password reset + session revocation, disabled/deleted-user checks। Backend authentication routes DB outage को invalid password/token नहीं बताते।
10. नए auth logs में tokens, keys, passwords, email या exception payload नहीं लिखे जाते। Existing external services/hosting नहीं बदले गए।

## बदली source files — 28

Backend (4):

- `services/authSessions.js` — नया session/MAC/rotation service.
- `middleware/authSession.js` — नया session gate, cookies और CSRF.
- `routes/auth.js` — login/register integration, refresh/logout endpoints, atomic reset, error handling.
- `server.js` — shared gate और CSRF header allowlist.

Frontend (20):

- `frontend/auth-session.js` — नया shared lifecycle client.
- `frontend/app.js`, `frontend/category-page.js`.
- `frontend/admin.html`, `frontend/camera.html`, `frontend/category.html`, `frontend/chat.html`, `frontend/dashboard.html`, `frontend/family.html`, `frontend/forgot-password.html`, `frontend/gps.html`, `frontend/index.html`, `frontend/login.html`, `frontend/payment.html`, `frontend/profile.html`, `frontend/register.html`, `frontend/reset-password.html`, `frontend/service-admin.html`, `frontend/services.html`, `frontend/sos.html`.

SQL/tests/report (4):

- `docs/sql/auth-session-migration.sql` — पहले reviewed SQL की exact copy; schema में नया परिवर्तन नहीं।
- `tests/auth-backend.test.cjs`, `tests/auth-frontend.test.cjs`.
- `docs/AUTH_SESSION_REPORT.md`.

Application package.json/dependencies, Family/SOS/GPS/Scanner backend logic और deployment configuration नहीं बदले। Local node_modules केवल test runtime है; उसे commit नहीं करना है।

## Automated results — 181 passing checks

Deployment review में केवल आवश्यक auth backend/frontend suites फिर चलाई गईं: **50/50 pass, 0 fail, 0 skip**। Unchanged Chat/SQL suites को अनावश्यक रूप से दोबारा नहीं चलाया गया। नीचे 181-check परिणाम पिछले complete verification का है।

| Group | Pass | Fail | Skip |
| --- | ---: | ---: | ---: |
| Existing Chat suites, original coverage सहित | 55 | 0 | 0 |
| नए backend/frontend auth tests | 50 | 0 | 0 |
| Native PostgreSQL migration/security/concurrency | 52 | 0 | 0 |
| पिछले PGlite regression/security checks | 24 | 0 | 0 |
| Total | 181 | 0 | 0 |

कुछ SQL/regression coverage overlap करती है; यह 181 अलग-अलग security scenarios का दावा नहीं है।

- वास्तविक isolated PostgreSQL **18.6** और synthetic data इस्तेमाल हुए। Native PostgreSQL 17 पर परीक्षण नहीं हुआ; installation के bootstrap files missing थे।
- SQL suite ने वास्तविक independent connections, lock waits, 12 concurrent refreshes, reset/revoke ordering, grace/replay, owner/grants/RLS, rollback और `pg_proc.proconfig` जाँचा।
- Backend HTTP tests ने actual Express + SQL functions के साथ cookie flags, CSRF, expiry, invalid MAC, reset, logout, revocation और DB outage जाँची।
- Frontend tests browser-like VM में lifecycle/concurrency/fetch/SSE जाँचते हैं; सभी संबंधित inline HTML scripts parse भी हुए। ये वास्तविक Android/iOS browser UI या production HTTPS cookie smoke tests का विकल्प नहीं हैं।
- `git diff --check` और बदले JS modules के syntax checks पास हैं।
- App suite log: worktree के sibling `auth-full-tests.log`; native SQL log: `auth-sql-native-tests.log`.

App tests दोबारा चलाने का command (अलग synthetic PostgreSQL cluster पहले चलना चाहिए):

```powershell
# AUTH_TEST_NODE_MODULES उस isolated test runtime का node_modules path है जिसमें pg मौजूद है।
# Production URL/key इन tests को न दें। Host code में 127.0.0.1 है; default port 55483 है।
$env:AUTH_TEST_NODE_MODULES = '<isolated-test-runtime>\node_modules'
$env:AUTH_TEST_PG_PORT = '55483'
node --test tests/auth-backend.test.cjs tests/auth-frontend.test.cjs tests/chat-idempotency.test.cjs tests/chat-reliability.test.cjs tests/chat-request-id.test.cjs tests/chat.test.cjs
```

AUTH_TEST_NODE_MODULES के बिना PostgreSQL integration suite skip होती है; ऐसे run को complete pass नहीं मानना है। SQL harness पिछले artifact folder `auth-migration-check` में `native.cjs`, `check.cjs`, `security.cjs` के रूप में सुरक्षित है। SQL और backend fixture suites को क्रम से चलाएँ; वे केवल dedicated test cluster में fixture databases/roles बनाती हैं।

## Supabase migration के सटीक steps — यूज़र/administrator को करने हैं

1. Verified backup और migration के बिना **main** push/auto-deploy न करें। पहले current Render service से जुड़े **SamarthAI** Supabase project की पुष्टि करें; CHIKOLIGHT project न चुनें। Secrets chat या logs में paste न करें। Review branch पर source सुरक्षित करना migration या production deployment नहीं है।
2. Fresh, verified database backup लें: schema, functions, policies, role/grant definitions और data; विशेष रूप से public.users, password_reset_tokens तथा संबंधित tables। Backup encrypted और restricted-access में रखें। Restore तरीका और timestamp सत्यापित करें। केवल दैनिक पुराना backup पर्याप्त नहीं हो सकता।
3. Existing main/backend commit का record रखें। Private Render configuration में JWT_SECRET, SUPABASE_URL और SUPABASE_SERVICE_KEY मौजूद हों। JWT_SECRET को इस deployment में बदलें नहीं। PUBLIC_APP_URL/FRONTEND_URL को उसी वास्तविक HTTPS app origin पर रखें। मौजूदा deployment `https://samarthai-backend.onrender.com` से frontend और API serve करता है।
4. SQL Editor में trusted `postgres` administrator के रूप में `docs/sql/auth-session-migration.sql` की **पूरी file एक साथ** चलाएँ। Assertions या BEGIN/COMMIT को छोड़कर partial selection न चलाएँ।
5. Expected SHA256: `921FEF06D82A25C2B8C5DA24C595942528A2CDC27BB945E574C6AFE571AB3A41`.
6. यदि schema/name/owner/permission conflict आए तो रुकें। Failed transaction में `ROLLBACK;` चलाएँ। किसी existing table/function को DROP या assertions को bypass न करें। यह migration existing users/password rows नहीं बदलती।
7. Successful COMMIT के बाद नीचे दिए script outputs की पुष्टि करें:
   - auth_sessions और auth_user_security: RLS=true, initial_row_count=0.
   - anon/authenticated: table privileges=false और सभी छह RPC execute=false.
   - service_role: SELECT=true; direct INSERT/UPDATE/DELETE=false; सभी छह RPC execute=true.
   - Migration के internal checks owner, elevated role attributes और inherited/custom privileges भी सत्यापित करते हैं।
8. PostgREST schema reload करें:

```sql
NOTIFY pgrst, 'reload schema';
```

Official reference: https://supabase.com/kb/troubleshooting/refresh-postgrest-schema

9. केवल verification outputs/status साझा करें; user rows, hashes, cookies, access/refresh tokens या keys नहीं। Successful migration confirmation मिलने के बाद ही reviewed application changes **main** पर push और existing Render deployment करना है।

### Authorization के बाद सत्यापित blockers

- Authenticated Supabase dashboard में SamarthAI project `cursxzwxfuljksnkihkc` healthy है। Overview में “Last backup: No backups”; backup page में “Free Plan does not include project backups” दिखा। कोई paid upgrade नहीं किया गया।
- स्थानीय PostgreSQL pgpass/service profile उपलब्ध नहीं मिला। Existing encrypted logical backup या database connection profile के बिना सुरक्षित full backup सत्यापित/बनाया नहीं जा सका। SQL migration रोक दी गई।
- खुले Render account/workspace में कोई service नहीं दिखती। उसे SamarthAI production deployment access नहीं माना गया। सही account/service access अभी चाहिए।
- Tracked `render.yaml` में URL `https://curszxwxfujksnkihkc.supabase.co` है, जो dashboard के SamarthAI project URL से मेल नहीं खाता। Actual Render environment सत्यापित नहीं है; YAML या production config को अनुमान से नहीं बदला गया।
- Login/Logout/Refresh/Password Reset के वास्तविक production HTTPS checks pending हैं। Local automated tests को live production success नहीं बताया गया।

## Deployment और live verification

Migration verified होने के बाद ही application/backend/frontend को साथ deploy करें। Production में NODE_ENV=production रखें; AUTH_LOCAL_HTTP enable न करें। Test dependencies/files या local fixture databases deploy करने की आवश्यकता नहीं। नई application dependency नहीं है।

Render live होने के बाद authorized test account से ये checks अभी करने बाकी हैं:

1. Existing health endpoint और static auth-session.js सफल हों।
2. Login/register और cookie flags वास्तविक HTTPS browser में जाँचें; refresh secret JSON/storage में न दिखे।
3. Refresh/reopen/mobile resume पर session restore हो; दो tabs में expiry refresh race न हो।
4. Temporary offline/503 से logout न हो; reconnect पर recovery हो।
5. Logout के बाद captured old access token किसी protected API पर अस्वीकार हो। दूसरे account के अधिकार न मिलें।
6. Password reset और logout-all के बाद पुराने sessions अस्वीकार हों; Family/SOS/GPS/Scanner/Chat की authorized smoke checks चलें।

Production credentials या logged-in browser session इन tests में इस्तेमाल नहीं हुए। Live provider tests और वास्तविक mobile/HTTPS smoke checks को **pending**, passed नहीं माना गया है।

## सीमाएँ और rollback

- SameSite=Lax और CSRF policy के कारण असंबंधित cross-site frontend/native WebView origins स्वतः समर्थित नहीं हैं। मौजूदा same-origin web deployment supported target है। उन्हें support करने के लिए सुरक्षा review आवश्यक है; cookie policy चुपचाप कमजोर नहीं की गई।
- Web Locks न होने पर एक tab में single-flight रहती है; कई tabs एक साथ refresh भेज सकती हैं। Server की deterministic rotation/grace उन्हें एक ही successor देती है। ऐसे browsers में पूरे browser के लिए exactly-one HTTP refresh का दावा नहीं है।
- Compatibility के लिए **access JWT** existing localStorage में रहता है; इसलिए XSS से access-token चोरी का शेष जोखिम है। Refresh token वहाँ नहीं रखा जाता और server revocation हर Bearer API request पर जाँची जाती है।
- Legacy pre-migration JWT केवल अपनी original expiry तक चलता है; उसके लिए refresh cookie नहीं बनती। Silent long-lived session प्राप्त करने के लिए एक बार नया login आवश्यक होगा।
- Server restart से state नहीं मिटती; DB तथा stable JWT_SECRET source of truth हैं। अस्थायी outage में authorization fail-closed रहती है।
- COMMIT के बाद `ROLLBACK` DDL नहीं हटाता। `DROP ... CASCADE` या पुराने snapshot से blind full restore न करें। Backend को पुराने JWT-only version पर लौटाना नई revocation सुरक्षा हटा सकता है; rollback में gate बनाए रखना या coordinated key rotation/forced re-login जैसी administrator-reviewed योजना आवश्यक है।
- Existing Render/Supabase hosting और पहले से मौजूद email/provider data paths नहीं बदले गए; कोई नया external data destination नहीं जोड़ा गया।

Broad regex rewrite को automatic approval review ने रोका था; वह script execute नहीं हुई। उसके स्थान पर छोटे explicit edits किए गए और पूरी suite फिर पास हुई।
