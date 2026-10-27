# चार Security Blockers पर सुधार — 27 अक्टूबर 2026

आधार: `review/final-report-hi.md` और security commit `6270c05843940a4cc83fab63b5c4455d94217b74`। Branch `codex/backend-security-hardening` है। मूल commit amend/reset नहीं हुआ; सुधार इसी branch के working tree में हैं। कोई push, merge, cloud resource, deployment या credential change नहीं हुआ।

## परिणाम

| Blocker | वर्तमान स्थिति | प्रमाण |
|---|---|---|
| R1 Historical Supabase key | **Offline जाँच पूरी; exposure closure अभी अपुष्ट** | एक distinct secret-key-format value पुराने `SUPABASE_SERVICE_KEY` field के दो historical blobs में है। Current tracked files में ऐसी value नहीं मिली। कोई live request, rotation, revocation या history rewrite नहीं हुआ। |
| R2 Hardcoded Production API | **ठीक** | सभी 12 frontend files अब same-origin `/api` इस्तेमाल करती हैं। CSP connect-src से Production origins हटाए गए। Browser में login/profile सहित APIs served origin पर रहीं; Production API attempts 0। |
| R3 पुराने invoice webhook का override | **ठीक** | Fetched provider invoice status authoritative है; पुराने event-type से status को paid/partially_paid/expired बनाने वाले overrides हटाए गए। Expired invoice/subscription पुराने invoice.paid event पर expired रहती है और paid access नहीं मिलता। |
| R4 Desktop navigation | **ठीक** | `#featureMenu` के fixed left/right bounds के साथ legacy translateX हटाया। वही Family/Scanner/Services/Chat-focus tests अब real headless Edge में pass हैं। Mobile navigation भी pass है। |

## पहले असफल पाँच परीक्षण

1. Desktop Family navigation — **PASS**
2. Desktop Scanner navigation — **PASS**
3. Desktop Services navigation — **PASS**
4. Desktop Chat composer focus — **PASS**
5. Old invoice event बनाम authoritative expired invoice — **PASS**

**पहले असफल पाँच में से 5/5 अब सफल हैं।**

Node `v24.22.1` पर मूल suite और संबंधित backend/staging tests की संयुक्त run में **131/131 checks सफल** हैं। इसमें 24 पुराने fixture tests दोहरते हैं। अलग headless Edge desktop/mobile run में **30/30 checks सफल** हैं। Duplicate test names हटाने पर कुल **137 distinct checks सफल, 0 असफल** हैं। Refund का पुराना characterization test business-policy approval का प्रमाण नहीं है; उसे इस सीमित कार्य में नहीं बदला गया।

## बदलावों की सीमा

14 tracked files बदली हैं: वही 12 frontend API files, `routes/payment.js` और `middleware/contentSecurityPolicy.js`। Desktop menu fix उन्हीं 12 में शामिल `frontend/chat.html` में है। Dependencies, lockfile, Node pin, auth/session implementation, SOS/GPS backend, credentials और Render environment में कोई बदलाव नहीं किया गया।

Frontend files: `admin.html`, `app.js`, `category-page.js`, `chat.html`, `dashboard.html`, `forgot-password.html`, `login.html`, `payment.html`, `register.html`, `reset-password.html`, `service-admin.html`, `services.html`।

API URLs में कोई environment override या Production fallback नहीं जोड़ा गया है। यह मौजूदा architecture के अनुरूप है, जहाँ backend frontend को serve करता है। यदि आगे अलग frontend host चाहिए, तो उसके लिए स्पष्ट same-origin reverse proxy/configuration की अलग व्यवस्था चाहिए।

Review tests और staging preflight tests अपडेट हुए हैं। Preflight current fixed frontend को स्वीकार करती है, और अलग unsafe fixture में Production API reference डालने पर अब भी उसे रोकती है। कोई staging resource नहीं बना।

## Historical key पर सीमा

`historical-key-check.json` में केवल setting name, historical locations और commit references हैं—secret value या fingerprint नहीं। Opaque Supabase secret की validity/revocation को offline जाँच से निर्धारित नहीं किया जा सकता। पहले से revoked होने का owner/admin प्रमाण अभी आवश्यक है। इस कार्य में key rotate/revoke करना स्पष्ट रूप से मना था, इसलिए वह कार्रवाई नहीं की गई। Current files से key गायब होना Git history को secret-clean नहीं बनाता।

## Staging की स्थिति

तीनों code blockers बंद हैं और संबंधित staging/browser tests हरे हैं। Local staging proposal अब पुराने API/invoice/navigation failures से अवरुद्ध नहीं है।

**समग्र निर्णय: NOT READY FOR STAGING**, जब तक historical credential exposure के बंद होने की पुष्टि और स्वतंत्र staging credentials/database की तैयारी नहीं हो जाती। यह credential बदलने की कार्रवाई की अनुमति माँगना नहीं है; कोई key action नहीं लिया गया।

पहले की live RLS/RPC/index verification, Linux/native sharp startup तथा वास्तविक test-mode provider/device integration की सीमाएँ यथावत हैं। इन्हें इस चार-blocker कार्य के बाहर सफल घोषित नहीं किया गया।

**NOT READY FOR PRODUCTION** — ऊपर की सीमाएँ, isolated staging validation और अलग deployment approval बाकी हैं।

## प्रमाण

- `blocker-fix-summary.json`: पुराने पाँच failures का नाम सहित pass result, duplicate-free totals और scoped file list।
- `blocker-fix-tests.tap`: Node 24.22.1 backend/staging run।
- `blocker-fix-browser.json`: Edge desktop/mobile results, same-origin API paths और external request interception।
- `desktop-navigation.png`: ठीक किए गए desktop menu का screenshot।
- `historical-key-check.json`: redacted offline key provenance।

मूल security commit सुरक्षित है; इस सत्र ने कोई नया commit या remote mutation नहीं किया।
