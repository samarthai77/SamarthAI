# SamarthAI Kavach: सुरक्षा पुनःजाँच और Staging निर्णय

> नवीनतम स्थिति: चार blockers पर अधिकृत सुधार पूरे किए गए हैं। R2/R3/R4 ठीक हैं और पहले असफल पाँचों tests अब pass हैं। Historical key की offline जाँच पूरी है, लेकिन उसकी revocation/validity अपुष्ट है; कोई key action नहीं हुआ। विस्तृत वर्तमान परिणाम `review/blocker-fixes-hi.md` और `review/blocker-fix-summary.json` में हैं। नीचे की रिपोर्ट पिछली जाँच का सुरक्षित snapshot है; उसके पुराने test counts और खुले code blockers को नवीनतम परिणाम न मानें।

तारीख: 27 अक्टूबर 2026। समीक्षा का commit: `6270c05843940a4cc83fab63b5c4455d94217b74`।

**NOT READY FOR STAGING**

**NOT READY FOR PRODUCTION**

यह निर्णय सफल पुराने tests को अस्वीकार नहीं करता। अतिरिक्त acceptance/browser checks में वास्तविक failures और credential-history जोखिम मिले हैं। इसलिए push/deployment रोकना आवश्यक है। Application code इस सत्र में नहीं बदला गया; review tests, evidence और staging proposal अलग नई files में हैं।

## 1. Branch, main और पुराने बदलाव

- Active branch: `codex/backend-security-hardening`; HEAD अभी भी `6270c05` है।
- GitHub main read-only fetch किया। Main/base `fbe8b27940a54172d01ef6851cc1a391b1dcb826` है। Branch **0 commits पीछे, 1 commit आगे** है।
- मूल 50 changed files के diffs/source/configuration और संबंधित evidence की समीक्षा हुई। `50-file-review.json` में प्रत्येक file का SHA-256, size और review category है। इन 50 files में इस सत्र में कोई बदलाव नहीं हुआ।
- मूल user checkout `codex/services-search-location`, HEAD `762be244…` पर पहले जैसे tracked/untracked बदलाव मौजूद हैं। कोई checkout/reset/stash/overwrite नहीं हुआ।
- कोई नया commit, remote push, PR, merge, cloud resource, payment या Production deployment नहीं किया गया।

## 2. Secrets और Git history: महत्वपूर्ण नया जोखिम

Offline scan ने उपलब्ध **934 commits और 912 text blobs** जाँचे। Scope: उपलब्ध reachable Git refs; binary और 2MiB से बड़े blobs बाहर हैं। यह regex-based scan है, पूर्ण secret-detection guarantee नहीं। किसी credential को provider पर भेजकर validate नहीं किया गया।

- पुराने `render.yaml` के दो blobs में **एक distinct Supabase secret-key-format value** मिली। संबंधित historical commits में `1d76de0`, `32f18a3`, `5283010` आते हैं। Value कहीं report में नहीं दिखाई गई।
- 71 historical snapshots में hardcoded JWT fallback मिला। ये 71 अलग credentials नहीं हैं। Current source से fallback हट चुका है; live secret के rotate होने का प्रमाण उपलब्ध नहीं है।
- इन detector rules में **current HEAD और security commit के नए blobs में 0 unresolved matches** हैं। Test-only fixtures और public anon JWT को अलग पहचाना गया।
- फिर भी Git history clean नहीं कही जा सकती। पहले historical Supabase key के revoked/rotated होने की पुष्टि और पुराने JWT secret के reuse की समीक्षा जरूरी है। Validity अपुष्ट होने पर पुराने credential को सुरक्षित मानना गलत होगा।
- History rewrite, force push, key revoke/rotation या Render env update नहीं किया गया। इनके लिए अलग अनुमति और coordinated plan चाहिए। हटाई गई current file history exposure को खत्म नहीं करती।

Redacted evidence: `history-scan.json`; reproducible scanner: `history-scan.cjs`।

## 3. Node.js, lockfile और audit

- Official Node.js `24.22.1` LTS 21 अक्टूबर 2026 की security release है। DNS/TLS/Brotli आदि के fixes official advisory में हैं। इस तारीख की समीक्षा में इस pin को बदलने का आधार नहीं मिला। किसी runtime को हमेशा के लिए vulnerability-free नहीं कहा जा सकता।
- Node `24.22.1` पर सामान्य `npm ci` फिर सफल रहा। मूल automated suite **92/92** सफल हुई।
- `package-lock.json` v3 में 151 entries हैं, root सहित। सभी 11 direct exact pins lockfile से मेल खाते हैं; unpinned direct dependency 0; non-npm-registry resolution 0।
- Full और Production-only npm audits: **0 ज्ञात vulnerabilities**, High 0, Critical 0। `audit-full.json` और `audit-production.json` देखें।
- Node pin `package.json`, `.node-version`, `.nvmrc`, Render Blueprint और engine-strict में संगत है।
- Render Dashboard `NODE_VERSION` की priority repository files से अधिक है। Existing Production runtime अभी भी **अपुष्ट** है; उसे जाँचने के लिए Production से कोई संपर्क नहीं किया गया।

## 4. Tests का सही हिसाब

| समूह | परिणाम | टिप्पणी |
|---|---|---|
| मूल suite | **92 pass / 0 fail** | Node 24.22.1; नया clean install |
| Extended backend + staging tests | **37 pass / 1 fail** | इसमें मूल suite के 24 fixture tests दोहरते हैं |
| वास्तविक headless Edge | **24 pass / 4 fail** | desktop और mobile viewport emulation; APIs/permissions mocked |
| Distinct कुल | **129 pass / 5 fail** | Duplicate names को हटाकर 134 checks; reruns जोड़कर संख्या नहीं बढ़ाई गई |

इस pass count में refund का **characterization test** है: उसने unsupported current behavior दर्ज किया है। इसे सुरक्षित refund policy का सफल validation न समझें। Admin browser smoke केवल खाली fixture और diagnostic leakage देखता है, full privileged workflow नहीं।

`test-summary.json`, `baseline-tests.tap`, `extended-tests.tap`, `browser-results.json` प्रमाण हैं।

## 5. खुले release blockers और gaps

| ID | निष्कर्ष | प्रमाण और अगला सुरक्षित समाधान |
|---|---|---|
| R1 | Historical Supabase secret exposure; revocation अपुष्ट | एक distinct historical key; owner द्वारा rotation/revocation proof और JWT reuse review; history cleanup केवल स्पष्ट अनुमति से |
| R2 | Staging frontend Production API पर जा सकता है | **12 frontend files** में hardcoded Production API origin। Staging credentials/login data गलत environment में भेजे जा सकते हैं। Same-origin या environment-aware API configuration और CSP/CORS का समन्वित सुधार चाहिए |
| R3 | पुराने invoice webhook से गलत invoice status | Provider invoice `expired` देने पर पुराना `invoice.paid` event local invoice को `paid` लिखता है। अतिरिक्त acceptance test असफल। Canonical provider status के बाद event-based overrides हटाने/बदलने और regression review की आवश्यकता है |
| R4 | Desktop feature menu का layout अवरुद्ध | 1280×800 Edge में Family, Scanner, Services और Chat-focus click tests fail; clipping/overlay pointer interception। Screenshot `desktop-navigation.png`। संबंधित Chat/CSS files security commit में बदली नहीं थीं; यह current main में भी मौजूद layout है, security patch से नया regression होने का दावा नहीं |

R3 के लिए अलग canonical-state check subscription activation रोकता है; test गलत invoice bookkeeping दिखाता है, सफल fraudulent activation नहीं।

अन्य महत्वपूर्ण functional gaps:

- Signed `refund.processed` webhook acknowledge होता है, पर refund-specific processing नहीं है; mock में paid access बना रहा। Refund पर access/commission revoke होना चाहिए या billing-period तक चलना चाहिए—यह product/billing policy तय करनी होगी, फिर idempotent implementation और tests चाहिए। कोई refund execute नहीं किया गया।
- Referral/commission backend routes/services नहीं मिले। Duplicate commission रोकने को verified नहीं कहा जा सकता। यदि यह business feature आवश्यक है, schema/ledger और unique payment/referral constraints की implementation/पुष्टि बाकी है।

इन findings को npm CVE count में न जोड़ें। इस session में application fixes नहीं किए गए: audit/requested review के अनुसार मूल 50 files सुरक्षित रखी गई हैं। पिछले चरण की 14 hardening categories बनी हुई हैं।

## 6. Supabase, ownership और emergency review

Repository में actual schema migrations, CREATE POLICY definitions या RPC function bodies नहीं मिले। उपलब्ध SQL `docs/security-rls-review.sql` metadata पढ़ने का proposal है; actual deployed policies नहीं। Supabase connector/test database credentials उपलब्ध नहीं हैं; Production से कोई request नहीं भेजी गई।

अतिरिक्त HTTP mock checks सफल:

- User-id query parameters दूसरे account का profile नहीं दिखाते; profile में password नहीं लौटता।
- दूसरे user की conversation/history पढ़ना मना है।
- Non-admin Family approval नहीं कर सकता। Admin path RPC को reviewer JWT से देता है, request body से नहीं। **Actual RPC transaction authorization इससे verified नहीं होती**।
- Same-family active SOS location पढ़ सकता है; outsider नहीं पढ़ सकता और emergency resolve नहीं कर सकता।
- Services nearby search radius/category का basic mock case सफल है।
- Failed provider payment order को paid नहीं करता।

Live pending: Users, Chats, Family, Services और Payments की वास्तविक RLS; anon/authenticated grants; SECURITY DEFINER search_path/EXECUTE ACL; family RPC atomicity; unique indexes; storage policies। Service key RLS bypass कर सकती है, इसलिए app-level tests को DB-level RLS tests न समझें।

**Emergency सीमा:** valid current-session के साथ SOS mock flow सफल है। Legacy/expired JWT को login चाहिए; auth DB outage पर guard 503 देता है। इसलिए real-world emergency continuity, notification delivery या background GPS को end-to-end verified नहीं कहा जा सकता। सामान्य Family GPS sharing पहले से fail-closed है; उसे इस समीक्षा में चालू नहीं किया गया।

## 7. Browser, mobile और Linux

- Local Edge का fresh headless profile इस्तेमाल किया; user's मौजूदा browser profile/authentication session नहीं।
- सभी non-local requests network पर जाने से पहले intercepted/fulfilled/blocked थीं। Production API और checkout URL की intentions रिकॉर्ड हुईं, **वास्तविक Production requests 0**।
- Desktop और mobile emulation दोनों में Login → Chat सफल। Language selection persistence, explicit-action-only GPS/camera access और permission denial handling सफल।
- Mobile emulation में Chat, Family, SOS, GPS, Scanner और Services navigation सफल। Desktop में R4 की चार failures हैं।
- जाँचे गए flows में JavaScript page errors और CSP console violations नहीं मिले। Razorpay script mock से load हुआ; वास्तविक checkout/3DS/iframe/payment transaction verified नहीं है।
- Real Android/iOS Safari/Chrome, physical camera, GPS accuracy/background behavior और emergency delivery pending हैं।
- Docker नहीं मिला; WSL executable मिला, पर Linux subsystem installed नहीं है। वास्तविक Linux `npm ci`/native sharp load/startup **pending** हैं। Windows startup/mock HTTP tests को Linux success नहीं बताया गया।
- Browser diagnostic का एक approval-review attempt timeout हुआ; अनुमत retry सफल रहा। उसने कोई Production request नहीं की।

## 8. Staging proposal और आवश्यक अलग संसाधन

नई files: `staging/render.staging.yaml`, `staging/preflight.cjs`, `staging/env.example`। कोई Blueprint apply या resource create नहीं हुआ।

- अलग staging service, auto deploy off, pinned Node, `npm ci`, tests और `/healthz` का proposal है।
- Build में नई invoice acceptance failure भी gate है। Preflight वर्तमान hardcoded Production API URLs के कारण startup रोकता है। **यह config अभी सीधे deploy करने योग्य नहीं है।**
- Preflight live Razorpay mode, known Production DB host, गलत staging project/URL और frontend Production API references रोकने के tests पास करता है। यह opaque API key के सही project का cryptographic प्रमाण नहीं देता।
- अलग Supabase **test project**, reviewed schema-only migrations, synthetic users/data और dedicated storage buckets चाहिए। Production backup/customer rows staging में copy न करें।
- स्वतंत्र staging JWT secret, staging-only Supabase service key, Razorpay **test mode** key/webhook secret, sandbox/recipient-allowlisted email और अलग limited-budget AI project चाहिए। Production env-file/key को copy न करें।
- Staging domain, environment-aware frontend API origin और CSP/CORS/reset-link URLs का समन्वय जरूरी है।
- Linux build, live RLS negative tests, sandbox providers और browser/device acceptance के बाद ही Production readiness पर नया निर्णय लें।

## 9. Push और Production का निर्णय

**Push-ready: नहीं।** Application branch unchanged है; review/staging files local uncommitted हैं। नई acceptance failure, desktop failures और credential-history risk के रहते उन्हें clean release commit/push नहीं बनाया गया।

**Production अभी सुरक्षित प्रमाणित नहीं है।** उसके runtime, audit output, RLS, index state या पुराने credential revocation को इस session ने नहीं बदला/verify किया। Branch पर npm audit शून्य होने से Production को शून्य-risk घोषित नहीं किया जा सकता।

## 10. Users, JWT और rollback

- अभी users पर कोई प्रभाव नहीं है, क्योंकि deployment नहीं हुआ।
- बाद के अधिकृत rollout में पुराने JWT में fingerprint नहीं होगा: एक बार दोबारा login आवश्यक है। Existing passwords से login चलता रहेगा; नई password policy registration/reset पर लागू है।
- Password reset के बाद पहले जारी tokens invalidate होते हैं। Re-login notice और emergency-session behavior staging में जाँचें।
- इस session में rollback करने योग्य Production change नहीं है। मूल `6270c05` और पुराने checkout जस के तस हैं।
- बाद के rollout में पहले known-good deployment ID/SHA सुरक्षित रखें। Application regression पर controlled revert/previous deployment, patched Node कायम रखते हुए करें; force push/reset या password hashes वापस करना उचित rollback नहीं।
- Exposed credential revoke/rotation का rollback पुराने leaked key को वापस सक्रिय करना नहीं होना चाहिए। कोई DB migration यहाँ apply नहीं हुई, इसलिए इस task की DB down migration नहीं है।

## 11. आपकी अनुमति किसके लिए चाहिए?

1. Supabase/JWT credential rotation/revocation और आवश्यक environment changes—प्रभावित consumers की योजना के साथ।
2. History rewrite/force push, यदि exposure cleanup का वह रास्ता चुना जाए।
3. Refund/commission की ऐसी business policy का निर्णय जो entitlement, ledger या customer records बदलती हो। R2/R3/R4 के code fixes अगले सुधार में review और tests के साथ तैयार किए जा सकते हैं।
4. GitHub branch push और बाद में merge/deployment की अलग स्वीकृति।
5. Staging cloud service/test database/resources और test credentials बनाना।
6. किसी वास्तविक भुगतान/refund, customer-data परिवर्तन या Production action की अलग स्पष्ट अनुमति।

## स्रोत

- https://nodejs.org/en/blog/release/v24.22.1
- https://nodejs.org/en/blog/vulnerability/october-2026-security-releases
- https://render.com/docs/node-version
- https://render.com/docs/blueprint-spec

**NOT READY FOR STAGING**

**NOT READY FOR PRODUCTION**
