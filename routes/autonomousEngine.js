'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

const ROOT_DIR = path.resolve(process.cwd());

const PROJECTS_DIR = path.join(
  ROOT_DIR,
  'generated_projects'
);

const META_DIR = path.join(
  PROJECTS_DIR,
  '_meta'
);

const REGISTRY_FILE = path.join(
  META_DIR,
  'registry.json'
);

const ENGINE_VERSION = '20.0.0';

const MAX_PROMPT_LENGTH = 12000;
const MAX_PROJECT_NAME_LENGTH = 80;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true
    });
  }
}

function readJson(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) {
      return fallback;
    }

    const raw =
      fs.readFileSync(
        file,
        'utf8'
      );

    if (!raw.trim()) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir(
    path.dirname(file)
  );

  fs.writeFileSync(
    file,
    JSON.stringify(
      data,
      null,
      2
    ),
    'utf8'
  );
}

function writeText(file, content) {
  ensureDir(
    path.dirname(file)
  );

  fs.writeFileSync(
    file,
    String(content),
    'utf8'
  );
}

ensureDir(PROJECTS_DIR);
ensureDir(META_DIR);

if (!fs.existsSync(REGISTRY_FILE)) {
  writeJson(
    REGISTRY_FILE,
    {
      engineVersion:
        ENGINE_VERSION,
      projects: []
    }
  );
}
// ==========================================
// PART 2/10
// Utility + Security Functions
// ==========================================

function cleanText(value, maxLength = 500) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function slugify(value) {
  return cleanText(value, MAX_PROJECT_NAME_LENGTH)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_PROJECT_NAME_LENGTH);
}

function safeId(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 100);
}

function generateId(prefix = 'project') {
  const random = crypto
    .randomBytes(6)
    .toString('hex');

  return `${prefix}_${Date.now()}_${random}`;
}

function hashText(value) {
  return crypto
    .createHash('sha256')
    .update(String(value))
    .digest('hex');
}

function safeFilePath(baseDir, relativePath) {
  const base = path.resolve(baseDir);

  const target = path.resolve(
    baseDir,
    relativePath
  );

  if (
    target !== base &&
    !target.startsWith(base + path.sep)
  ) {
    throw new Error(
      'Invalid file path.'
    );
  }

  return target;
}

function getRegistry() {
  const data = readJson(
    REGISTRY_FILE,
    {
      engineVersion:
        ENGINE_VERSION,
      projects: []
    }
  );

  if (
    !data ||
    !Array.isArray(data.projects)
  ) {
    return {
      engineVersion:
        ENGINE_VERSION,
      projects: []
    };
  }

  return data;
}

function saveRegistry(registry) {
  registry.engineVersion =
    ENGINE_VERSION;

  writeJson(
    REGISTRY_FILE,
    registry
  );
}

function findProject(projectId) {
  const registry =
    getRegistry();

  return registry.projects.find(
    project =>
      project.id === projectId
  );
}

function registerProject(project) {
  const registry =
    getRegistry();

  const index =
    registry.projects.findIndex(
      item =>
        item.id === project.id
    );

  if (index >= 0) {
    registry.projects[index] =
      project;
  } else {
    registry.projects.push(
      project
    );
  }

  saveRegistry(registry);

  return project;
}

function removeProject(projectId) {
  const registry =
    getRegistry();

  registry.projects =
    registry.projects.filter(
      project =>
        project.id !== projectId
    );

  saveRegistry(registry);
}

function nowIso() {
  return new Date().toISOString();
}
// ==========================================
// PART 3/10
// Natural Language Requirement Analyzer
// ==========================================

function analyzeRequirement(prompt) {
  const text = cleanText(
    prompt,
    MAX_PROMPT_LENGTH
  ).toLowerCase();

  const result = {
    rawPrompt: prompt,
    appType: 'website',
    category: 'general',
    projectName: '',
    description: cleanText(
      prompt,
      500
    ),
    features: [],
    pages: [],
    entities: [],
    theme: {
      primary: '#2563eb',
      mode: 'dark'
    }
  };

  // ----------------------------------------
  // APP TYPE
  // ----------------------------------------

  if (
    /android|apk|aab|mobile app|मोबाइल ऐप|ऐप बनाओ|app बनाओ/i
      .test(text)
  ) {
    result.appType = 'android';
  }

  if (
    /website|web site|वेबसाइट|वेब ऐप|web app/i
      .test(text)
  ) {
    result.appType = 'website';
  }

  // ----------------------------------------
  // CATEGORY
  // ----------------------------------------

  if (
    /shop|shopping|ecommerce|e-commerce|store|दुकान|शॉपिंग|स्टोर/i
      .test(text)
  ) {
    result.category = 'ecommerce';
    result.theme.primary = '#2563eb';
  }

  else if (
    /social|facebook|instagram|community|post|फेसबुक|इंस्टाग्राम|सोशल/i
      .test(text)
  ) {
    result.category = 'social';
    result.theme.primary = '#1877f2';
  }

  else if (
    /video|youtube|reel|reels|stream|वीडियो|रील/i
      .test(text)
  ) {
    result.category = 'video';
    result.theme.primary = '#ef4444';
  }

  else if (
    /dating|matchmaking|relationship|dating app|रिश्ता|शादी/i
      .test(text)
  ) {
    result.category = 'dating';
    result.theme.primary = '#ec4899';
  }

  else if (
    /food|restaurant|hotel|delivery|खाना|रेस्टोरेंट|होटल|डिलीवरी/i
      .test(text)
  ) {
    result.category = 'food';
    result.theme.primary = '#f97316';
  }

  else if (
    /education|school|college|course|student|शिक्षा|स्कूल|कॉलेज|पढ़ाई/i
      .test(text)
  ) {
    result.category = 'education';
    result.theme.primary = '#7c3aed';
  }

  else if (
    /doctor|hospital|clinic|medical|health|डॉक्टर|अस्पताल|क्लिनिक/i
      .test(text)
  ) {
    result.category = 'health';
    result.theme.primary = '#059669';
  }

  else if (
    /real estate|property|house|flat|plot|जमीन|मकान|प्रॉपर्टी/i
      .test(text)
  ) {
    result.category = 'realestate';
    result.theme.primary = '#0891b2';
  }

  // ----------------------------------------
  // PROJECT NAME
  // ----------------------------------------

  const nameMatch =
    String(prompt).match(
      /(?:name|नाम|called|कहलाने वाला)\s*[:\-]?\s*["']?([^"'\n,]+)["']?/i
    );

  if (nameMatch) {
    result.projectName =
      cleanText(
        nameMatch[1],
        80
      );
  }

  if (!result.projectName) {
    result.projectName =
      result.category === 'general'
        ? 'Samarth Generated App'
        : `${result.category} App`;
  }

  // ----------------------------------------
  // FEATURES
  // ----------------------------------------

  const featureRules = [
    {
      key: 'authentication',
      words: /login|signup|sign up|register|account|लॉगिन|रजिस्टर|खाता/i
    },
    {
      key: 'search',
      words: /search|find|खोज|सर्च/i
    },
    {
      key: 'profile',
      words: /profile|user profile|प्रोफाइल/i
    },
    {
      key: 'notifications',
      words: /notification|alert|सूचना|नोटिफिकेशन/i
    },
    {
      key: 'payment',
      words: /payment|pay|upi|razorpay|checkout|भुगतान|पैसा/i
    },
    {
      key: 'cart',
      words: /cart|basket|कार्ट/i
    },
    {
      key: 'orders',
      words: /order|orders|ऑर्डर/i
    },
    {
      key: 'chat',
      words: /chat|message|messaging|बातचीत|मैसेज/i
    },
    {
      key: 'location',
      words: /location|gps|map|लोकेशन|नक्शा/i
    },
    {
      key: 'reviews',
      words: /review|rating|रेटिंग|समीक्षा/i
    },
    {
      key: 'admin',
      words: /admin|dashboard|डैशबोर्ड|एडमिन/i
    },
    {
      key: 'upload',
      words: /upload|photo|image|file|अपलोड|फोटो/i
    }
  ];

  for (const rule of featureRules) {
    if (rule.words.test(text)) {
      result.features.push(
        rule.key
      );
    }
  }

  // Category defaults

  if (
    result.category === 'ecommerce'
  ) {
    result.features.push(
      'search',
      'cart',
      'payment',
      'orders'
    );
  }

  if (
    result.category === 'social'
  ) {
    result.features.push(
      'profile',
      'chat',
      'upload',
      'notifications'
    );
  }

  if (
    result.category === 'video'
  ) {
    result.features.push(
      'search',
      'profile',
      'upload'
    );
  }

  if (
    result.category === 'dating'
  ) {
    result.features.push(
      'profile',
      'search',
      'chat',
      'notifications'
    );
  }

  // Remove duplicates

  result.features =
    [...new Set(
      result.features
    )];

  // ----------------------------------------
  // PAGES
  // ----------------------------------------

  result.pages = [
    'index.html'
  ];

  const pageMap = {
    authentication: [
      'login.html',
      'register.html'
    ],
    search: [
      'search.html'
    ],
    profile: [
      'profile.html'
    ],
    notifications: [
      'notifications.html'
    ],
    cart: [
      'cart.html'
    ],
    payment: [
      'checkout.html',
      'payment-success.html'
    ],
    orders: [
      'orders.html'
    ],
    chat: [
      'chat.html'
    ],
    location: [
      'location.html'
    ],
    reviews: [
      'reviews.html'
    ],
    admin: [
      'admin.html'
    ]
  };

  for (
    const feature of result.features
  ) {
    if (pageMap[feature]) {
      result.pages.push(
        ...pageMap[feature]
      );
    }
  }

  // Category pages

  if (
    result.category === 'ecommerce'
  ) {
    result.pages.push(
      'catalog.html',
      'product.html'
    );
  }

  if (
    result.category === 'social'
  ) {
    result.pages.push(
      'feed.html',
      'create-post.html'
    );
  }

  if (
    result.category === 'video'
  ) {
    result.pages.push(
      'videos.html',
      'player.html'
    );
  }

  if (
    result.category === 'dating'
  ) {
    result.pages.push(
      'discover.html',
      'matches.html'
    );
  }

  result.pages =
    [...new Set(
      result.pages
    )];

  // ----------------------------------------
  // DATA ENT
// ==========================================
// PART 4/10
// Feature + Page + API Planning
// ==========================================

function buildFeaturePlan(analysis) {
  const features = [];

  for (const feature of analysis.features) {
    const item = {
      id: feature,
      name: feature
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c =>
          c.toUpperCase()
        ),
      enabled: true,
      frontend: true,
      backend: false,
      api: null
    };

    if (
      [
        'authentication',
        'profile',
        'notifications',
        'payment',
        'orders',
        'chat',
        'location',
        'reviews',
        'cart'
      ].includes(feature)
    ) {
      item.backend = true;
    }

    if (item.backend) {
      item.api =
        `/api/${feature}`;
    }

    features.push(item);
  }

  return features;
}

function buildPagePlan(analysis) {
  return analysis.pages.map(
    (page, index) => ({
      id: `page_${index + 1}`,
      file: page,
      title: page
        .replace('.html', '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c =>
          c.toUpperCase()
        ),
      route:
        page === 'index.html'
          ? '/'
          : `/${page.replace(
              '.html',
              ''
            )}`
    })
  );
}

function buildApiPlan(analysis) {
  const api = [];

  if (
    analysis.features.includes(
      'authentication'
    )
  ) {
    api.push(
      {
        method: 'POST',
        path: '/api/auth/register',
        description:
          'Register a new user'
      },
      {
        method: 'POST',
        path: '/api/auth/login',
        description:
          'Login user'
      },
      {
        method: 'GET',
        path: '/api/auth/me',
        description:
          'Get current user'
      }
    );
  }

  if (
    analysis.features.includes(
      'profile'
    )
  ) {
    api.push(
      {
        method: 'GET',
        path: '/api/profile',
        description:
          'Get profile'
      },
      {
        method: 'PUT',
        path: '/api/profile',
        description:
          'Update profile'
      }
    );
  }

  if (
    analysis.features.includes(
      'search'
    )
  ) {
    api.push({
      method: 'GET',
      path: '/api/search',
      description:
        'Search application data'
    });
  }

  if (
    analysis.features.includes(
      'chat'
    )
  ) {
    api.push(
      {
        method: 'GET',
        path: '/api/chat',
        description:
          'Get conversations'
      },
      {
        method: 'POST',
        path: '/api/chat',
        description:
          'Send message'
      }
    );
  }

  if (
    analysis.features.includes(
      'notifications'
    )
  ) {
    api.push({
      method: 'GET',
      path: '/api/notifications',
      description:
        'Get notifications'
    });
  }

  if (
    analysis.features.includes(
      'cart'
    )
  ) {
    api.push(
      {
        method: 'GET',
        path: '/api/cart',
        description:
          'Get cart'
      },
      {
        method: 'POST',
        path: '/api/cart',
        description:
          'Add item to cart'
      }
    );
  }

  if (
    analysis.features.includes(
      'orders'
    )
  ) {
    api.push({
      method: 'GET',
      path: '/api/orders',
      description:
        'Get orders'
    });
  }

  if (
    analysis.features.includes(
      'payment'
    )
  ) {
    api.push({
      method: 'POST',
      path: '/api/payment',
      description:
        'Create payment request'
    });
  }

  if (
    analysis.features.includes(
      'reviews'
    )
  ) {
    api.push(
      {
        method: 'GET',
        path: '/api/reviews',
        description:
          'Get reviews'
      },
      {
        method: 'POST',
        path: '/api/reviews',
        description:
          'Create review'
      }
    );
  }

  if (
    analysis.features.includes(
      'location'
    )
  ) {
    api.push({
      method: 'POST',
      path: '/api/location',
      description:
        'Save user location'
    });
  }

  if (
    analysis.features.includes(
      'upload'
    )
  ) {
    api.push({
      method: 'POST',
      path: '/api/upload',
      description:
        'Upload application file'
    });
  }

  if (
    analysis.features.includes(
      'admin'
    )
  ) {
    api.push({
      method: 'GET',
      path: '/api/admin',
      description:
        'Admin dashboard data'
    });
  }

  return api;
}

function buildProjectPlan(analysis) {
  return {
    appType:
      analysis.appType,

    category:
      analysis.category,

    projectName:
      analysis.projectName,

    description:
      analysis.description,

    theme:
      analysis.theme,

    features:
      buildFeaturePlan(
        analysis
      ),

    pages:
      buildPagePlan(
        analysis
      ),

    entities:
      analysis.entities,

    api:
      buildApiPlan(
        analysis
      )
  };
}
// ==========================================
// PART 5/10
// Project File Generator
// ==========================================

function createProjectStructure(
  projectDir,
  plan
) {
  const directories = [
    projectDir,
    path.join(
      projectDir,
      'public'
    ),
    path.join(
      projectDir,
      'public',
      'assets'
    ),
    path.join(
      projectDir,
      'data'
    ),
    path.join(
      projectDir,
      'backend'
    ),
    path.join(
      projectDir,
      'versions'
    )
  ];

  for (
    const dir of directories
  ) {
    ensureDir(dir);
  }
}

function generateGlobalCss(plan) {
  const primary =
    plan.theme.primary;

  return `
:root {
  --primary: ${primary};
  --bg: #0b1020;
  --card: #151d32;
  --text: #f8fafc;
  --muted: #94a3b8;
  --border: #26324a;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family:
    Arial,
    Helvetica,
    sans-serif;
  background: var(--bg);
  color: var(--text);
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
textarea,
select {
  font: inherit;
}

.container {
  width: min(
    1100px,
    calc(100% - 32px)
  );
  margin: auto;
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 1000;
  padding: 14px 0;
  background: rgba(
    11,
    16,
    32,
    0.94
  );
  backdrop-filter: blur(12px);
  border-bottom:
    1px solid var(--border);
}

.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.brand {
  font-size: 20px;
  font-weight: 800;
  color: var(--primary);
}

.nav-links {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.nav-links a {
  color: var(--muted);
  font-size: 14px;
}

.nav-links a:hover {
  color: var(--text);
}

.hero {
  padding: 70px 0 40px;
  text-align: center;
}

.hero h1 {
  font-size:
    clamp(
      32px,
      7vw,
      64px
    );
  margin:
    0 0 18px;
}

.hero p {
  max-width: 700px;
  margin:
    0 auto 25px;
  color: var(--muted);
  line-height: 1.7;
}

.btn {
  display: inline-block;
  border: 0;
  border-radius: 10px;
  padding:
    12px 18px;
  background: var(--primary);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.btn.secondary {
  background:
    var(--card);
  border:
    1px solid var(--border);
}

.grid {
  display: grid;
  grid-template-columns:
    repeat(
      auto-fit,
      minmax(
        220px,
        1fr
      )
    );
  gap: 18px;
}

.card {
  background: var(--card);
  border:
    1px solid var(--border);
  border-radius: 16px;
  padding: 22px;
}

.card h2,
.card h3 {
  margin-top: 0;
}

.muted {
  color: var(--muted);
}

.form {
  max-width: 520px;
  margin: 40px auto;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 7px;
  font-weight: 700;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 12px;
  border-radius: 9px;
  border:
    1px solid var(--border);
  background:
    #0f172a;
  color: var(--text);
}

footer {
  margin-top: 70px;
  padding: 30px 0;
  text-align: center;
  color: var(--muted);
  border-top:
    1px solid var(--border);
}

@media (max-width: 700px) {
  .nav-inner {
    align-items: flex-start;
    flex-direction: column;
  }

  .nav-links {
    width: 100%;
  }

  .hero {
    padding-top: 45px;
  }
}
`;
}

function generateClientJs() {
  return `
async function apiRequest(
  url,
  options = {}
) {
  const response =
    await fetch(
      url,
      {
        headers: {
          'Content-Type':
            'application/json',
          ...(options.headers || {})
        },
        ...options
      }
    );

  let data = {};

  try {
    data =
      await response.json();
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      'Request failed'
    );
  }

  return data;
}

function showMessage(
  message
) {
  const box =
    document.getElementById(
      'app-message'
    );

  if (!box) return;

  box.textContent =
    message;

  box.style.display =
    'block';
}

document.addEventListener(
  'DOMContentLoaded',
  () => {
    const buttons =
      document.querySelectorAll(
        '[data-action]'
      );

    buttons.forEach(
      button => {
        button.addEventListener(
          'click',
          () => {
            const action =
              button.dataset.action;

            if (
              action === 'demo'
            ) {
              showMessage(
                'This feature is connected to the generated application.'
              );
            }
          }
        );
      }
    );
  }
);
`;
}

function generateNavigation(
  plan,
  projectId
) {
  const previewBase =
    `/api/autonomous/preview/${projectId}`;

  const links =
    plan.pages
      .map(page => {

        return `
<a
  href="${previewBase}/${page.file}"
>
  ${page.title}
</a>
`;

      })
      .join('');

  return `
<nav class="navbar">

  <div class="container nav-inner">

    <a
      class="brand"
      href="${previewBase}"
    >
      ${plan.projectName}
    </a>

    <div class="nav-links">
      ${links}
    </div>

  </div>

</nav>
`;
}
// ==========================================
// PART 6 FIXED
// Working HTML Page Generator
// ==========================================

function generatePageHtml(
  plan,
  page,
  projectId
) {
  const isHome =
    page.file === 'index.html';

  const previewBase =
    `/api/autonomous/preview/${projectId}`;

  const assetBase =
    `/api/autonomous/preview/${projectId}/assets`;

  let content = '';

  if (isHome) {

    content = `
<section class="hero">
  <div class="container">

    <h1>
      ${plan.projectName}
    </h1>

    <p>
      ${plan.description}
    </p>

    <a
      href="${previewBase}/catalog.html"
      class="btn"
    >
      Get Started
    </a>

    <div
      id="app-message"
      class="card"
      style="
        display:none;
        max-width:600px;
        margin:25px auto 0;
      "
    ></div>

  </div>
</section>

<section>
  <div class="container">

    <div class="grid">

      <div class="card">
        <h3>Smart Experience</h3>
        <p class="muted">
          Generated automatically
          from your requirements.
        </p>
      </div>

      <div class="card">
        <h3>
          ${plan.features.length}
          Features
        </h3>
        <p class="muted">
          Your requested features
          are included.
        </p>
      </div>

      <div class="card">
        <h3>
          ${plan.pages.length}
          Pages
        </h3>
        <p class="muted">
          All generated pages are
          connected.
        </p>
      </div>

    </div>

  </div>
</section>
`;

  } else {

    content = `
<section
  class="container"
  style="padding-top:45px"
>

  <div class="card">

    <h1>
      ${page.title}
    </h1>

    <p class="muted">
      This page was generated by
      SamarthAI Autonomous Engine.
    </p>

    <div class="grid">

      <div class="card">
        <h3>Module Status</h3>
        <p>Active</p>
      </div>

      <div class="card">
        <h3>Backend</h3>
        <p>Connected</p>
      </div>

      <div class="card">
        <h3>API</h3>
        <p>Available</p>
      </div>

    </div>

    <br>

    <a
      href="${previewBase}"
      class="btn"
    >
      ← Back Home
    </a>

  </div>

</section>
`;
  }

  const html = `
<!DOCTYPE html>

<html lang="en">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="
      width=device-width,
      initial-scale=1.0
    "
  >

  <meta
    name="description"
    content="${plan.description}"
  >

  <meta
    name="generator"
    content="
      SamarthAI Autonomous Engine
      ${ENGINE_VERSION}
    "
  >

  <title>
    ${plan.projectName}
    - ${page.title}
  </title>

  <link
    rel="stylesheet"
    href="${assetBase}/style.css"
  >

</head>

<body>

  ${generateNavigation(
    plan,
    projectId
  )}

  ${content}

  <footer>
    <div class="container">

      <p>
        ${plan.projectName}
      </p>

      <p>
        Generated by
        SamarthAI Autonomous Engine
        ${ENGINE_VERSION}
      </p>

    </div>
  </footer>

  <script
    src="${assetBase}/app.js"
  ></script>

</body>

</html>
`;

  return html;
}


function generateAllPages(
  projectDir,
  plan,
  projectId
) {

  for (
    const page of plan.pages
  ) {

    const filePath =
      safeFilePath(
        projectDir,
        path.join(
          'public',
          page.file
        )
      );

    writeText(
      filePath,
      generatePageHtml(
        plan,
        page,
        projectId
      )
    );
  }

  writeText(
    path.join(
      projectDir,
      'public',
      'assets',
      'style.css'
    ),
    generateGlobalCss(
      plan
    )
  );

  writeText(
    path.join(
      projectDir,
      'public',
      'assets',
      'app.js'
    ),
    generateClientJs()
  );
}
    // ==========================================
// PART 7/10
// Backend + Project Metadata Generator
// ==========================================

function generateBackendServer(
  plan
) {
  return `
'use strict';

const express =
  require('express');

const cors =
  require('cors');

const app =
  express();

app.use(
  cors()
);

app.use(
  express.json({
    limit: '10mb'
  })
);

app.use(
  express.static(
    'public'
  )
);

app.get(
  '/api/health',
  (req, res) => {
    res.json({
      success: true,
      status: 'online',
      app:
        ${JSON.stringify(
          plan.projectName
        )}
    });
  }
);

app.get(
  '/api/info',
  (req, res) => {
    res.json({
      success: true,
      name:
        ${JSON.stringify(
          plan.projectName
        )},
      category:
        ${JSON.stringify(
          plan.category
        )},
      features:
        ${JSON.stringify(
          plan.features.map(
            item => item.id
          )
        )}
    });
  }
);

app.use(
  (req, res, next) => {
    if (
      req.path.startsWith(
        '/api/'
      )
    ) {
      return res
        .status(404)
        .json({
          success: false,
          error:
            'API endpoint not found'
        });
    }

    next();
  }
);

const PORT =
  process.env.PORT ||
  3000;

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      'Generated app running on port ' +
      PORT
    );
  }
);
`;
}

function generateProjectPackage(
  plan
) {
  return {
    name:
      slugify(
        plan.projectName
      ),

    version:
      '1.0.0',

    private:
      true,

    description:
      plan.description,

    main:
      'backend/server.js',

    scripts: {
      start:
        'node backend/server.js'
    },

    dependencies: {
      express:
        '^4.21.2',

      cors:
        '^2.8.5'
    }
  };
}

function generateManifest(
  plan,
  projectId
) {
  return {
    engine:
      'SamarthAI Autonomous Engine',

    engineVersion:
      ENGINE_VERSION,

    projectId,

    name:
      plan.projectName,

    type:
      plan.appType,

    category:
      plan.category,

    description:
      plan.description,

    features:
      plan.features,

    pages:
      plan.pages,

    entities:
      plan.entities,

    api:
      plan.api,

    generatedAt:
      nowIso(),

    buildStatus:
      'source-generated',

    androidBuild:
      'not-built',

    playStoreStatus:
      'not-published'
  };
}

function generateReadme(
  plan,
  projectId
) {
  return `# ${plan.projectName}

Generated by SamarthAI Autonomous Engine.

## Project ID

${projectId}

## Category

${plan.category}

## Application Type

${plan.appType}

## Features

${plan.features
  .map(
    item =>
      '- ' + item
  )
  .join('\n')}

## Pages

${plan.pages
  .map(
    page =>
      '- ' +
      page.file
  )
  .join('\n')}

## Entities

${plan.entities
  .map(
    entity =>
      '- ' +
      entity
  )
  .join('\n')}

## API

${plan.api
  .map(
    item =>
      '- ' +
      item.method +
      ' ' +
      item.path
  )
  .join('\n')}

## Build Status

Source project generated successfully.

Android APK/AAB is NOT claimed as built
until a real Android build process verifies it.

## Generated At

${nowIso()}
`;
}

function writeProjectMetadata(
  projectDir,
  plan,
  projectId
) {
  writeJson(
    path.join(
      projectDir,
      'package.json'
    ),
    generateProjectPackage(
      plan
    )
  );

  writeJson(
    path.join(
      projectDir,
      'manifest.json'
    ),
    generateManifest(
      plan,
      projectId
    )
  );

  writeText(
    path.join(
      projectDir,
      'README.md'
    ),
    generateReadme(
      plan,
      projectId
    )
  );
}
// ==========================================
// PART 8/10
// Versioning + Validation
// ==========================================

function getVersionNumber(
  projectDir
) {
  const versionsDir =
    path.join(
      projectDir,
      'versions'
    );

  ensureDir(
    versionsDir
  );

  const files =
    fs.readdirSync(
      versionsDir
    );

  const numbers =
    files
      .map(file => {
        const match =
          file.match(
            /^v(\d+)\.json$/
          );

        return match
          ? Number(match[1])
          : 0;
      })
      .filter(
        number =>
          number > 0
      );

  if (!numbers.length) {
    return 0;
  }

  return Math.max(
    ...numbers
  );
}

function saveVersion(
  projectDir,
  plan,
  reason = 'initial'
) {
  const current =
    getVersionNumber(
      projectDir
    );

  const next =
    current + 1;

  const versionData = {
    version:
      next,

    reason,

    createdAt:
      nowIso(),

    plan
  };

  writeJson(
    path.join(
      projectDir,
      'versions',
      `v${next}.json`
    ),
    versionData
  );

  return next;
}

function validateJavaScript(
  filePath
) {
  try {
    const code =
      fs.readFileSync(
        filePath,
        'utf8'
      );

    new Function(
      code
    );

    return {
      valid: true,
      file: filePath
    };
  } catch (error) {
    return {
      valid: false,
      file: filePath,
      error:
        error.message
    };
  }
}

function validateProject(
  projectDir
) {
  const requiredFiles = [
    'package.json',
    'manifest.json',
    'README.md',
    'public/index.html',
    'public/assets/style.css',
    'public/assets/app.js',
    'backend/server.js'
  ];

  const missing = [];

  for (
    const file of requiredFiles
  ) {
    const fullPath =
      safeFilePath(
        projectDir,
        file
      );

    if (
      !fs.existsSync(
        fullPath
      )
    ) {
      missing.push(
        file
      );
    }
  }

  const jsFiles = [
    'public/assets/app.js',
    'backend/server.js'
  ];

  const javascript = [];

  for (
    const file of jsFiles
  ) {
    const fullPath =
      safeFilePath(
        projectDir,
        file
      );

    if (
      fs.existsSync(
        fullPath
      )
    ) {
      javascript.push(
        validateJavaScript(
          fullPath
        )
      );
    }
  }

  const javascriptErrors =
    javascript.filter(
      item =>
        !item.valid
    );

  return {
    valid:
      missing.length === 0 &&
      javascriptErrors.length === 0,

    missing,

    javascript,

    javascriptErrors,

    checkedAt:
      nowIso()
  };
}

function createProject(
  prompt
) {
  if (
    !prompt ||
    typeof prompt !==
      'string'
  ) {
    throw new Error(
      'A project description is required.'
    );
  }

  if (
    prompt.length >
    MAX_PROMPT_LENGTH
  ) {
    throw new Error(
      'Project description is too long.'
    );
  }

  const analysis =
    analyzeRequirement(
      prompt
    );

  const plan =
    buildProjectPlan(
      analysis
    );

  const projectId =
    generateId(
      'app'
    );

  const projectSlug =
    slugify(
      plan.projectName
    ) ||
    `app-${Date.now()}`;

  const projectDir =
    path.join(
      PROJECTS_DIR,
      projectSlug +
        '-' +
        projectId
          .replace(
            /^app_/,
            ''
          )
    );

  createProjectStructure(
    projectDir,
    plan
  );
generateAllPages(
  projectDir,
  plan,
  projectId
);
 

  writeText(
    path.join(
      projectDir,
      'backend',
      'server.js'
    ),
    generateBackendServer(
      plan
    )
  );

  writeProjectMetadata(
    projectDir,
    plan,
    projectId
  );

  const validation =
    validateProject(
      projectDir
    );

  const version =
    saveVersion(
      projectDir,
      plan,
      'initial-generation'
    );

  const project = {
    id:
      projectId,

    name:
      plan.projectName,

    slug:
      projectSlug,

    directory:
      projectDir,

    category:
      plan.category,

    appType:
      plan.appType,

    features:
      plan.features.map(
        item => item.id
      ),

    pages:
      plan.pages.map(
        item => item.file
      ),

    version,

    validation,

    status:
      validation.valid
        ? 'generated'
        : 'generated-with-errors',

    createdAt:
      nowIso(),

    updatedAt:
      nowIso()
  };

  registerProject(
    project
  );

  return {
    project,
    plan
  };
}
// ==========================================
// PART 9/10
// Autonomous Engine API Routes
// ==========================================

router.get(
  '/health',
  (req, res) => {
    res.json({
      success: true,
      engine:
        'SamarthAI Autonomous Engine',
      version:
        ENGINE_VERSION,
      status:
        'online',
      time:
        nowIso()
    });
  }
);

router.post(
  '/analyze',
  (req, res) => {
    try {
      const {
        prompt
      } = req.body || {};

      if (
        !prompt ||
        typeof prompt !==
          'string'
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              'Project description is required.'
          });
      }

      const analysis =
        analyzeRequirement(
          prompt
        );

      const plan =
        buildProjectPlan(
          analysis
        );

      res.json({
        success: true,
        analysis,
        plan
      });

    } catch (error) {
      res
        .status(500)
        .json({
          success: false,
          error:
            error.message
        });
    }
  }
);

router.post(
  '/generate',
  (req, res) => {
    try {
      const {
        prompt
      } = req.body || {};

      const result =
        createProject(
          prompt
        );

      res.json({
        success: true,

        message:
          'Project generated successfully.',

        project:
          result.project,

        plan:
          result.plan,

        previewUrl:
          `/api/autonomous/preview/${result.project.id}`,

        filesUrl:
          `/api/autonomous/files/${result.project.id}`,

        buildStatus:
          'source-generated',

        androidBuild:
          'not-built',

        playStoreStatus:
          'not-published'
      });

    } catch (error) {
      res
        .status(400)
        .json({
          success: false,
          error:
            error.message
        });
    }
  }
);

// Backward compatibility
router.post(
  '/generate-project',
  (req, res) => {
    try {
      let prompt =
        req.body &&
        req.body.prompt;

      if (!prompt) {
        const name =
          cleanText(
            req.body &&
              req.body.projectName
          // ==========================================
// PART 10/10
// Preview + Files + Update + Export
// ==========================================
// ==========================================
// PREVIEW ASSETS
// ==========================================

router.get(
  '/preview/:id/assets/:asset',
  (req, res) => {

    const id =
      safeId(
        req.params.id
      );

    const project =
      findProject(id);

    if (!project) {
      return res
        .status(404)
        .send(
          'Project not found'
        );
    }

    const asset =
      cleanText(
        req.params.asset,
        100
      );

    if (
      asset.includes('..') ||
      asset.includes('/') ||
      asset.includes('\\')
    ) {
      return res
        .status(400)
        .send(
          'Invalid asset'
        );
    }

    const assetPath =
      safeFilePath(
        project.directory,
        path.join(
          'public',
          'assets',
          asset
        )
      );

    if (
      !fs.existsSync(
        assetPath
      )
    ) {
      return res
        .status(404)
        .send(
          'Asset not found'
        );
    }

    res.sendFile(
      assetPath
    );
  }
);
router.get(
  '/preview/:id',
  (req, res) => {
    const id =
      safeId(
        req.params.id
      );

    const project =
      findProject(id);

    if (!project) {
      return res
        .status(404)
        .send(
          '<h1>Project not found</h1>'
        );
    }

    const filePath =
      safeFilePath(
        project.directory,
        'public/index.html'
      );

    if (
      !fs.existsSync(filePath)
    ) {
      return res
        .status(404)
        .send(
          '<h1>Preview not available</h1>'
        );
    }

    res.sendFile(
      filePath
    );
  }
);

router.get(
  '/preview/:id/:page',
  (req, res) => {
    const id =
      safeId(
        req.params.id
      );

    const project =
      findProject(id);

    if (!project) {
      return res
        .status(404)
        .send(
          '<h1>Project not found</h1>'
        );
    }

    const page =
      cleanText(
        req.params.page,
        120
      );

    if (
      page.includes('/') ||
      page.includes('\\') ||
      page.includes('..')
    ) {
      return res
        .status(400)
        .send(
          '<h1>Invalid page</h1>'
        );
    }

    const filePath =
      safeFilePath(
        project.directory,
        path.join(
          'public',
          page
        )
      );

    if (
      !fs.existsSync(filePath)
    ) {
      return res
        .status(404)
        .send(
          '<h1>Page not found</h1>'
        );
    }

    res.sendFile(
      filePath
    );
  }
);

router.get(
  '/files/:id',
  (req, res) => {
    const id =
      safeId(
        req.params.id
      );

    const project =
      findProject(id);

    if (!project) {
      return res
        .status(404)
        .json({
          success: false,
          error:
            'Project not found.'
        });
    }

    const files = [];

    function scanDirectory(
      directory,
      relative = ''
    ) {
      if (
        !fs.existsSync(
          directory
        )
      ) {
        return;
      }

      const entries =
        fs.readdirSync(
          directory,
          {
            withFileTypes: true
          }
        );

      for (
        const entry of entries
      ) {
        if (
          entry.name ===
            'versions' ||
          entry.name ===
            '.git' ||
          entry.name ===
            'node_modules'
        ) {
          continue;
        }

        const fullPath =
          path.join(
            directory,
            entry.name
          );

        const relativePath =
          path.join(
            relative,
            entry.name
          );

        if (
          entry.isDirectory()
        ) {
          scanDirectory(
            fullPath,
            relativePath
          );
        } else {
          files.push(
            relativePath
              .replace(
                /\\/g,
                '/'
              )
          );
        }
      }
    }

    scanDirectory(
      project.directory
    );

    res.json({
      success: true,
      projectId: id,
      count: files.length,
      files
    });
  }
);

router.get(
  '/file/:id',
  (req, res) => {
    const id =
      safeId(
        req.params.id
      );

    const project =
      findProject(id);

    if (!project) {
      return res
        .status(404)
        .json({
          success: false,
          error:
            'Project not found.'
        });
    }

    const requestedPath =
      req.query.path;

    if (
      !requestedPath ||
      typeof requestedPath !==
        'string'
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            'File path is required.'
        });
    }

    if (
      requestedPath.includes('..')
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            'Invalid file path.'
        });
    }

    try {
      const filePath =
        safeFilePath(
          project.directory,
          requestedPath
        );

      if (
        !fs.existsSync(
          filePath
        ) ||
        !fs.statSync(
          filePath
        ).isFile()
      ) {
        return res
          .status(404)
          .json({
            success: false,
            error:
              'File not found.'
          });
      }

      res.type(
        'text/plain'
      );

      res.send(
        fs.readFileSync(
          filePath,
          'utf8'
        )
      );

    } catch (error) {
      res
        .status(400)
        .json({
          success: false,
          error:
            error.message
        });
    }
  }
);

router.post(
  '/update/:id',
  (req, res) => {
    try {
      const id =
        safeId(
          req.params.id
        );

      const project =
        findProject(id);

      if (!project) {
        return res
          .status(404)
          .json({
            success: false,
            error:
              'Project not found.'
          });
      }

      const {
        prompt,
        changes
      } =
        req.body || {};

      const updateText =
        cleanText(
          prompt ||
          changes,
          MAX_PROMPT_LENGTH
        );

      if (!updateText) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              'Update description is required.'
          });
      }

      const oldManifest =
        readJson(
          path.join(
            project.directory,
            'manifest.json'
          ),
          {}
        );

      const oldPlan =
        oldManifest &&
        oldManifest.features
          ? {
              projectName:
                oldManifest.name ||
                project.name,

              description:
                oldManifest.description ||
                '',

              category:
                oldManifest.category ||
                project.category,

              appType:
                oldManifest.type ||
                project.appType,

              theme: {
                primary:
                  oldManifest
                    .theme &&
                  oldManifest.theme.primary
                    ? oldManifest.theme.primary
                    : '#2563eb',
                mode: 'dark'
              },

              features:
                oldManifest.features ||
                [],

              pages:
                oldManifest.pages ||
                [],

              entities:
                oldManifest.entities ||
                [],

              api:
                oldManifest.api ||
                []
            }
          : null;

      const updateAnalysis =
        analyzeRequirement(
          updateText
        );

      const newPlan =
        buildProjectPlan(
          updateAnalysis
        );

      if (
        oldPlan
      ) {
        if (
          !newPlan.description
        ) {
          newPlan.description =
            oldPlan.description;
        }

        if (
          newPlan.projectName ===
          'Samarth Generated App'
        ) {
          newPlan.projectName =
            oldPlan.projectName;
        }
      }

   generateAllPages(
  project.directory,
  newPlan,
  project.id
);   

      writeText(
        path.join(
          project.directory,
          'backend',
          'server.js'
        ),
        generateBackendServer(
          newPlan
        )
      );

      writeProjectMetadata(
        project.directory,
        newPlan,
        project.id
      );

      const validation =
        validateProject(
          project.directory
        );

      const version =
        saveVersion(
          project.directory,
          newPlan,
          'user-update'
        );

      project.name =
        newPlan.projectName;

      project.category =
        newPlan.category;

      project.appType =
        newPlan.appType;

      project.features =
        newPlan.features.map(
          item => item.id
        );

      project.pages =
        newPlan.pages.map(
          item => item.file
        );

      project.version =
        version;

      project.validation =
        validation;

      project.status =
        validation.valid
          ? 'updated'
          : 'updated-with-errors';

      project.updatedAt =
        nowIso();

      registerProject(
        project
      );

      res.json({
        success: true,

        message:
          'Project updated successfully.',

        project,

        plan:
          newPlan,

        version,

        previewUrl:
          `/api/autonomous/preview/${project.id}`
      });

    } catch (error) {
      res
        .status(500)
        .json({
          success: false,
          error:
            error.message
        });
    }
  }
);

router.post(
  '/build/:id',
  (req, res) => {
    const id =
      safeId(
        req.params.id
      );

    const project =
      findProject(id);

    if (!project) {
      return res
        .status(404)
        .json({
          success: false,
          error:
            'Project not found.'
        });
    }

    const validation =
      validateProject(
        project.directory
      );

    res.json({
      success:
        validation.valid,

      projectId:
        id,

      validation,

      buildStatus:
        validation.valid
          ? 'source-validated'
          : 'source-validation-failed',

      androidAPK:
        null,

      androidAAB:
        null,

      playStoreReady:
        false,

      message:
        validation.valid
          ? 'Source project is valid. A real Android build environment is required to create APK/AAB.'
          : 'Project validation failed. Fix source errors before Android build.'
    });
  }
);

router.get(
  '/routes',
  (req, res) => {
    res.json({
      success: true,

      routes: [
        'GET /health',
        'POST /analyze',
        'POST /generate',
        'POST /generate-project',
        'GET /projects',
        'GET /project/:id',
        'GET /validate/:id',
        'GET /preview/:id',
        'GET /preview/:id/:page',
        'GET /files/:id',
        'GET /file/:id?path=...',
        'POST /update/:id',
        'POST /build/:id'
      ]
    });
  }
);

// ==========================================
// END OF SAMARTHAI AUTONOMOUS ENGINE
// ==========================================

module.exports = router;    
