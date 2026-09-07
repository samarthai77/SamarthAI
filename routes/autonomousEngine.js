'use strict';

/*
=========================================================
 SamarthAI Autonomous App & Website Generator
 Router/autonomous.js
=========================================================

Purpose:
- Natural language requirement -> AI blueprint
- Blueprint -> real project files
- Dynamic pages
- Dynamic entities / CRUD APIs
- Preview
- Project versions
- Update existing project
- Validation
- Build package preparation

Required:
  GEMINI_API_KEY

Optional:
  GEMINI_MODEL=gemini-2.5-flash

Node:
  Node.js 18+

=========================================================
*/

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();
// ============================================================
// BASIC HEALTH CHECK
// ============================================================

router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'healthy',
        service: 'SamarthAI Autonomous Engine',
        timestamp: new Date().toISOString()
    });
});
/* =======================================================
   CONFIG
======================================================= */

const ROOT_DIR = path.resolve(__dirname, '..');
const PROJECTS_DIR = path.join(ROOT_DIR, 'generated_projects');
const REGISTRY_FILE = path.join(PROJECTS_DIR, 'registry.json');

const GEMINI_API_KEY =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';

const GEMINI_MODEL =
    process.env.GEMINI_MODEL ||
    'gemini-2.5-flash';

const MAX_PROJECTS = 100;

fs.mkdirSync(PROJECTS_DIR, { recursive: true });

/* =======================================================
   BASIC HELPERS
======================================================= */

function now() {
    return new Date().toISOString();
}

function makeId() {
    return crypto.randomUUID();
}

function cleanText(value, fallback = '') {
    if (value === undefined || value === null) {
        return fallback;
    }

    return String(value).trim();
}

function safeSlug(value) {
    return cleanText(value, 'samarth-app')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'samarth-app';
}

function safeFileName(value) {
    return String(value || '')
        .replace(/\\/g, '/')
        .replace(/\.\./g, '')
        .replace(/^\/+/, '');
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf8');
}

function readJson(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) {
            return fallback;
        }

        return JSON.parse(
            fs.readFileSync(filePath, 'utf8')
        );
    } catch (error) {
        return fallback;
    }
}

function writeJson(filePath, data) {
    writeFile(
        filePath,
        JSON.stringify(data, null, 2)
    );
}

/* =======================================================
   REGISTRY
======================================================= */

function loadRegistry() {
    return readJson(REGISTRY_FILE, {
        version: 1,
        projects: []
    });
}

function saveRegistry(registry) {
    writeJson(REGISTRY_FILE, registry);
}

function registerProject(project) {
    const registry = loadRegistry();

    registry.projects = registry.projects.filter(
        item => item.id !== project.id
    );

    registry.projects.unshift({
        id: project.id,
        name: project.name,
        slug: project.slug,
        type: project.type,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        version: project.version,
        status: project.status
    });

    registry.projects =
        registry.projects.slice(0, MAX_PROJECTS);

    saveRegistry(registry);
}

function getProject(id) {
    const registry = loadRegistry();

    return registry.projects.find(
        item => item.id === id || item.slug === id
    ) || null;
}

function projectDirectory(project) {
    return path.join(
        PROJECTS_DIR,
        project.id
    );
}

/* =======================================================
   AI PROMPT
======================================================= */

function buildSystemPrompt() {
    return `
You are the architecture engine of SamarthAI.

Your job is to convert a user's natural-language app or website
requirement into a precise software blueprint.

The user may describe:
- business websites
- ecommerce apps
- school systems
- booking systems
- social apps
- service marketplaces
- dashboards
- inventory systems
- CRM
- portfolios
- blogs
- restaurant systems
- construction business systems
- AI tools
- community applications
- mobile-first websites
- other legitimate software

Return ONLY valid JSON.

Required JSON structure:

{
  "name": "",
  "type": "website|webapp|pwa|mobileapp",
  "category": "",
  "description": "",
  "theme": {
    "primary": "",
    "secondary": "",
    "background": "",
    "text": ""
  },
  "roles": [],
  "features": [],
  "pages": [],
  "entities": [],
  "apis": [],
  "externalServices": []
}

Page format:

{
  "name": "",
  "slug": "",
  "title": "",
  "description": "",
  "features": [],
  "entity": ""
}

Entity format:

{
  "name": "",
  "slug": "",
  "fields": [
    {
      "name": "",
      "type": "text|number|email|phone|date|boolean|textarea|url",
      "required": false
    }
  ]
}

API format:

{
  "name": "",
  "method": "GET|POST|PUT|DELETE",
  "path": "",
  "description": "",
  "entity": ""
}

Rules:

1. Do not invent impossible requirements.
2. Convert the user's actual requirement into concrete modules.
3. Create useful pages instead of random pages.
4. Create entities when persistent data is required.
5. Create CRUD APIs for important entities.
6. Keep names short and machine-safe.
7. Use valid CSS hex colors.
8. Do not return markdown.
9. Do not return explanations outside JSON.
10. Never claim that an APK/AAB has been built.
`;
}

/* =======================================================
   GEMINI CALL
======================================================= */

async function askGemini(requirement) {

    if (!GEMINI_API_KEY) {
        return null;
    }

    const endpoint =
        'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(GEMINI_MODEL) +
        ':generateContent?key=' +
        encodeURIComponent(GEMINI_API_KEY);

    const payload = {
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text:
                            buildSystemPrompt() +
                            '\n\nUSER REQUIREMENT:\n' +
                            requirement
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
        }
    };

    try {

        const response = await fetch(
            endpoint,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );

        if (!response.ok) {
            const errorText =
                await response.text();

            console.error(
                '[GEMINI ERROR]',
                response.status,
                errorText
            );

            return null;
        }

        const data =
            await response.json();

        const text =
            data &&
            data.candidates &&
            data.candidates[0] &&
            data.candidates[0].content &&
            data.candidates[0].content.parts &&
            data.candidates[0].content.parts[0] &&
            data.candidates[0].content.parts[0].text;

        if (!text) {
            return null;
        }

        return parseAIJson(text);

    } catch (error) {

        console.error(
            '[GEMINI REQUEST ERROR]',
            error.message
        );

        return null;
    }
}

/* =======================================================
   AI JSON PARSER
======================================================= */

function parseAIJson(text) {

    let cleaned = String(text || '').trim();

    cleaned = cleaned
        .replace(/^```json/i, '')
        .replace(/^```/i, '')
        .replace(/```$/i, '')
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch (firstError) {

        const start =
            cleaned.indexOf('{');

        const end =
            cleaned.lastIndexOf('}');

        if (
            start !== -1 &&
            end !== -1 &&
            end > start
        ) {

            const possibleJson =
                cleaned.slice(
                    start,
                    end + 1
                );

            try {
                return JSON.parse(
                    possibleJson
                );
            } catch (secondError) {
                return null;
            }
        }

        return null;
    }
}

/* =======================================================
   FALLBACK BLUEPRINT
======================================================= */

function fallbackBlueprint(
    requirement,
    projectName,
    projectType
) {

    const name =
        cleanText(
            projectName,
            'SamarthAI App'
        );

    const slug =
        safeSlug(name);

    const type =
        cleanText(
            projectType,
            'webapp'
        );

    return {
        name,
        type,
        category: 'Custom Application',
        description:
            cleanText(
                requirement,
                'Custom application generated by SamarthAI.'
            ),

        theme: {
            primary: '#FF6B00',
            secondary: '#003366',
            background: '#F7F8FA',
            text: '#111827'
        },

        roles: [
            'user',
            'admin'
        ],

        features: [
            'responsive UI',
            'navigation',
            'dashboard',
            'data management'
        ],

        pages: [
            {
                name: 'Home',
                slug: 'index',
                title: name,
                description:
                    'Main application page',
                features: [
                    'hero',
                    'navigation',
                    'call to action'
                ],
                entity: ''
            },
            {
                name: 'Dashboard',
                slug: 'dashboard',
                title: 'Dashboard',
                description:
                    'Application dashboard',
                features: [
                    'overview',
                    'statistics'
                ],
                entity: ''
            },
            {
                name: 'Settings',
                slug: 'settings',
                title: 'Settings',
                description:
                    'Application settings',
                features: [
                    'profile',
                    'preferences'
                ],
                entity: ''
            }
        ],

        entities: [
            {
                name: 'User',
                slug: 'users',
                fields: [
                    {
                        name: 'name',
                        type: 'text',
                        required: true
                    },
                    {
                        name: 'email',
                        type: 'email',
                        required: true
                    },
                    {
                        name: 'phone',
                        type: 'phone',
                        required: false
                    }
                ]
            }
        ],

        apis: [],

        externalServices: []
    };
}

/* =======================================================
   BLUEPRINT NORMALIZATION
======================================================= */

function normalizeBlueprint(
    blueprint,
    requirement,
    projectName,
    projectType
) {

    const fallback =
        fallbackBlueprint(
            requirement,
            projectName,
            projectType
        );

    const source =
        blueprint &&
        typeof blueprint === 'object'
            ? blueprint
            : fallback;

    const normalized = {
        name:
            cleanText(
                source.name,
                fallback.name
            ),

        type:
            cleanText(
                source.type,
                fallback.type
            ),

        category:
            cleanText(
                source.category,
                fallback.category
            ),

        description:
            cleanText(
                source.description,
                fallback.description
            ),

        theme: {
            primary:
                cleanText(
                    source.theme &&
                    source.theme.primary,
                    '#FF6B00'
                ),

            secondary:
                cleanText(
                    source.theme &&
                    source.theme.secondary,
                    '#003366'
                ),

            background:
                cleanText(
                    source.theme &&
                    source.theme.background,
                    '#F7F8FA'
                ),

            text:
                cleanText(
                    source.theme &&
                    source.theme.text,
                    '#111827'
                )
        },

        roles: Array.isArray(source.roles)
            ? source.roles
                .map(cleanText)
                .filter(Boolean)
            : fallback.roles,

        features: Array.isArray(source.features)
            ? source.features
                .map(cleanText)
                .filter(Boolean)
            : fallback.features,

        pages: Array.isArray(source.pages)
            ? source.pages
            : fallback.pages,

        entities: Array.isArray(source.entities)
            ? source.entities
            : fallback.entities,

        apis: Array.isArray(source.apis)
            ? source.apis
            : [],

        externalServices:
            Array.isArray(source.externalServices)
                ? source.externalServices
                : []
    };

    normalized.pages =
        normalized.pages
            .map((page, index) => {

                const pageName =
                    cleanText(
                        page.name,
                        `Page ${index + 1}`
                    );

                return {
                    name: pageName,

                    slug:
                        safeSlug(
                            cleanText(
                                page.slug,
                                pageName
                            )
                        ),

                    title:
                        cleanText(
                            page.title,
                            pageName
                        ),

                    description:
                        cleanText(
                            page.description,
                            ''
                        ),

                    features:
                        Array.isArray(page.features)
                            ? page.features
                                .map(cleanText)
                                .filter(Boolean)
                            : [],

                    entity:
                        cleanText(
                            page.entity,
                            ''
                        )
                };
            })
            .filter(page => page.slug);

    normalized.entities =
        normalized.entities
            .map((entity, index) => {

                const entityName =
                    cleanText(
                        entity.name,
                        `Entity ${index + 1}`
                    );

                const fields =
                    Array.isArray(entity.fields)
                        ? entity.fields
                        : [];

                return {
                    name: entityName,

                    slug:
                        safeSlug(
                            cleanText(
                                entity.slug,
                                entityName
                            )
                        ),

                    fields:
                        fields
                            .map((field, fieldIndex) => ({
                                name:
                                    cleanText(
                                        field.name,
                                        `field_${fieldIndex + 1}`
                                    ),

                                type:
                                    cleanText(
                                        field.type,
                                        'text'
                                    ),

                                required:
                                    Boolean(
                                        field.required
                                    )
                            }))
                            .filter(field => field.name)
                };
            })
            .filter(entity => entity.slug);

    return normalized;
}

/* =======================================================
   REQUIREMENT BUILDER
======================================================= */

function buildRequirement(req) {

    const body = req.body || {};

    const directPrompt =
        cleanText(
            body.prompt ||
            body.requirement ||
            body.description
        );

    const projectName =
        cleanText(
            body.projectName,
            'SamarthAI Project'
        );

    const projectType =
        cleanText(
            body.projectType,
            'webapp'
        );

    const domain =
        cleanText(
            body.domain
        );

    if (directPrompt) {
        return directPrompt;
    }

    return [
        `Create a ${projectType}.`,
        `Project name: ${projectName}.`,
        domain
            ? `Preferred domain: ${domain}.`
            : '',
        Array.isArray(body.features) &&
        body.features.length
            ? `Requested features: ${body.features.join(', ')}.`
            : ''
    ]
        .filter(Boolean)
        .join('\n');
}

/* =======================================================
   END PART 1
======================================================= */
/* =======================================================
   PART 2A — GENERATOR HELPERS
======================================================= */

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function findEntity(blueprint, name) {
    if (!name) return null;

    const key = String(name).toLowerCase();

    return (blueprint.entities || []).find(entity =>
        String(entity.slug).toLowerCase() === key ||
        String(entity.name).toLowerCase() === key
    ) || null;
}

function getPageEntity(page, blueprint) {

    if (page.entity) {
        const explicit =
            findEntity(
                blueprint,
                page.entity
            );

        if (explicit) return explicit;
    }

    const text = [
        page.name,
        page.title,
        page.description,
        ...(page.features || [])
    ]
        .join(' ')
        .toLowerCase();

    return (blueprint.entities || []).find(entity =>
        text.includes(
            String(entity.name).toLowerCase()
        ) ||
        text.includes(
            String(entity.slug).toLowerCase()
        )
    ) || null;
}

function fieldLabel(name) {
    return String(name || '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function generateFormFields(entity) {

    if (!entity || !entity.fields.length) {
        return `
            <p class="empty">
                No fields configured.
            </p>
        `;
    }

    return entity.fields.map(field => {

        const name =
            escapeHtml(field.name);

        const label =
            escapeHtml(
                fieldLabel(field.name)
            );

        const required =
            field.required
                ? 'required'
                : '';

        if (field.type === 'textarea') {
            return `
                <label>
                    ${label}
                    <textarea
                        name="${name}"
                        ${required}
                    ></textarea>
                </label>
            `;
        }

        if (field.type === 'boolean') {
            return `
                <label class="check">
                    <input
                        type="checkbox"
                        name="${name}"
                    >
                    ${label}
                </label>
            `;
        }

        const types = [
            'text',
            'number',
            'email',
            'date',
            'url',
            'tel'
        ];

        const type =
            types.includes(field.type)
                ? field.type
                : 'text';

        return `
            <label>
                ${label}
                <input
                    type="${type}"
                    name="${name}"
                    ${required}
                >
            </label>
        `;

    }).join('\n');
}

function generateTableHeaders(entity) {

    if (!entity) {
        return '<th>Data</th>';
    }

    return entity.fields.map(field => `
        <th>
            ${escapeHtml(
                fieldLabel(field.name)
            )}
        </th>
    `).join('');
}

function generateTableCells(entity) {

    if (!entity) {
        return '<td>-</td>';
    }

    return entity.fields.map(field => `
        <td data-field="${escapeHtml(field.name)}">
            -
        </td>
    `).join('');
}

/* =======================================================
   END PART 2A
======================================================= */
/* =======================================================
   PART 2B — PAGE HTML GENERATOR
======================================================= */

function generatePageHtml(project, blueprint, page) {

    const entity =
        getPageEntity(page, blueprint);

    const projectId =
        project.id;

    const title =
        escapeHtml(
            page.title || page.name
        );

    const description =
        escapeHtml(
            page.description ||
            blueprint.description
        );

    const nav =
        (blueprint.pages || [])
            .map(item => {

                const active =
                    item.slug === page.slug
                        ? 'active'
                        : '';

                return `
<a
 class="nav-link ${active}"
 href="/api/autonomous/preview/${projectId}/${encodeURIComponent(item.slug)}"
>
 ${escapeHtml(item.name)}
</a>`;

            })
            .join('');

    let content = `
<section class="hero">

    <span class="badge">
        SAMARTHAI AI
    </span>

    <h1>${title}</h1>

    <p>${description}</p>

    <div class="features">
        ${(page.features || [])
            .map(feature => `
                <span class="chip">
                    ${escapeHtml(feature)}
                </span>
            `)
            .join('')}
    </div>

</section>
`;

    if (entity) {

        content += `
<section class="card">

    <div class="section-head">

        <div>
            <h2>
                ${escapeHtml(entity.name)}
            </h2>

            <p>
                Manage ${escapeHtml(entity.name)}
                records.
            </p>
        </div>

        <button
            class="primary"
            onclick="showForm()"
        >
            + Add
        </button>

    </div>

    <form
        id="dataForm"
        class="form hidden"
        onsubmit="saveRecord(event)"
    >

        ${generateFormFields(entity)}

        <div class="actions">

            <button
                type="submit"
                class="primary"
            >
                Save
            </button>

            <button
                type="button"
                class="secondary"
                onclick="hideForm()"
            >
                Cancel
            </button>

        </div>

    </form>

    <div class="table-wrap">

        <table>

            <thead>
                <tr>
                    ${generateTableHeaders(entity)}
                    <th>Action</th>
                </tr>
            </thead>

            <tbody id="records">
            </tbody>

        </table>

    </div>

    <div
        id="empty"
        class="empty"
    >
        No records found.
    </div>

</section>
`;

    } else {

        content += `
<section class="grid">

    ${(page.features || ['Application Module'])
        .map(feature => `
            <div class="module">

                <div class="icon">
                    ✦
                </div>

                <h3>
                    ${escapeHtml(feature)}
                </h3>

                <p>
                    This module was generated
                    from your application requirement.
                </p>

            </div>
        `)
        .join('')}

</section>
`;
    }

    return `
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
 name="viewport"
 content="width=device-width,initial-scale=1"
>

<title>
${escapeHtml(blueprint.name)}
 - ${title}
</title>

<link
 rel="stylesheet"
 href="/api/autonomous/preview/${projectId}/assets/style.css"
>

</head>

<body>

<header>

    <div class="brand">

        <div class="logo">
            ${escapeHtml(
                blueprint.name
                    .charAt(0)
                    .toUpperCase()
            )}
        </div>

        <div>
            <strong>
                ${escapeHtml(blueprint.name)}
            </strong>

            <small>
                AI Generated
            </small>
        </div>

    </div>

    <button
        class="menu"
        onclick="toggleMenu()"
    >
        ☰
    </button>

</header>

<nav id="nav">
    ${nav}
</nav>

<main>

    ${content}

</main>

<footer>

    <strong>
        ${escapeHtml(blueprint.name)}
    </strong>

    <span>
        Generated by SamarthAI
    </span>

</footer>

<script>

const PROJECT_ID =
    ${JSON.stringify(projectId)};

const ENTITY =
    ${JSON.stringify(
        entity ? entity.slug : ''
    )};

const API =
    '/api/autonomous/runtime/' +
    PROJECT_ID;

function toggleMenu() {

    document
        .getElementById('nav')
        .classList.toggle('open');
}

function showForm() {

    const form =
        document.getElementById('dataForm');

    if (form) {
        form.classList.remove('hidden');
    }
}

function hideForm() {

    const form =
        document.getElementById('dataForm');

    if (form) {
        form.classList.add('hidden');
        form.reset();
    }
}

function escapeValue(value) {

    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function loadRecords() {

    if (!ENTITY) return;

    try {

        const response =
            await fetch(
                API + '/' +
                encodeURIComponent(ENTITY)
            );

        const data =
            await response.json();

        if (!data.success) return;

        renderRecords(
            data.records || []
        );

    } catch (error) {

        console.error(
            'Load error:',
            error
        );
    }
}

function renderRecords(records) {

    const tbody =
        document.getElementById('records');

    const empty =
        document.getElementById('empty');

    if (!tbody) return;

    if (!records.length) {

        tbody.innerHTML = '';

        if (empty) {
            empty.classList.remove('hidden');
        }

        return;
    }

    if (empty) {
        empty.classList.add('hidden');
    }

    tbody.innerHTML =
        records.map(record => {

            const fields =
                ${JSON.stringify(
                    entity
                        ? entity.fields
                        : []
                )};

            const cells =
                fields.map(field => {

return '<td>' + (record[field.name] ?? '') + '</td>';

                }).join('');

    return '<tr>' + cells + '<td><button class="danger" onclick="deleteRecord(\'' + record.id + '\')">Delete</button></td></tr>';      

        }).join('');
}

async function saveRecord(event) {

    event.preventDefault();

    if (!ENTITY) return;

    const form =
        document.getElementById(
            'dataForm'
        );

    const data =
        new FormData(form);

    const payload = {};

    data.forEach(
        (value, key) => {
            payload[key] = value;
        }
    );

    form
        .querySelectorAll(
            'input[type="checkbox"]'
        )
        .forEach(input => {
            payload[input.name] =
                input.checked;
        });

    try {

        const response =
            await fetch(
                API + '/' +
                encodeURIComponent(ENTITY),
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );

        const result =
            await response.json();

        if (!result.success) {

            alert(
                result.error ||
                'Save failed.'
            );

            return;
        }

        hideForm();

        loadRecords();

    } catch (error) {

        console.error(
            'Save error:',
            error
        );

        alert(
            'Server error.'
        );
    }
}

async function deleteRecord(id) {

    if (!confirm(
        'Delete this record?'
    )) {
        return;
    }

    try {

        const response =
            await fetch(
                API + '/' +
                encodeURIComponent(ENTITY) +
                '/' +
                encodeURIComponent(id),
                {
                    method: 'DELETE'
                }
            );

        const result =
            await response.json();

        if (!result.success) {

            alert(
                result.error ||
                'Delete failed.'
            );

            return;
        }

        loadRecords();

    } catch (error) {

        console.error(
            'Delete error:',
            error
        );
    }
}

document.addEventListener(
    'DOMContentLoaded',
    loadRecords
);

</script>

</body>

</html>
`;
}

/* =======================================================
   END PART 2B
======================================================= */
/* =======================================================
   PART 2C — CSS GENERATOR
======================================================= */

function generateCss(blueprint) {

    const theme =
        blueprint.theme || {};

    const primary =
        theme.primary || '#FF6B00';

    const secondary =
        theme.secondary || '#003366';

    const background =
        theme.background || '#F7F8FA';

    const text =
        theme.text || '#111827';

    return `
* {
    box-sizing: border-box;
}

html {
    scroll-behavior: smooth;
}

body {
    margin: 0;
    font-family:
        Inter,
        system-ui,
        -apple-system,
        "Segoe UI",
        sans-serif;

    background: ${background};
    color: ${text};
}

button,
input,
textarea {
    font: inherit;
}

button {
    cursor: pointer;
}

/* HEADER */

header {
    position: sticky;
    top: 0;
    z-index: 50;

    min-height: 68px;

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 12px 20px;

    color: #fff;

    background:
        linear-gradient(
            135deg,
            ${primary},
            ${secondary}
        );

    box-shadow:
        0 4px 20px
        rgba(0,0,0,.12);
}

.brand {
    display: flex;
    align-items: center;
    gap: 12px;
}

.logo {
    width: 44px;
    height: 44px;

    display: grid;
    place-items: center;

    border-radius: 13px;

    background:
        rgba(255,255,255,.18);

    font-size: 21px;
    font-weight: 800;
}

.brand strong {
    display: block;
    font-size: 17px;
}

.brand small {
    display: block;
    margin-top: 2px;
    opacity: .8;
}

.menu {
    display: none;

    border: 0;
    background: transparent;

    color: #fff;

    font-size: 25px;
}

/* NAVIGATION */

nav {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;

    padding: 10px 20px;

    background: #fff;

    border-bottom:
        1px solid #e5e7eb;
}

.nav-link {
    padding: 9px 14px;

    border-radius: 10px;

    color: #374151;

    text-decoration: none;

    font-size: 14px;
    font-weight: 700;
}

.nav-link:hover,
.nav-link.active {
    background: #f3f4f6;
    color: ${secondary};
}

/* MAIN */

main {
    width: min(
        1180px,
        calc(100% - 32px)
    );

    margin: auto;

    padding: 32px 0 60px;
}

/* HERO */

.hero {
    padding: 38px;

    border-radius: 24px;

    color: #fff;

    background:
        linear-gradient(
            135deg,
            ${primary},
            ${secondary}
        );

    box-shadow:
        0 15px 40px
        rgba(0,0,0,.13);
}

.badge {
    display: inline-block;

    padding: 6px 11px;

    margin-bottom: 14px;

    border-radius: 999px;

    background:
        rgba(255,255,255,.18);

    font-size: 11px;
    font-weight: 800;

    letter-spacing: .08em;
}

.hero h1 {
    margin: 0 0 12px;

    font-size:
        clamp(30px, 7vw, 55px);

    line-height: 1.05;
}

.hero p {
    max-width: 780px;

    margin: 0;

    line-height: 1.7;

    opacity: .93;
}

.features {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    margin-top: 23px;
}

.chip {
    padding: 8px 12px;

    border:
        1px solid
        rgba(255,255,255,.25);

    border-radius: 999px;

    background:
        rgba(255,255,255,.12);

    font-size: 13px;
}

/* CARD */

.card {
    margin-top: 28px;

    padding: 24px;

    border:
        1px solid #e5e7eb;

    border-radius: 20px;

    background: #fff;

    box-shadow:
        0 8px 30px
        rgba(0,0,0,.05);
}

.section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;

    gap: 20px;

    margin-bottom: 20px;
}

.section-head h2 {
    margin: 0 0 5px;
}

.section-head p {
    margin: 0;
    color: #6b7280;
}

/* BUTTONS */

.primary,
.secondary,
.danger {
    border: 0;

    border-radius: 10px;

    padding: 10px 15px;

    font-weight: 700;
}

.primary {
    color: #fff;

    background:
        linear-gradient(
            135deg,
            ${primary},
            ${secondary}
        );
}

.secondary {
    color: #374151;
    background: #eef0f3;
}

.danger {
    color: #991b1b;
    background: #fee2e2;
}

/* FORM */

.form {
    margin-bottom: 24px;

    padding: 20px;

    border-radius: 16px;

    background: #f8fafc;

    border:
        1px solid #e5e7eb;
}

.form label {
    display: block;

    margin-bottom: 15px;

    font-size: 13px;
    font-weight: 700;
}

.form input,
.form textarea {
    display: block;

    width: 100%;

    margin-top: 6px;

    padding: 11px 12px;

    border:
        1px solid #d1d5db;

    border-radius: 10px;

    outline: none;

    background: #fff;
}

.form textarea {
    min-height: 100px;

    resize: vertical;
}

.form input:focus,
.form textarea:focus {
    border-color: ${primary};

    box-shadow:
        0 0 0 3px
        rgba(255,107,0,.12);
}

.form .check {
    display: flex;
    align-items: center;
    gap: 8px;
}

.form .check input {
    width: auto;
    margin: 0;
}

.actions {
    display: flex;
    gap: 10px;
}

/* TABLE */

.table-wrap {
    width: 100%;

    overflow-x: auto;
}

table {
    width: 100%;

    min-width: 600px;

    border-collapse: collapse;
}

th,
td {
    padding: 12px;

    text-align: left;

    border-bottom:
        1px solid #e5e7eb;

    font-size: 14px;
}

th {
    background: #f8fafc;
    font-weight: 800;
}

tr:hover td {
    background: #fafafa;
}

/* MODULE GRID */

.grid {
    display: grid;

    grid-template-columns:
        repeat(
            auto-fit,
            minmax(220px, 1fr)
        );

    gap: 18px;

    margin-top: 28px;
}

.module {
    padding: 22px;

    border:
        1px solid #e5e7eb;

    border-radius: 18px;

    background: #fff;

    box-shadow:
        0 8px 25px
        rgba(0,0,0,.04);
}

.icon {
    width: 44px;
    height: 44px;

    display: grid;
    place-items: center;

    margin-bottom: 12px;

    border-radius: 12px;

    color: #fff;

    background:
        linear-gradient(
            135deg,
            ${primary},
            ${secondary}
        );

    font-size: 20px;
}

.module h3 {
    margin: 0 0 8px;
}

.module p {
    margin: 0;

    color: #6b7280;

    line-height: 1.6;
}

/* STATES */

.empty {
    padding: 25px;

    text-align: center;

    color: #6b7280;
}

.hidden {
    display: none !important;
}

/* FOOTER */

footer {
    display: flex;
    align-items: center;
    justify-content: center;

    gap: 10px;

    padding: 25px;

    color: #6b7280;

    font-size: 13px;
}

/* MOBILE */

@media (max-width: 700px) {

    .menu {
        display: block;
    }

    nav {
        display: none;

        flex-direction: column;
    }

    nav.open {
        display: flex;
    }

    .nav-link {
        width: 100%;
    }

    main {
        width:
            calc(100% - 20px);

        padding-top: 20px;
    }

    .hero {
        padding: 25px 20px;

        border-radius: 18px;
    }

    .hero h1 {
        font-size: 34px;
    }

    .card {
        padding: 16px;
    }

    .section-head {
        align-items: stretch;
        flex-direction: column;
    }

    .section-head .primary {
        width: 100%;
    }

    .actions {
        flex-direction: column;
    }

    .actions button {
        width: 100%;
    }

    footer {
        flex-direction: column;
    }
}
`;
}

/* =======================================================
   END PART 2C
======================================================= */
/* =======================================================
   PART 2D — APP JS + PROJECT FILE GENERATORS
======================================================= */

function generateAppJs(project, blueprint) {

    const projectId = project.id;

    return `
'use strict';

const PROJECT_ID = ${JSON.stringify(projectId)};
const API_BASE =
    '/api/autonomous/runtime/' + PROJECT_ID;

let currentEntity = null;


/* -------------------------------------------------------
   BASIC HELPERS
------------------------------------------------------- */

function escapeHtml(value) {

    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


/* -------------------------------------------------------
   MOBILE MENU
------------------------------------------------------- */

function toggleMenu() {

    const nav =
        document.querySelector('.nav');

    if (nav) {
        nav.classList.toggle('open');
    }
}


/* -------------------------------------------------------
   FORM
------------------------------------------------------- */

function showForm() {

    const form =
        document.getElementById('recordForm');

    if (form) {
        form.style.display = 'block';
        form.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}


function hideForm() {

    const form =
        document.getElementById('recordForm');

    if (form) {
        form.style.display = 'none';
    }
}


/* -------------------------------------------------------
   API REQUEST
------------------------------------------------------- */

async function apiRequest(
    url,
    method = 'GET',
    body = null
) {

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (body !== null) {
        options.body =
            JSON.stringify(body);
    }

    const response =
        await fetch(url, options);

    let data = {};

    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            'Request failed'
        );
    }

    return data;
}


/* -------------------------------------------------------
   ENTITY
------------------------------------------------------- */

function getEntityName() {

    if (typeof ENTITY !== 'undefined' &&
        ENTITY &&
        ENTITY.name) {

        return ENTITY.name;
    }

    return null;
}


/* -------------------------------------------------------
   LOAD RECORDS
------------------------------------------------------- */

async function loadRecords() {

    const entity =
        getEntityName();

    if (!entity) {
        return;
    }

    currentEntity = entity;

    const tableBody =
        document.getElementById(
            'recordsBody'
        );

    if (tableBody) {
        tableBody.innerHTML =
            '<tr><td colspan="20">Loading...</td></tr>';
    }

    try {

        const data =
            await apiRequest(
                API_BASE +
                '/' +
                encodeURIComponent(entity)
            );

        renderRecords(
            data.records || []
        );

    } catch (error) {

        console.error(error);

        if (tableBody) {
            tableBody.innerHTML =
                '<tr><td colspan="20">Unable to load data.</td></tr>';
        }
    }
}


/* -------------------------------------------------------
   RENDER RECORDS
------------------------------------------------------- */

function renderRecords(records) {

    const tableBody =
        document.getElementById(
            'recordsBody'
        );

    if (!tableBody) {
        return;
    }

    if (!records.length) {

        tableBody.innerHTML =
            '<tr><td colspan="20">No records found.</td></tr>';

        return;
    }

    tableBody.innerHTML =
        records.map(record => {

            const values =
                Object.entries(record)
                    .filter(
                        ([key]) =>
                            key !== 'id' &&
                            key !== 'createdAt' &&
                            key !== 'updatedAt'
                    )
                    .map(
                        ([, value]) =>
                            '<td>' +
                            escapeHtml(value) +
                            '</td>'
                    )
                    .join('');

            return (
                '<tr>' +
                values +
                '<td>' +
                '<button class="btn danger" ' +
                'data-record-id="' +
                escapeHtml(record.id) +
                '" ' +
                'onclick="deleteRecord(this.dataset.recordId)">' +
                'Delete' +
                '</button>' +
                '</td>' +
                '</tr>'
            );

        }).join('');
}


/* -------------------------------------------------------
   SAVE RECORD
------------------------------------------------------- */

async function saveRecord(event) {

    if (event) {
        event.preventDefault();
    }

    const entity =
        getEntityName();

    if (!entity) {
        return;
    }

    const form =
        document.getElementById(
            'recordForm'
        );

    if (!form) {
        return;
    }

    const formData =
        new FormData(form);

    const payload = {};

    for (const [key, value]
        of formData.entries()) {

        payload[key] = value;
    }

    try {

        const data =
            await apiRequest(
                API_BASE +
                '/' +
                encodeURIComponent(entity),
                'POST',
                payload
            );

        if (data.success) {

            form.reset();

            hideForm();

            await loadRecords();
        }

    } catch (error) {

        console.error(error);

        alert(
            error.message ||
            'Unable to save record.'
        );
    }
}


/* -------------------------------------------------------
   DELETE RECORD
------------------------------------------------------- */

async function deleteRecord(recordId) {

    if (!recordId) {
        return;
    }

    const confirmed =
        window.confirm(
            'Delete this record?'
        );

    if (!confirmed) {
        return;
    }

    const entity =
        getEntityName();

    if (!entity) {
        return;
    }

    try {

        await apiRequest(
            API_BASE +
            '/' +
            encodeURIComponent(entity) +
            '/' +
            encodeURIComponent(recordId),
            'DELETE'
        );

        await loadRecords();

    } catch (error) {

        console.error(error);

        alert(
            error.message ||
            'Unable to delete record.'
        );
    }
}


/* -------------------------------------------------------
   PAGE INITIALIZATION
------------------------------------------------------- */

document.addEventListener(
    'DOMContentLoaded',
    () => {

        const form =
            document.getElementById(
                'recordForm'
            );

        if (form) {

            form.addEventListener(
                'submit',
                saveRecord
            );
        }

        loadRecords();
    }
);


/* -------------------------------------------------------
   GLOBAL FUNCTIONS
------------------------------------------------------- */

window.toggleMenu =
    toggleMenu;

window.showForm =
    showForm;

window.hideForm =
    hideForm;

window.saveRecord =
    saveRecord;

window.deleteRecord =
    deleteRecord;

window.loadRecords =
    loadRecords;

`;


}


/* =======================================================
   METADATA
======================================================= */

function generateMetadata(project, blueprint) {

    return JSON.stringify({

        generator: 'SamarthAI Autonomous Engine',

        generatorVersion: '1.0.0',

        projectId: project.id,

        projectName:
            project.name,

        slug:
            project.slug,

        description:
            blueprint.description ||
            project.requirement,

        category:
            blueprint.category ||
            'application',

        platform:
            blueprint.platform ||
            'web',

        version:
            project.version,

        createdAt:
            project.createdAt,

        updatedAt:
            project.updatedAt,

        features:
            blueprint.features || [],

        pages:
            (blueprint.pages || []).map(
                page => ({
                    name: page.name,
                    title: page.title
                })
            ),

        entities:
            (blueprint.entities || []).map(
                entity => ({
                    name: entity.name,
                    label: entity.label,
                    fields: entity.fields || []
                })
            )

    }, null, 2);
}


/* =======================================================
   MANIFEST
======================================================= */

function generateManifest(project, blueprint) {

    return JSON.stringify({

        name:
            blueprint.projectName ||
            project.name,

        short_name:
            project.slug.substring(0, 30),

        description:
            blueprint.description ||
            'Generated by SamarthAI',

        start_url:
            '/',

        display:
            'standalone',

        background_color:
            blueprint.theme?.background ||
            '#08071d',

        theme_color:
            blueprint.theme?.primary ||
            '#ff6b00',

        icons: []

    }, null, 2);
}


/* =======================================================
   README
======================================================= */

function generateReadme(project, blueprint) {

    const features =
        (blueprint.features || [])
            .map(
                feature =>
                    `- ${feature}`
            )
            .join('\\n');

    const pages =
        (blueprint.pages || [])
            .map(
                page =>
                    `- ${page.name}: ${page.title}`
            )
            .join('\\n');

    const entities =
        (blueprint.entities || [])
            .map(
                entity =>
                    `- ${entity.name}`
            )
            .join('\\n');

    return `# ${project.name}

Generated by **SamarthAI Autonomous Engine**

## Project ID

${project.id}

## Description

${blueprint.description || project.requirement}

## Features

${features || '- Core application features'}

## Pages

${pages || '- Home'}

## Data Entities

${entities || '- None'}

## Generated Structure

- index.html
- pages/
- assets/
- data/
- blueprint.json
- metadata.json
- manifest.json
- README.md

## Runtime

The generated application communicates with the
SamarthAI Autonomous Runtime API.

## Version

${project.version}

## Important

This project has been generated and structurally
validated by SamarthAI.

Android APK/AAB generation is a separate real build
pipeline and must not be treated as completed until
an actual build artifact has been produced and verified.
`;
}


/* =======================================================
   PROJECT FILE GENERATOR
======================================================= */

function generateProjectFiles(project, blueprint) {

    const files = {};

    const homePage =
        blueprint.pages?.[0] || {
            name: 'home',
            title: blueprint.projectName ||
                project.name
        };

    files['index.html'] =
        generatePageHtml(
            project,
            blueprint,
            homePage
        );

    for (
        const page of blueprint.pages || []
    ) {

        if (
            String(page.name).toLowerCase() ===
            String(homePage.name).toLowerCase()
        ) {
            continue;
        }

        files[
            `pages/${safeSlug(page.name)}.html`
        ] =
            generatePageHtml(
                project,
                blueprint,
                page
            );
    }

    files['assets/style.css'] =
        generateCss(blueprint);

    files['assets/app.js'] =
        generateAppJs(
            project,
            blueprint
        );

    files['metadata.json'] =
        generateMetadata(
            project,
            blueprint
        );

    files['manifest.json'] =
        generateManifest(
            project,
            blueprint
        );

    files['blueprint.json'] =
        JSON.stringify(
            blueprint,
            null,
            2
        );

    files['README.md'] =
        generateReadme(
            project,
            blueprint
        );

    return files;
}


/* =======================================================
   WRITE COMPLETE PROJECT
======================================================= */

function writeGeneratedProject(
    project,
    blueprint
) {

    const directory =
        projectDirectory(
            project.id
        );

    ensureDir(directory);

    const files =
        generateProjectFiles(
            project,
            blueprint
        );

    for (
        const [relativePath, content]
        of Object.entries(files)
    ) {

        const fullPath =
            path.join(
                directory,
                relativePath
            );

        writeFile(
            fullPath,
            content
        );
    }

    ensureDir(
        path.join(
            directory,
            'data'
        )
    );

    return {
        directory,
        files: Object.keys(files)
    };
}


/* =======================================================
   END PART 2D
======================================================= */
/* =======================================================
   PART 3A — RUNTIME DATA
======================================================= */

function runtimeFile(projectId) {
    return path.join(
        projectDirectory(projectId),
        'runtime.json'
    );
}

function loadRuntime(projectId) {

    const file =
        runtimeFile(projectId);

    const data =
        readJson(file, {
            records: {},
            updatedAt: now()
        });

    if (!data.records) {
        data.records = {};
    }

    return data;
}

function saveRuntime(projectId, data) {

    data.updatedAt = now();

    writeFile(
        runtimeFile(projectId),
        JSON.stringify(
            data,
            null,
            2
        )
    );

    return data;
}

function makeRecordId() {

    return crypto.randomUUID();
}

function normalizeRecord(input) {

    if (
        !input ||
        typeof input !== 'object'
    ) {
        return {};
    }

    const output = {};

    for (
        const [key, value]
        of Object.entries(input)
    ) {

        if (
            key === 'id' ||
            key === 'createdAt' ||
            key === 'updatedAt'
        ) {
            continue;
        }

        if (
            typeof value === 'string'
        ) {

            output[key] =
                cleanText(
                    value,
                    5000
                );

        } else if (
            typeof value === 'number' ||
            typeof value === 'boolean'
        ) {

            output[key] = value;

        } else if (
            value === null
        ) {

            output[key] = null;

        } else {

            output[key] =
                String(value);
        }
    }

    return output;
}


/* =======================================================
   ENTITY HELPERS
======================================================= */

function getPrimaryEntity(blueprint) {

    if (
        !blueprint ||
        !Array.isArray(
            blueprint.entities
        )
    ) {
        return null;
    }

    return blueprint.entities[0] || null;
}

function findEntityByName(
    blueprint,
    name
) {

    if (
        !blueprint ||
        !Array.isArray(
            blueprint.entities
        )
    ) {
        return null;
    }

    return blueprint.entities.find(
        entity =>
            String(
                entity.name || ''
            ).toLowerCase() ===
            String(
                name || ''
            ).toLowerCase()
    ) || null;
}


/* =======================================================
   PROJECT STATUS
======================================================= */

function updateProjectStatus(
    projectId,
    status,
    extra = {}
) {

    const project =
        getProject(projectId);

    if (!project) {
        return null;
    }

    Object.assign(
        project,
        {
            status,
            updatedAt: now(),
            ...extra
        }
    );

    saveRegistry();

    return project;
}


/* =======================================================
   END PART 3A
======================================================= */
/* =======================================================
   PART 3B — PROJECT CREATION ENGINE
======================================================= */

async function createAutonomousProject(input) {

    const requirement =
        buildRequirement(input);

    let blueprint = null;

    try {

        blueprint =
            await askGemini(
                requirement
            );

    } catch (error) {

        console.error(
            '[AI ANALYZER]',
            error.message
        );

        blueprint = null;
    }

    /*
     * अगर AI response नहीं मिला,
     * तो fallback blueprint इस्तेमाल होगा।
     */
    if (!blueprint) {

        blueprint =
            fallbackBlueprint(
                requirement
            );
    }

    blueprint =
        normalizeBlueprint(
            blueprint,
            requirement
        );

    const projectId =
        makeId();

    const project = {

        id: projectId,

        name:
            safeFileName(
                input.projectName ||
                blueprint.projectName ||
                'SamarthAI Project'
            ),

        slug:
            safeSlug(
                input.projectName ||
                blueprint.projectName ||
                'samarthai-project'
            ),

        requirement,

        blueprint,

        status:
            'GENERATING',

        createdAt:
            now(),

        updatedAt:
            now(),

        version:
            1
    };


    /* ---------------------------------------------------
       PROJECT DIRECTORIES
    --------------------------------------------------- */

  const directory = projectDirectory({ id: projectId });

    ensureDir(
        directory
    );

    ensureDir(
        path.join(
            directory,
            'assets'
        )
    );

    ensureDir(
        path.join(
            directory,
            'pages'
        )
    );

    ensureDir(
        path.join(
            directory,
            'data'
        )
    );


    registerProject(
        project
    );


    /* ---------------------------------------------------
       GENERATE FILES
    --------------------------------------------------- */

    try {

        const result =
            writeGeneratedProject(
                project,
                blueprint
            );


        /* Runtime storage */

        saveRuntime(
            projectId,
            {
                records: {},
                updatedAt: now()
            }
        );


        /* Save project status */

        updateProjectStatus(
            projectId,
            'GENERATED'
        );


        return getProject(
            projectId
        );

    } catch (error) {

        console.error(
            '[PROJECT GENERATION]',
            error
        );

        updateProjectStatus(
            projectId,
            'FAILED',
            {
                error:
                    error.message
            }
        );

        throw error;
    }
}


/* =======================================================
   END PART 3B
======================================================= */
/* =======================================================
   PART 3C — AUTONOMOUS API ROUTES
======================================================= */

/* -------------------------------------------------------
   HEALTH CHECK
------------------------------------------------------- */

router.get('/health', (req, res) => {

    res.json({
        success: true,
        service: 'SamarthAI Autonomous Engine',
        status: 'online',
        engine: 'autonomous',
        aiConfigured:
            Boolean(GEMINI_API_KEY),
        timestamp: now()
    });

});


/* -------------------------------------------------------
   ANALYZE REQUIREMENT
------------------------------------------------------- */

router.post('/analyze', async (req, res) => {

    try {

        const requirement =
            buildRequirement(
                req.body || {}
            );

        let blueprint = null;

        try {

            blueprint =
                await askGemini(
                    requirement
                );

        } catch (error) {

            console.error(
                '[ANALYZE AI]',
                error.message
            );
        }

        if (!blueprint) {

            blueprint =
                fallbackBlueprint(
                    requirement
                );
        }

        blueprint =
            normalizeBlueprint(
                blueprint,
                requirement
            );

        res.json({

            success: true,

            requirement,

            blueprint

        });

    } catch (error) {

        console.error(
            '[ANALYZE]',
            error
        );

        res.status(500).json({

            success: false,

            error:
                error.message

        });
    }

});


/* -------------------------------------------------------
   GENERATE PROJECT
------------------------------------------------------- */

router.post('/generate', async (req, res) => {

    try {

        const input =
            req.body || {};

        /*
         * कम से कम कोई requirement
         * मौजूद होनी चाहिए।
         */

        if (
            !input.prompt &&
            !input.requirement &&
            !input.description &&
            !input.projectName
        ) {

            return res.status(400).json({

                success: false,

                error:
                    'Please describe the application you want to build.'

            });
        }


        const project =
            await createAutonomousProject(
                input
            );


        res.json({

            success: true,

            projectId:
                project.id,

            projectName:
                project.name,

            slug:
                project.slug,

            status:
                project.status,

            version:
                project.version,

            preview:
                `/api/autonomous/preview/${project.id}`,

            files:
                `/api/autonomous/files/${project.id}`,

            validation:
                `/api/autonomous/validate/${project.id}`,

            readyForPlayStore:
                false,

            message:
                'Project generated successfully.'

        });

    } catch (error) {

        console.error(
            '[AUTONOMOUS GENERATE]',
            error
        );

        res.status(500).json({

            success: false,

            error:
                error.message

        });
    }

});


/* =======================================================
   END PART 3C
======================================================= */
/* =======================================================
   PART 3D — PROJECTS + FILES API
======================================================= */


/* -------------------------------------------------------
   LIST ALL PROJECTS
------------------------------------------------------- */

router.get('/projects', (req, res) => {

    try {

        const projects =
            loadRegistry();

        res.json({

            success: true,

            count:
                projects.length,

            projects

        });

    } catch (error) {

        console.error(
            '[PROJECTS LIST]',
            error
        );

        res.status(500).json({

            success: false,

            error:
                error.message

        });
    }

});


/* -------------------------------------------------------
   GET SINGLE PROJECT
------------------------------------------------------- */

router.get(
    '/project/:id',
    (req, res) => {

        try {

            const project =
                getProject(
                    req.params.id
                );

            if (!project) {

                return res.status(404).json({

                    success: false,

                    error:
                        'Project not found.'

                });
            }


            res.json({

                success: true,

                project

            });

        } catch (error) {

            console.error(
                '[PROJECT DETAILS]',
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });
        }

    }
);


/* -------------------------------------------------------
   COLLECT PROJECT FILES
------------------------------------------------------- */

function collectProjectFiles(
    directory,
    baseDirectory = directory
) {

    if (
        !fs.existsSync(directory)
    ) {
        return [];
    }

    const files = [];

    const items =
        fs.readdirSync(
            directory
        );


    for (
        const item of items
    ) {

        const fullPath =
            path.join(
                directory,
                item
            );

        const stat =
            fs.statSync(
                fullPath
            );


        if (stat.isDirectory()) {

            files.push(
                ...collectProjectFiles(
                    fullPath,
                    baseDirectory
                )
            );

        } else {

            files.push(

                path.relative(
                    baseDirectory,
                    fullPath
                ).replace(
                    /\\/g,
                    '/'
                )

            );
        }
    }

    return files;
}


/* -------------------------------------------------------
   LIST PROJECT FILES
------------------------------------------------------- */

router.get(
    '/files/:id',
    (req, res) => {

        try {

            const project =
                getProject(
                    req.params.id
                );

            if (!project) {

                return res.status(404).json({

                    success: false,

                    error:
                        'Project not found.'

                });
            }


            const directory =
                projectDirectory(
                    project.id
                );


            const files =
                collectProjectFiles(
                    directory
                );


            res.json({

                success: true,

                projectId:
                    project.id,

                projectName:
                    project.name,

                count:
                    files.length,

                files

            });

        } catch (error) {

            console.error(
                '[PROJECT FILES]',
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });
        }

    }
);


/* -------------------------------------------------------
   READ SINGLE PROJECT FILE
------------------------------------------------------- */

router.get(
    '/file/:id',
    (req, res) => {

        try {

            const project =
                getProject(
                    req.params.id
                );

            if (!project) {

                return res.status(404).json({

                    success: false,

                    error:
                        'Project not found.'

                });
            }


            const requestedPath =
                String(
                    req.query.path || ''
                );


            if (!requestedPath) {

                return res.status(400).json({

                    success: false,

                    error:
                        'File path is required.'

                });
            }


            const projectRoot =
                path.resolve(
                    projectDirectory(
                        project.id
                    )
                );


            const absolutePath =
                path.resolve(
                    projectRoot,
                    requestedPath
                );


            /*
             * Security:
             * Project directory से बाहर की
             * file access नहीं होने देंगे।
             */

            if (
                !absolutePath.startsWith(
                    projectRoot +
                    path.sep
                ) &&
                absolutePath !== projectRoot
            ) {

                return res.status(403).json({

                    success: false,

                    error:
                        'Invalid file path.'

                });
            }


            if (
                !fs.existsSync(
                    absolutePath
                )
            ) {

                return res.status(404).json({

                    success: false,

                    error:
                        'File not found.'

                });
            }


            const stat =
                fs.statSync(
                    absolutePath
                );


            if (!stat.isFile()) {

                return res.status(400).json({

                    success: false,

                    error:
                        'Requested path is not a file.'

                });
            }


            const content =
                fs.readFileSync(
                    absolutePath,
                    'utf8'
                );


            res.json({

                success: true,

                projectId:
                    project.id,

                path:
                    requestedPath,

                content

            });

        } catch (error) {

            console.error(
                '[READ PROJECT FILE]',
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });
        }

    }
);


/* =======================================================
   END PART 3D
======================================================= */
/* =======================================================
   PART 3E — PREVIEW ENGINE
======================================================= */


/* -------------------------------------------------------
   DEFAULT PREVIEW
------------------------------------------------------- */

router.get(
    '/preview/:id',
    (req, res) => {

        try {

            const project =
                getProject(
                    req.params.id
                );

            if (!project) {

                return res.status(404).send(
                    'Project not found.'
                );
            }


            const pages =
                project.blueprint?.pages || [];


            const firstPage =
                pages[0] || {
                    name: 'home',
                    title:
                        project.name
                };


            const pageName =
                safeSlug(
                    firstPage.name ||
                    'home'
                );


            res.redirect(
                `/api/autonomous/preview/${project.id}/${pageName}`
            );

        } catch (error) {

            console.error(
                '[PREVIEW]',
                error
            );

            res.status(500).send(
                'Preview error.'
            );
        }
    }
);


/* -------------------------------------------------------
   PREVIEW SPECIFIC PAGE
------------------------------------------------------- */

router.get(
    '/preview/:id/:page',
    (req, res) => {

        try {

            const project =
                getProject(
                    req.params.id
                );

            if (!project) {

                return res.status(404).send(
                    'Project not found.'
                );
            }


            const blueprint =
                project.blueprint;


            const requestedPage =
                safeSlug(
                    req.params.page
                );


            const page =
                (blueprint.pages || []).find(
                    item =>
                        safeSlug(
                            item.name
                        ) === requestedPage
                );


            if (!page) {

                return res.status(404).send(
                    'Page not found.'
                );
            }


            const html =
                generatePageHtml(
                    project,
                    blueprint,
                    page
                );


            res
                .status(200)
                .type('html')
                .send(html);

        } catch (error) {

            console.error(
                '[PREVIEW PAGE]',
                error
            );

            res.status(500).send(
                'Unable to generate preview.'
            );
        }
    }
);


/* -------------------------------------------------------
   PREVIEW ASSETS
------------------------------------------------------- */

router.get(
    '/preview/:id/assets/:asset',
    (req, res) => {

        try {

            const project =
                getProject(
                    req.params.id
                );

            if (!project) {

                return res.status(404).send(
                    'Project not found.'
                );
            }


            const assetName =
                safeFileName(
                    req.params.asset
                );


            /*
             * केवल generated assets directory
             * से files serve होंगी।
             */

            const assetsDirectory =
                path.resolve(
                    projectDirectory(
                        project.id
                    ),
                    'assets'
                );


            const assetPath =
                path.resolve(
                    assetsDirectory,
                    assetName
                );


            /*
             * Path traversal protection
             */

            if (
                !assetPath.startsWith(
                    assetsDirectory +
                    path.sep
                )
            ) {

                return res.status(403).send(
                    'Invalid asset path.'
                );
            }


            if (
                !fs.existsSync(
                    assetPath
                )
            ) {

                return res.status(404).send(
                    'Asset not found.'
                );
            }


            const stat =
                fs.statSync(
                    assetPath
                );


            if (!stat.isFile()) {

                return res.status(400).send(
                    'Invalid asset.'
                );
            }


            if (
                assetName.endsWith('.css')
            ) {

                res.type('css');

            } else if (
                assetName.endsWith('.js')
            ) {

                res.type('js');

            } else if (
                assetName.endsWith('.json')
            ) {

                res.type('json');
            }


            res.send(
                fs.readFileSync(
                    assetPath
                )
            );

        } catch (error) {

            console.error(
                '[PREVIEW ASSET]',
                error
            );

            res.status(500).send(
                'Unable to load asset.'
            );
        }
    }
);


/* =======================================================
   END PART 3E
======================================================= */
/* =======================================================
   PART 3F — RUNTIME CRUD API
======================================================= */


/* -------------------------------------------------------
   GET ENTITY RECORDS
------------------------------------------------------- */

router.get(
    '/runtime/:id/:entity',
    (req, res) => {

        try {

            const project =
                getProject(
                    req.params.id
                );

            if (!project) {

                return res.status(404).json({
                    success: false,
                    error: 'Project not found.'
                });
            }


            const entity =
                findEntityByName(
                    project.blueprint,
                    req.params.entity
                );


            if (!entity) {

                return res.status(404).json({
                    success: false,
                    error: 'Entity not found.'
                });
            }


            const runtime =
                loadRuntime(
                    project.id
                );


            const records =
                runtime.records[
                    entity.name
                ] || [];


            res.json({

                success: true,

                projectId:
                    project.id,

                entity:
                    entity.name,

                count:
                    records.length,

                records

            });

        } catch (error) {

            console.error(
                '[RUNTIME GET]',
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });
        }
    }
);


/* -------------------------------------------------------
   CREATE RECORD
------------------------------------------------------- */

router.post(
    '/runtime/:id/:entity',
    (req, res) => {

        try {

            const project =
                getProject(
                    req.params.id
                );


            if (!project) {

                return res.status(404).json({
                    success: false,
                    error: 'Project not found.'
                });
            }


            const entity =
                findEntityByName(
                    project.blueprint,
                    req.params.entity
                );


            if (!entity) {

                return res.status(404).json({
                    success: false,
                    error: 'Entity not found.'
                });
            }


            const runtime =
                loadRuntime(
                    project.id
                );


            if (
                !runtime.records[
                    entity.name
                ]
            ) {

                runtime.records[
                    entity.name
                ] = [];
            }


            const record =
                normalizeRecord(
                    req.body
                );


            record.id =
                makeRecordId();


            record.createdAt =
                now();


            record.updatedAt =
                now();


            runtime.records[
                entity.name
            ].push(record);


            saveRuntime(
                project.id,
                runtime
            );


            res.status(201).json({

                success: true,

                message:
                    'Record created successfully.',

                record

            });

        } catch (error) {

            console.error(
                '[RUNTIME CREATE]',
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });
        }
    }
);


/* -------------------------------------------------------
   UPDATE RECORD
------------------------------------------------------- */

router.put(
    '/runtime/:id/:entity/:recordId',
    (req, res) => {

        try {

            const project =
                getProject(
                    req.params.id
                );


            if (!project) {

                return res.status(404).json({
                    success: false,
                    error: 'Project not found.'
                });
            }


            const entity =
                findEntityByName(
                    project.blueprint,
                    req.params.entity
                );


            if (!entity) {

                return res.status(404).json({
                    success: false,
                    error: 'Entity not found.'
                });
            }


            const runtime =
                loadRuntime(
                    project.id
                );


            const records =
                runtime.records[
                    entity.name
                ] || [];


            const index =
                records.findIndex(
                    record =>
                        record.id ===
                        req.params.recordId
                );


            if (index === -1) {

                return res.status(404).json({
                    success: false,
                    error: 'Record not found.'
                });
            }


            const updates =
                normalizeRecord(
                    req.body
                );


            records[index] = {

                ...records[index],

                ...updates,

                id:
                    records[index].id,

                createdAt:
                    records[index].createdAt,

                updatedAt:
                    now()

            };


            runtime.records[
                entity.name
            ] = records;


            saveRuntime(
                project.id,
                runtime
            );


            res.json({

                success: true,

                message:
                    'Record updated successfully.',

                record:
                    records[index]

            });

        } catch (error) {

            console.error(
                '[RUNTIME UPDATE]',
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });
        }
    }
);


/* -------------------------------------------------------
   DELETE RECORD
------------------------------------------------------- */

router.delete(
    '/runtime/:id/:entity/:recordId',
    (req, res) => {

        try {

            const project =
                getProject(
                    req.params.id
                );


            if (!project) {

                return res.status(404).json({
                    success: false,
                    error: 'Project not found.'
                });
            }


            const entity =
                findEntityByName(
                    project.blueprint,
                    req.params.entity
                );


            if (!entity) {

                return res.status(404).json({
                    success: false,
                    error: 'Entity not found.'
                });
            }


            const runtime =
                loadRuntime(
                    project.id
                );


            const records =
                runtime.records[
                    entity.name
                ] || [];


            const index =
                records.findIndex(
                    record =>
                        record.id ===
                        req.params.recordId
                );


            if (index === -1) {

                return res.status(404).json({
                    success: false,
                    error: 'Record not found.'
                });
            }


            const deleted =
                records.splice(
                    index,
                    1
                )[0];


            runtime.records[
                entity.name
            ] = records;


            saveRuntime(
                project.id,
                runtime
            );


            res.json({

                success: true,

                message:
                    'Record deleted successfully.',

                deleted

            });

        } catch (error) {

            console.error(
                '[RUNTIME DELETE]',
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });
        }
    }
);


/* =======================================================
   END PART 3F
======================================================= */
/* =======================================================
   PART 3G — VALIDATION + BUILD CHECK
======================================================= */


/* -------------------------------------------------------
   VALIDATE PROJECT
------------------------------------------------------- */

router.get(
    '/validate/:id',
    (req, res) => {

        try {

            const project =
                getProject(
                    req.params.id
                );

            if (!project) {

                return res.status(404).json({
                    success: false,
                    error: 'Project not found.'
                });
            }


            const directory =
                projectDirectory(
                    project.id
                );


            const files =
                collectProjectFiles(
                    directory
                );


            const requiredFiles = [
                'index.html',
                'assets/style.css',
                'assets/app.js',
                'metadata.json',
                'manifest.json',
                'blueprint.json',
                'README.md'
            ];


            const missing =
                requiredFiles.filter(
                    file =>
                        !files.includes(file)
                );


            const errors = [];


            if (missing.length > 0) {

                for (
                    const file of missing
                ) {

                    errors.push(
                        `Missing required file: ${file}`
                    );
                }
            }


            /*
             * Blueprint validation
             */

            if (
                !project.blueprint
            ) {

                errors.push(
                    'Blueprint is missing.'
                );
            }


            if (
                project.blueprint &&
                !Array.isArray(
                    project.blueprint.pages
                )
            ) {

                errors.push(
                    'Blueprint pages are invalid.'
                );
            }


            if (
                project.blueprint &&
                !Array.isArray(
                    project.blueprint.entities
                )
            ) {

                errors.push(
                    'Blueprint entities are invalid.'
                );
            }


            const valid =
                errors.length === 0;


            updateProjectStatus(
                project.id,
                valid
                    ? 'VALIDATED'
                    : 'VALIDATION_FAILED'
            );


            res.json({

                success: true,

                projectId:
                    project.id,

                valid,

                status:
                    valid
                        ? 'VALIDATED'
                        : 'VALIDATION_FAILED',

                files,

                requiredFiles,

                missing,

                errors,

                checkedAt:
                    now()

            });

        } catch (error) {

            console.error(
                '[VALIDATION]',
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });
        }
    }
);


/* -------------------------------------------------------
   BUILD CHECK
------------------------------------------------------- */

router.post(
    '/build/:id',
    (req, res) => {

        try {

            const project =
                getProject(
                    req.params.id
                );


            if (!project) {

                return res.status(404).json({

                    success: false,

                    error:
                        'Project not found.'

                });
            }


            const directory =
                projectDirectory(
                    project.id
                );


            const files =
                collectProjectFiles(
                    directory
                );


            const requiredFiles = [
                'index.html',
                'assets/style.css',
                'assets/app.js',
                'metadata.json',
                'manifest.json',
                'blueprint.json'
            ];


            const missing =
                requiredFiles.filter(
                    file =>
                        !files.includes(file)
                );


            const buildPassed =
                missing.length === 0;


            if (buildPassed) {

                updateProjectStatus(
                    project.id,
                    'BUILD_CHECK_PASSED'
                );

            } else {

                updateProjectStatus(
                    project.id,
                    'BUILD_CHECK_FAILED'
                );
            }


            res.json({

                success: true,

                projectId:
                    project.id,

                projectName:
                    project.name,

                buildCheck:
                    buildPassed
                        ? 'PASSED'
                        : 'FAILED',

                missing,

                files,

                /*
                 * अभी Android compiler
                 * execute नहीं किया गया है।
                 */

                androidBuild:
                    'NOT_RUN',

                apk:
                    null,

                aab:
                    null,

                readyForPlayStore:
                    false,

                message:
                    buildPassed
                        ? 'Web project build check passed. Android APK/AAB requires the real Android build pipeline.'
                        : 'Build check failed because required files are missing.'

            });

        } catch (error) {

            console.error(
                '[BUILD CHECK]',
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });
        }
    }
);


/* -------------------------------------------------------
   ROUTE INFORMATION
------------------------------------------------------- */

router.get(
    '/routes',
    (req, res) => {

        res.json({

            success: true,

            routes: [

                'GET  /health',

                'POST /analyze',

                'POST /generate',

                'POST /generate-project',

                'GET  /projects',

                'GET  /project/:id',

                'GET  /files/:id',

                'GET  /file/:id?path=...',

                'GET  /preview/:id',

                'GET  /preview/:id/:page',

                'GET  /preview/:id/assets/:asset',

                'GET  /runtime/:id/:entity',

                'POST /runtime/:id/:entity',

                'PUT  /runtime/:id/:entity/:recordId',

                'DELETE /runtime/:id/:entity/:recordId',

                'GET  /validate/:id',

                'POST /build/:id'

            ]

        });

    }
);


/* =======================================================
   END PART 3G
======================================================= */

/* =======================================================
   PART 4A — VERSION BACKUP + PROJECT HISTORY
======================================================= */

function versionsDirectory(projectId) {
    return path.join(projectDirectory(projectId), '.versions');
}

function versionDirectory(projectId, version) {
    return path.join(
        versionsDirectory(projectId),
        `v${version}`
    );
}

function copyDirectorySync(source, destination) {
    if (!fs.existsSync(source)) {
        return;
    }

    ensureDir(destination);

    const entries = fs.readdirSync(source, {
        withFileTypes: true
    });

    for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const destinationPath = path.join(destination, entry.name);

        if (entry.isDirectory()) {
            copyDirectorySync(sourcePath, destinationPath);
        } else {
            fs.copyFileSync(sourcePath, destinationPath);
        }
    }
}

function createProjectBackup(projectId) {
    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const currentVersion = Number(project.version || 1);

    const sourceDir = projectDirectory(projectId);
    const backupDir = versionDirectory(
        projectId,
        currentVersion
    );

    ensureDir(versionsDirectory(projectId));

    if (fs.existsSync(backupDir)) {
        return backupDir;
    }

    ensureDir(backupDir);

    const entries = fs.readdirSync(sourceDir, {
        withFileTypes: true
    });

    for (const entry of entries) {
        if (entry.name === '.versions') {
            continue;
        }

        const sourcePath = path.join(
            sourceDir,
            entry.name
        );

        const destinationPath = path.join(
            backupDir,
            entry.name
        );

        if (entry.isDirectory()) {
            copyDirectorySync(
                sourcePath,
                destinationPath
            );
        } else {
            fs.copyFileSync(
                sourcePath,
                destinationPath
            );
        }
    }

    return backupDir;
}

function getProjectHistory(projectId) {
    const dir = versionsDirectory(projectId);

    if (!fs.existsSync(dir)) {
        return [];
    }

    return fs.readdirSync(dir)
        .filter(name => /^v\d+$/.test(name))
        .map(name => ({
            version: Number(
                name.substring(1)
            ),
            directory: name
        }))
        .sort((a, b) => b.version - a.version);
}

function restoreProjectVersion(projectId, version) {
    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const backupDir = versionDirectory(
        projectId,
        version
    );

    if (!fs.existsSync(backupDir)) {
        throw new Error(
            `Version v${version} not found`
        );
    }

    const currentDir = projectDirectory(projectId);

    const entries = fs.readdirSync(currentDir, {
        withFileTypes: true
    });

    for (const entry of entries) {
        if (entry.name === '.versions') {
            continue;
        }

        const targetPath = path.join(
            currentDir,
            entry.name
        );

        if (entry.isDirectory()) {
            fs.rmSync(targetPath, {
                recursive: true,
                force: true
            });
        } else {
            fs.unlinkSync(targetPath);
        }
    }

    copyDirectorySync(
        backupDir,
        currentDir
    );

    project.version = Number(version);
    project.status = 'RESTORED';
    project.updatedAt = now();

    registerProject(project);

    return project;
}

function incrementProjectVersion(projectId) {
    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    project.version =
        Number(project.version || 1) + 1;

    project.updatedAt = now();

    registerProject(project);

    return project.version;
}

/* =======================================================
   END PART 4A
======================================================= */
/* =======================================================
   PART 4B — AI UPDATE PLAN
======================================================= */

function buildUpdateSystemPrompt() {
    return `
You are the software update planner for SamarthAI.

Your job is to understand a user's requested change
and convert it into a SAFE structured update plan.

IMPORTANT RULES:

1. Never invent files that are not needed.
2. Do not delete existing features unless the user asks.
3. Preserve existing project functionality.
4. Preserve existing database/runtime data.
5. Prefer modifying existing files over creating duplicates.
6. Keep changes limited to the user's request.
7. Return ONLY valid JSON.
8. Do not return markdown.
9. Do not return explanations outside JSON.

Return this exact structure:

{
  "summary": "short description",
  "changes": [
    {
      "type": "modify|create|delete",
      "file": "relative/path",
      "reason": "why this file changes",
      "instructions": "exact implementation instructions"
    }
  ],
  "blueprintChanges": {
    "pagesToAdd": [],
    "pagesToRemove": [],
    "featuresToAdd": [],
    "featuresToRemove": [],
    "entitiesToAdd": [],
    "entitiesToRemove": []
  }
}

Safety:

- Never use absolute paths.
- Never use ../
- Never modify files outside the project.
- Never expose secrets or API keys.
`;
}

function buildUpdateUserPrompt(project, instruction) {
    const blueprint = project.blueprint || {};

    return `
CURRENT PROJECT:

Project ID:
${project.id}

Project Name:
${project.name}

Current Version:
${project.version}

Current Blueprint:
${JSON.stringify(blueprint, null, 2)}

USER REQUEST:

${cleanText(instruction)}

Create a safe update plan.

Return ONLY JSON.
`;
}

async function createAIUpdatePlan(project, instruction) {
    if (!instruction || !String(instruction).trim()) {
        throw new Error(
            'Update instruction is required'
        );
    }

    if (!GEMINI_API_KEY) {
        return createFallbackUpdatePlan(
            project,
            instruction
        );
    }

    try {
        const systemPrompt =
            buildUpdateSystemPrompt();

        const userPrompt =
            buildUpdateUserPrompt(
                project,
                instruction
            );

        const result = await askGemini(
            systemPrompt,
            userPrompt
        );

        const plan = parseAIJson(result);

        return normalizeUpdatePlan(
            plan,
            instruction
        );

    } catch (error) {
        console.error(
            '[AI UPDATE PLAN ERROR]',
            error.message
        );

        return createFallbackUpdatePlan(
            project,
            instruction
        );
    }
}

function normalizeUpdatePlan(plan, instruction) {
    const safePlan =
        plan && typeof plan === 'object'
            ? plan
            : {};

    let changes =
        Array.isArray(safePlan.changes)
            ? safePlan.changes
            : [];

    changes = changes
        .filter(item =>
            item &&
            typeof item === 'object'
        )
        .map(item => ({
            type:
                ['modify', 'create', 'delete']
                    .includes(item.type)
                    ? item.type
                    : 'modify',

            file: safeFileName(
                String(item.file || '')
            ),

            reason:
                cleanText(
                    item.reason || ''
                ),

            instructions:
                cleanText(
                    item.instructions || ''
                )
        }))
        .filter(item =>
            item.file &&
            item.instructions
        );

    const blueprintChanges =
        safePlan.blueprintChanges &&
        typeof safePlan.blueprintChanges === 'object'
            ? safePlan.blueprintChanges
            : {};

    return {
        summary:
            cleanText(
                safePlan.summary ||
                instruction
            ),

        changes,

        blueprintChanges: {
            pagesToAdd:
                Array.isArray(
                    blueprintChanges.pagesToAdd
                )
                    ? blueprintChanges.pagesToAdd
                    : [],

            pagesToRemove:
                Array.isArray(
                    blueprintChanges.pagesToRemove
                )
                    ? blueprintChanges.pagesToRemove
                    : [],

            featuresToAdd:
                Array.isArray(
                    blueprintChanges.featuresToAdd
                )
                    ? blueprintChanges.featuresToAdd
                    : [],

            featuresToRemove:
                Array.isArray(
                    blueprintChanges.featuresToRemove
                )
                    ? blueprintChanges.featuresToRemove
                    : [],

            entitiesToAdd:
                Array.isArray(
                    blueprintChanges.entitiesToAdd
                )
                    ? blueprintChanges.entitiesToAdd
                    : [],

            entitiesToRemove:
                Array.isArray(
                    blueprintChanges.entitiesToRemove
                )
                    ? blueprintChanges.entitiesToRemove
                    : []
        }
    };
}

function createFallbackUpdatePlan(
    project,
    instruction
) {
    const text =
        String(instruction)
            .toLowerCase();

    const changes = [];

    if (
        text.includes('color') ||
        text.includes('colour') ||
        text.includes('blue') ||
        text.includes('red') ||
        text.includes('green')
    ) {
        changes.push({
            type: 'modify',
            file: 'assets/style.css',
            reason:
                'User requested a visual color change.',
            instructions:
                `Update the project theme/colors according to this request: ${instruction}`
        });
    }

    if (
        text.includes('title') ||
        text.includes('heading') ||
        text.includes('name')
    ) {
        changes.push({
            type: 'modify',
            file: 'index.html',
            reason:
                'User requested a text/title change.',
            instructions:
                `Update the relevant title or heading according to: ${instruction}`
        });
    }

    if (changes.length === 0) {
        changes.push({
            type: 'modify',
            file: 'index.html',
            reason:
                'Fallback update for user request.',
            instructions:
                `Apply this requested change while preserving all existing functionality: ${instruction}`
        });
    }

    return {
        summary: instruction,

        changes,

        blueprintChanges: {
            pagesToAdd: [],
            pagesToRemove: [],
            featuresToAdd: [],
            featuresToRemove: [],
            entitiesToAdd: [],
            entitiesToRemove: []
        }
    };
}

/* =======================================================
   END PART 4B
======================================================= */
/* =======================================================
   PART 4C — SAFE UPDATE FILE ENGINE
======================================================= */

function isSafeProjectPath(filePath) {
    if (!filePath) {
        return false;
    }

    const normalized = String(filePath)
        .replace(/\\/g, '/')
        .replace(/^\/+/, '');

    if (
        normalized.includes('../') ||
        normalized.includes('..\\') ||
        normalized.startsWith('..')
    ) {
        return false;
    }

    if (
        normalized.includes('\0') ||
        path.isAbsolute(normalized)
    ) {
        return false;
    }

    return true;
}

function resolveProjectFile(projectId, filePath) {
    if (!isSafeProjectPath(filePath)) {
        throw new Error(
            'Unsafe project file path'
        );
    }

    const projectDir =
        path.resolve(
            projectDirectory(projectId)
        );

    const targetPath =
        path.resolve(
            projectDir,
            filePath
        );

    if (
        targetPath !== projectDir &&
        !targetPath.startsWith(
            projectDir + path.sep
        )
    ) {
        throw new Error(
            'File is outside project directory'
        );
    }

    return targetPath;
}

function readProjectFile(projectId, filePath) {
    const targetPath =
        resolveProjectFile(
            projectId,
            filePath
        );

    if (!fs.existsSync(targetPath)) {
        return null;
    }

    const stat =
        fs.statSync(targetPath);

    if (!stat.isFile()) {
        return null;
    }

    return fs.readFileSync(
        targetPath,
        'utf8'
    );
}

function writeProjectFile(
    projectId,
    filePath,
    content
) {
    const targetPath =
        resolveProjectFile(
            projectId,
            filePath
        );

    ensureDir(
        path.dirname(targetPath)
    );

    fs.writeFileSync(
        targetPath,
        String(content),
        'utf8'
    );

    return targetPath;
}

function deleteProjectFile(
    projectId,
    filePath
) {
    const targetPath =
        resolveProjectFile(
            projectId,
            filePath
        );

    if (!fs.existsSync(targetPath)) {
        return false;
    }

    const stat =
        fs.statSync(targetPath);

    if (stat.isDirectory()) {
        throw new Error(
            'Directory deletion is not allowed'
        );
    }

    fs.unlinkSync(targetPath);

    return true;
}

function validateUpdateChange(change) {
    if (
        !change ||
        typeof change !== 'object'
    ) {
        return {
            valid: false,
            reason: 'Invalid change object'
        };
    }

    const allowedTypes = [
        'modify',
        'create',
        'delete'
    ];

    if (
        !allowedTypes.includes(
            change.type
        )
    ) {
        return {
            valid: false,
            reason: 'Invalid change type'
        };
    }

    if (
        !change.file ||
        !isSafeProjectPath(
            change.file
        )
    ) {
        return {
            valid: false,
            reason: 'Invalid file path'
        };
    }

    return {
        valid: true
    };
}

async function generateUpdatedFile(
    project,
    change,
    currentContent
) {
    if (!GEMINI_API_KEY) {
        return fallbackFileUpdate(
            project,
            change,
            currentContent
        );
    }

    const systemPrompt = `
You are the code modification engine
for SamarthAI.

Modify ONLY the requested file.

Rules:

1. Preserve existing functionality.
2. Do not remove unrelated features.
3. Do not add fake functionality.
4. Do not add API keys or secrets.
5. Do not use absolute paths.
6. Do not use ../ paths.
7. Return ONLY the complete file content.
8. Do not use markdown code fences.
9. Keep valid syntax.
`;

    const userPrompt = `
PROJECT:
${project.name}

USER REQUEST:
${change.instructions}

FILE:
${change.file}

REASON:
${change.reason}

CURRENT FILE CONTENT:
${currentContent || '(file does not exist)'}

Return the complete updated file content only.
`;

    try {
        const result =
            await askGemini(
                systemPrompt,
                userPrompt
            );

        return String(result || '')
            .replace(/^```[a-zA-Z0-9_-]*\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

    } catch (error) {
        console.error(
            '[FILE UPDATE ERROR]',
            error.message
        );

        return fallbackFileUpdate(
            project,
            change,
            currentContent
        );
    }
}

function fallbackFileUpdate(
    project,
    change,
    currentContent
) {
    const content =
        String(currentContent || '');

    const instruction =
        String(
            change.instructions || ''
        ).toLowerCase();

    if (
        change.file.endsWith(
            'style.css'
        )
    ) {
        if (
            instruction.includes('blue')
        ) {
            return content
                .replace(
                    /#FF6B00/gi,
                    '#003366'
                )
                .replace(
                    /#ff6b00/gi,
                    '#003366'
                );
        }
    }

    return content;
}

/* =======================================================
   END PART 4C
======================================================= */
/* =======================================================
   PART 4D — APPLY UPDATE + ROLLBACK
======================================================= */

async function applyUpdatePlan(projectId, plan) {
    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    if (
        !plan ||
        !Array.isArray(plan.changes)
    ) {
        throw new Error(
            'Invalid update plan'
        );
    }

    // पहले current version का backup
    createProjectBackup(projectId);

    const results = [];

    try {
        for (const change of plan.changes) {

            const check =
                validateUpdateChange(change);

            if (!check.valid) {
                throw new Error(
                    check.reason
                );
            }

            const filePath =
                change.file;

            const oldContent =
                readProjectFile(
                    projectId,
                    filePath
                );

            // DELETE
            if (change.type === 'delete') {

                if (oldContent !== null) {
                    deleteProjectFile(
                        projectId,
                        filePath
                    );
                }

                results.push({
                    file: filePath,
                    type: 'delete',
                    status: 'APPLIED'
                });

                continue;
            }

            // CREATE / MODIFY
            const newContent =
                await generateUpdatedFile(
                    project,
                    change,
                    oldContent
                );

            if (
                typeof newContent !== 'string' ||
                !newContent.trim()
            ) {
                throw new Error(
                    `AI returned empty content for ${filePath}`
                );
            }

            writeProjectFile(
                projectId,
                filePath,
                newContent
            );

            results.push({
                file: filePath,
                type: change.type,
                status: 'APPLIED'
            });
        }

        return {
            success: true,
            results
        };

    } catch (error) {

        console.error(
            '[UPDATE FAILED]',
            error.message
        );

        // बदलाव असफल हुआ तो पुराने version पर वापस
        const currentVersion =
            Number(
                project.version || 1
            );

        try {
            restoreProjectVersion(
                projectId,
                currentVersion
            );
        } catch (rollbackError) {
            console.error(
                '[ROLLBACK FAILED]',
                rollbackError.message
            );
        }

        throw new Error(
            `Update failed and rollback attempted: ${error.message}`
        );
    }
}

function applyBlueprintChanges(
    blueprint,
    blueprintChanges
) {
    if (
        !blueprint ||
        typeof blueprint !== 'object'
    ) {
        return blueprint;
    }

    if (
        !blueprintChanges ||
        typeof blueprintChanges !== 'object'
    ) {
        return blueprint;
    }

    const result =
        JSON.parse(
            JSON.stringify(blueprint)
        );

    if (!Array.isArray(result.pages)) {
        result.pages = [];
    }

    if (!Array.isArray(result.features)) {
        result.features = [];
    }

    if (!Array.isArray(result.entities)) {
        result.entities = [];
    }

    // Pages add
    for (
        const page of
        blueprintChanges.pagesToAdd || []
    ) {
        if (
            page &&
            !result.pages.some(
                p =>
                    JSON.stringify(p) ===
                    JSON.stringify(page)
            )
        ) {
            result.pages.push(page);
        }
    }

    // Pages remove
    for (
        const page of
        blueprintChanges.pagesToRemove || []
    ) {
        result.pages =
            result.pages.filter(
                p =>
                    String(
                        typeof p === 'string'
                            ? p
                            : p.name || p.slug || ''
                    ).toLowerCase() !==
                    String(page).toLowerCase()
            );
    }

    // Features add
    for (
        const feature of
        blueprintChanges.featuresToAdd || []
    ) {
        if (
            feature &&
            !result.features.some(
                f =>
                    String(f).toLowerCase() ===
                    String(feature).toLowerCase()
            )
        ) {
            result.features.push(feature);
        }
    }

    // Features remove
    for (
        const feature of
        blueprintChanges.featuresToRemove || []
    ) {
        result.features =
            result.features.filter(
                f =>
                    String(f).toLowerCase() !==
                    String(feature).toLowerCase()
            );
    }

    // Entities add
    for (
        const entity of
        blueprintChanges.entitiesToAdd || []
    ) {
        if (
            entity &&
            !result.entities.some(
                e =>
                    JSON.stringify(e) ===
                    JSON.stringify(entity)
            )
        ) {
            result.entities.push(entity);
        }
    }

    // Entities remove
    for (
        const entity of
        blueprintChanges.entitiesToRemove || []
    ) {
        result.entities =
            result.entities.filter(
                e =>
                    String(
                        typeof e === 'string'
                            ? e
                            : e.name || ''
                    ).toLowerCase() !==
                    String(entity).toLowerCase()
            );
    }

    return result;
}

function regenerateProjectAfterBlueprintUpdate(
    project
) {
    if (!project.blueprint) {
        return;
    }

    writeGeneratedProject(
        project,
        project.blueprint
    );
}

async function updateAutonomousProject(
    projectId,
    instruction
) {
    const project =
        getProject(projectId);

    if (!project) {
        throw new Error(
            'Project not found'
        );
    }

    if (
        !instruction ||
        !String(instruction).trim()
    ) {
        throw new Error(
            'Update instruction is required'
        );
    }

    project.status =
        'UPDATING';

    project.updatedAt = now();

    registerProject(project);

    try {

        // AI से update plan
        const plan =
            await createAIUpdatePlan(
                project,
                instruction
            );

        // Blueprint changes पहले apply करें
        project.blueprint =
            applyBlueprintChanges(
                project.blueprint,
                plan.blueprintChanges
            );

        // Files update करें
        const updateResult =
            await applyUpdatePlan(
                projectId,
                plan
            );

        // Version बढ़ाएँ
        const newVersion =
            incrementProjectVersion(
                projectId
            );

        // Updated project object
        project.version =
            newVersion;

        project.status =
            'UPDATED';

        project.updatedAt =
            now();

        project.lastUpdate = {
            summary: plan.summary,
            instruction,
            changes: plan.changes,
            results:
                updateResult.results,
            updatedAt: now()
        };

        registerProject(project);

        return {
            success: true,
            project,
            plan,
            version: newVersion,
            results:
                updateResult.results
        };

    } catch (error) {

        project.status =
            'UPDATE_FAILED';

        project.updatedAt =
            now();

        project.lastUpdateError =
            error.message;

        registerProject(project);

        throw error;
    }
}

/* =======================================================
   END PART 4D
======================================================= */
/* =======================================================
   PART 4E — PROJECT UPDATE API
======================================================= */

router.post('/update/:id', async (req, res) => {
    try {
        const projectId = req.params.id;

        const instruction =
            req.body?.prompt ||
            req.body?.instruction ||
            req.body?.change ||
            req.body?.request;

        if (
            !instruction ||
            !String(instruction).trim()
        ) {
            return res.status(400).json({
                success: false,
                error:
                    'Update instruction is required.'
            });
        }

        const project =
            getProject(projectId);

        if (!project) {
            return res.status(404).json({
                success: false,
                error:
                    'Project not found.'
            });
        }

        const result =
            await updateAutonomousProject(
                projectId,
                String(instruction).trim()
            );

        return res.json({
            success: true,

            message:
                'Project updated successfully.',

            projectId:
                result.project.id,

            projectName:
                result.project.name,

            version:
                result.version,

            status:
                result.project.status,

            summary:
                result.plan.summary,

            changes:
                result.plan.changes,

            results:
                result.results,

            preview:
                `/api/autonomous/preview/${result.project.id}`,

            validation:
                `/api/autonomous/validate/${result.project.id}`,

            readyForPlayStore:
                false
        });

    } catch (error) {

        console.error(
            '[PROJECT UPDATE API ERROR]',
            error
        );

        return res.status(500).json({
            success: false,

            error:
                error.message ||
                'Project update failed.',

            rollback:
                'Rollback was attempted.'
        });
    }
});


/* =======================================================
   PART 4E — PROJECT HISTORY API
======================================================= */

router.get('/history/:id', (req, res) => {
    try {
        const projectId =
            req.params.id;

        const project =
            getProject(projectId);

        if (!project) {
            return res.status(404).json({
                success: false,
                error:
                    'Project not found.'
            });
        }

        const history =
            getProjectHistory(projectId);

        return res.json({
            success: true,

            projectId,

            currentVersion:
                Number(
                    project.version || 1
                ),

            history
        });

    } catch (error) {

        console.error(
            '[PROJECT HISTORY ERROR]',
            error
        );

        return res.status(500).json({
            success: false,
            error:
                error.message ||
                'Unable to load project history.'
        });
    }
});


/* =======================================================
   END PART 4E
======================================================= */
/* =======================================================
   PART 4F — PROJECT ROLLBACK API
======================================================= */

router.post('/rollback/:id/:version', (req, res) => {
    try {
        const projectId =
            req.params.id;

        const version =
            Number(req.params.version);

        if (
            !Number.isInteger(version) ||
            version < 1
        ) {
            return res.status(400).json({
                success: false,
                error:
                    'Invalid version number.'
            });
        }

        const project =
            getProject(projectId);

        if (!project) {
            return res.status(404).json({
                success: false,
                error:
                    'Project not found.'
            });
        }

        const history =
            getProjectHistory(projectId);

        const versionExists =
            history.some(
                item =>
                    item.version === version
            );

        if (!versionExists) {
            return res.status(404).json({
                success: false,
                error:
                    `Version v${version} not found.`
            });
        }

        const restoredProject =
            restoreProjectVersion(
                projectId,
                version
            );

        return res.json({
            success: true,

            message:
                `Project restored to version v${version}.`,

            projectId:
                restoredProject.id,

            projectName:
                restoredProject.name,

            version:
                restoredProject.version,

            status:
                restoredProject.status,

            preview:
                `/api/autonomous/preview/${restoredProject.id}`,

            validation:
                `/api/autonomous/validate/${restoredProject.id}`,

            readyForPlayStore:
                false
        });

    } catch (error) {

        console.error(
            '[PROJECT ROLLBACK ERROR]',
            error
        );

        return res.status(500).json({
            success: false,
            error:
                error.message ||
                'Rollback failed.'
        });
    }
});


/* =======================================================
   PART 4F — VERSION DETAILS API
======================================================= */

router.get(
    '/history/:id/:version',
    (req, res) => {
        try {
            const projectId =
                req.params.id;

            const version =
                Number(req.params.version);

            const project =
                getProject(projectId);

            if (!project) {
                return res.status(404).json({
                    success: false,
                    error:
                        'Project not found.'
                });
            }

            if (
                !Number.isInteger(version) ||
                version < 1
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        'Invalid version number.'
                });
            }

            const history =
                getProjectHistory(projectId);

            const found =
                history.find(
                    item =>
                        item.version === version
                );

            if (!found) {
                return res.status(404).json({
                    success: false,
                    error:
                        `Version v${version} not found.`
                });
            }

            const dir =
                versionDirectory(
                    projectId,
                    version
                );

            const files =
                collectProjectFiles(
                    dir,
                    dir
                );

            return res.json({
                success: true,

                projectId,

                version,

                files
            });

        } catch (error) {

            console.error(
                '[VERSION DETAILS ERROR]',
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    error.message ||
                    'Unable to load version.'
            });
        }
    }
);


/* =======================================================
   END PART 4F
======================================================= */
/* =======================================================
   PART 4G — AUTOMATIC SELF-CHECK ENGINE
======================================================= */

function checkJavaScriptSyntax(filePath) {
    try {
        const content =
            fs.readFileSync(
                filePath,
                'utf8'
            );

        new Function(content);

        return {
            valid: true,
            error: null
        };

    } catch (error) {

        return {
            valid: false,
            error: error.message
        };
    }
}

function checkJsonSyntax(filePath) {
    try {
        const content =
            fs.readFileSync(
                filePath,
                'utf8'
            );

        JSON.parse(content);

        return {
            valid: true,
            error: null
        };

    } catch (error) {

        return {
            valid: false,
            error: error.message
        };
    }
}

function checkHtmlBasic(filePath) {
    try {
        const content =
            fs.readFileSync(
                filePath,
                'utf8'
            );

        const lower =
            content.toLowerCase();

        const hasHtml =
            lower.includes('<html');

        const hasBody =
            lower.includes('<body');

        const hasClosingHtml =
            lower.includes('</html>');

        return {
            valid:
                hasHtml &&
                hasBody &&
                hasClosingHtml,

            error:
                hasHtml &&
                hasBody &&
                hasClosingHtml
                    ? null
                    : 'Basic HTML structure is incomplete.'
        };

    } catch (error) {

        return {
            valid: false,
            error: error.message
        };
    }
}

function runProjectSelfCheck(projectId) {
    const project =
        getProject(projectId);

    if (!project) {
        throw new Error(
            'Project not found'
        );
    }

    const projectDir =
        projectDirectory(projectId);

    const results = [];

    function scanDirectory(
        directory
    ) {
        if (!fs.existsSync(directory)) {
            return;
        }

        const entries =
            fs.readdirSync(
                directory,
                {
                    withFileTypes: true
                }
            );

        for (const entry of entries) {

            // Version backups को scan नहीं करना
            if (
                entry.name === '.versions'
            ) {
                continue;
            }

            const fullPath =
                path.join(
                    directory,
                    entry.name
                );

            if (entry.isDirectory()) {
                scanDirectory(fullPath);
                continue;
            }

            const relativePath =
                path.relative(
                    projectDir,
                    fullPath
                ).replace(/\\/g, '/');

            const extension =
                path.extname(
                    entry.name
                ).toLowerCase();

            let check = {
                valid: true,
                error: null
            };

            if (extension === '.js') {
                check =
                    checkJavaScriptSyntax(
                        fullPath
                    );
            }

            if (extension === '.json') {
                check =
                    checkJsonSyntax(
                        fullPath
                    );
            }

            if (extension === '.html') {
                check =
                    checkHtmlBasic(
                        fullPath
                    );
            }

            results.push({
                file: relativePath,
                type: extension,
                valid: check.valid,
                error: check.error
            });
        }
    }

    scanDirectory(projectDir);

    const failed =
        results.filter(
            item => !item.valid
        );

    const passed =
        results.filter(
            item => item.valid
        );

    return {
        success:
            failed.length === 0,

        projectId,

        projectName:
            project.name,

        checkedFiles:
            results.length,

        passedFiles:
            passed.length,

        failedFiles:
            failed.length,

        results,

        checkedAt: now()
    };
}

async function validateAfterUpdate(
    projectId
) {
    const validation =
        runProjectSelfCheck(
            projectId
        );

    const project =
        getProject(projectId);

    if (!project) {
        throw new Error(
            'Project not found'
        );
    }

    project.lastValidation =
        validation;

    project.updatedAt =
        now();

    if (validation.success) {

        project.status =
            'VALIDATED';

    } else {

        project.status =
            'VALIDATION_FAILED';
    }

    registerProject(project);

    return validation;
}


/* =======================================================
   PART 4G — SELF-CHECK API
======================================================= */

router.get(
    '/self-check/:id',
    async (req, res) => {

        try {

            const projectId =
                req.params.id;

            const project =
                getProject(projectId);

            if (!project) {
                return res.status(404).json({
                    success: false,
                    error:
                        'Project not found.'
                });
            }

            const validation =
                await validateAfterUpdate(
                    projectId
                );

            return res.json({
                success:
                    validation.success,

                projectId,

                projectName:
                    project.name,

                status:
                    project.status,

                checkedFiles:
                    validation.checkedFiles,

                passedFiles:
                    validation.passedFiles,

                failedFiles:
                    validation.failedFiles,

                results:
                    validation.results,

                checkedAt:
                    validation.checkedAt
            });

        } catch (error) {

            console.error(
                '[SELF CHECK ERROR]',
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    error.message ||
                    'Self-check failed.'
            });
        }
    }
);


/* =======================================================
   END PART 4G
======================================================= */
/* =======================================================
   PART 4H — AUTOMATIC SELF-HEALING UPDATE
======================================================= */

async function performSelfHealingUpdate(
    projectId,
    instruction
) {
    const project =
        getProject(projectId);

    if (!project) {
        throw new Error(
            'Project not found'
        );
    }

    const oldVersion =
        Number(project.version || 1);

    try {

        // 1. Update शुरू होने से पहले backup
        createProjectBackup(projectId);

        // 2. AI update लागू करें
        const updateResult =
            await updateAutonomousProject(
                projectId,
                instruction
            );

        // 3. Update के बाद automatic self-check
        const validation =
            await validateAfterUpdate(
                projectId
            );

        // 4. अगर सब सही है
        if (validation.success) {

            const updatedProject =
                getProject(projectId);

            if (updatedProject) {
                updatedProject.status =
                    'SELF_HEALED';

                updatedProject.selfHealing = {
                    success: true,
                    rolledBack: false,
                    oldVersion,
                    newVersion:
                        Number(
                            updatedProject.version
                        ),
                    checkedFiles:
                        validation.checkedFiles,
                    failedFiles:
                        validation.failedFiles,
                    completedAt: now()
                };

                registerProject(
                    updatedProject
                );
            }

            return {
                success: true,

                healed: true,

                rolledBack: false,

                oldVersion,

                newVersion:
                    Number(
                        updateResult.version
                    ),

                validation
            };
        }

        // 5. Validation fail होने पर rollback
        restoreProjectVersion(
            projectId,
            oldVersion
        );

        const rolledBackProject =
            getProject(projectId);

        if (rolledBackProject) {

            rolledBackProject.status =
                'ROLLED_BACK_AFTER_FAILED_UPDATE';

            rolledBackProject.selfHealing = {
                success: false,
                rolledBack: true,
                oldVersion,
                failedVersion:
                    Number(
                        updateResult.version
                    ),
                reason:
                    'Automatic validation failed.',
                completedAt: now()
            };

            registerProject(
                rolledBackProject
            );
        }

        return {
            success: false,

            healed: false,

            rolledBack: true,

            oldVersion,

            failedVersion:
                Number(
                    updateResult.version
                ),

            validation
        };

    } catch (error) {

        console.error(
            '[SELF HEALING ERROR]',
            error.message
        );

        // किसी भी unexpected error पर
        // पुराने version को restore करने की कोशिश
        try {

            restoreProjectVersion(
                projectId,
                oldVersion
            );

        } catch (rollbackError) {

            console.error(
                '[SELF HEALING ROLLBACK ERROR]',
                rollbackError.message
            );
        }

        const failedProject =
            getProject(projectId);

        if (failedProject) {

            failedProject.status =
                'SELF_HEALING_FAILED';

            failedProject.selfHealing = {
                success: false,
                rolledBack: true,
                oldVersion,
                error:
                    error.message,
                completedAt: now()
            };

            registerProject(
                failedProject
            );
        }

        throw error;
    }
}


/* =======================================================
   PART 4H — SELF-HEALING API
======================================================= */

router.post(
    '/self-heal/:id',
    async (req, res) => {

        try {

            const projectId =
                req.params.id;

            const instruction =
                req.body?.prompt ||
                req.body?.instruction ||
                req.body?.change ||
                req.body?.request;

            if (
                !instruction ||
                !String(instruction).trim()
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        'Update instruction is required.'
                });
            }

            const project =
                getProject(projectId);

            if (!project) {
                return res.status(404).json({
                    success: false,
                    error:
                        'Project not found.'
                });
            }

            const result =
                await performSelfHealingUpdate(
                    projectId,
                    String(
                        instruction
                    ).trim()
                );

            return res.json({
                success:
                    result.success,

                healed:
                    result.healed,

                rolledBack:
                    result.rolledBack,

                projectId,

                oldVersion:
                    result.oldVersion,

                newVersion:
                    result.newVersion || null,

                failedVersion:
                    result.failedVersion || null,

                validation:
                    result.validation || null,

                preview:
                    `/api/autonomous/preview/${projectId}`,

                message:
                    result.success
                        ? 'Update completed and self-check passed.'
                        : 'Update failed validation. Previous version restored.'
            });

        } catch (error) {

            console.error(
                '[SELF-HEALING API ERROR]',
                error
            );

            return res.status(500).json({
                success: false,

                healed: false,

                rolledBack: true,

                error:
                    error.message ||
                    'Self-healing update failed.',

                message:
                    'Update failed. Previous version was restored when possible.'
            });
        }
    }
);


/* =======================================================
   END PART 4H
======================================================= */
// ============================================================
// PART 4I — PROJECT STATE BACKUP & RESTORE
// ============================================================

function createProjectStateBackup(projectId, version) {
    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const backupDir = versionDirectory(projectId, version);

    ensureDir(backupDir);

    const state = {
        projectId: project.id,
        projectName: project.name,
        slug: project.slug,
        requirement: project.requirement || {},
        blueprint: project.blueprint || {},
        version: project.version || 1,
        status: project.status || 'UNKNOWN',
        createdAt: project.createdAt || now(),
        updatedAt: project.updatedAt || now(),
        backupVersion: version,
        backedUpAt: now()
    };

    writeFile(
        path.join(backupDir, 'project-state.json'),
        JSON.stringify(state, null, 2)
    );

    return state;
}


// ------------------------------------------------------------
// Restore project state from a version backup
// ------------------------------------------------------------

function restoreProjectState(projectId, version) {
    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const stateFile = path.join(
        versionDirectory(projectId, version),
        'project-state.json'
    );

    if (!fs.existsSync(stateFile)) {
        return {
            restored: false,
            reason: 'project-state.json not found in this backup'
        };
    }

    const state = readJson(stateFile, null);

    if (!state) {
        return {
            restored: false,
            reason: 'Invalid project-state.json'
        };
    }

    project.name = state.projectName || project.name;
    project.slug = state.slug || project.slug;
    project.requirement = state.requirement || project.requirement;
    project.blueprint = state.blueprint || project.blueprint;

    project.version = state.version || version;
    project.status = state.status || 'RESTORED';

    project.updatedAt = now();

    saveRegistry();

    return {
        restored: true,
        version: project.version
    };
}


// ------------------------------------------------------------
// Complete restore:
// Files + Blueprint + Requirement + Project metadata
// ------------------------------------------------------------

function restoreCompleteProjectVersion(projectId, version) {
    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const backupDir = versionDirectory(projectId, version);

    if (!fs.existsSync(backupDir)) {
        throw new Error(`Backup version ${version} not found`);
    }

    // Restore project files
    const currentDir = projectDirectory(projectId);

    if (fs.existsSync(currentDir)) {
        fs.rmSync(currentDir, {
            recursive: true,
            force: true
        });
    }

    ensureDir(currentDir);

    copyDirectorySync(
        backupDir,
        currentDir
    );

    // Restore project state
    const stateResult = restoreProjectState(
        projectId,
        version
    );

    const restoredProject = getProject(projectId);

    if (restoredProject) {
        restoredProject.status = 'RESTORED';
        restoredProject.updatedAt = now();

        saveRegistry();
    }

    return {
        success: true,
        projectId,
        restoredVersion: version,
        stateRestored: stateResult.restored,
        status: 'RESTORED'
    };
}


// ------------------------------------------------------------
// Create FULL backup before an update
// ------------------------------------------------------------

function createFullProjectBackup(projectId) {
    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const version = project.version || 1;

    // Existing file backup
    const backupResult = createProjectBackup(projectId);

    // Additional project-state backup
    const state = createProjectStateBackup(
        projectId,
        version
    );

    return {
        success: true,
        projectId,
        version,
        backupPath: backupResult.backupPath,
        stateBackup: true,
        state
    };
}


// ------------------------------------------------------------
// Safe rollback helper
// ------------------------------------------------------------

function safeRollbackProject(projectId, version) {
    try {
        const result = restoreCompleteProjectVersion(
            projectId,
            version
        );

        return {
            success: true,
            ...result
        };

    } catch (error) {

        return {
            success: false,
            projectId,
            version,
            error: error.message
        };
    }
}


// ------------------------------------------------------------
// GET complete version snapshot
// ------------------------------------------------------------

router.get('/snapshot/:id/:version', (req, res) => {

    try {

        const { id, version } = req.params;

        const project = getProject(id);

        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        const versionNumber = Number(version);

        if (!Number.isInteger(versionNumber) || versionNumber < 1) {
            return res.status(400).json({
                success: false,
                error: 'Invalid version'
            });
        }

        const stateFile = path.join(
            versionDirectory(id, versionNumber),
            'project-state.json'
        );

        if (!fs.existsSync(stateFile)) {
            return res.status(404).json({
                success: false,
                error: 'Snapshot not found'
            });
        }

        const state = readJson(
            stateFile,
            null
        );

        res.json({
            success: true,
            projectId: id,
            version: versionNumber,
            snapshot: state
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ------------------------------------------------------------
// POST complete restore
// ------------------------------------------------------------

router.post('/restore/:id/:version', (req, res) => {

    try {

        const { id, version } = req.params;

        const versionNumber = Number(version);

        if (!Number.isInteger(versionNumber) || versionNumber < 1) {
            return res.status(400).json({
                success: false,
                error: 'Invalid version'
            });
        }

        const result = restoreCompleteProjectVersion(
            id,
            versionNumber
        );

        res.json(result);

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ============================================================
// END PART 4I
// ============================================================
// ============================================================
// PART 4J — SAFE UPDATE + SELF-HEALING WITH FULL ROLLBACK
// ============================================================

async function updateAutonomousProjectSafe(projectId, userInstruction) {

    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const oldVersion = project.version || 1;

    let backupCreated = false;

    try {

        // ----------------------------------------------------
        // 1. FULL BACKUP BEFORE ANY CHANGE
        // ----------------------------------------------------

        createFullProjectBackup(projectId);

        backupCreated = true;

        project.status = 'UPDATING';
        project.updatedAt = now();

        saveRegistry();


        // ----------------------------------------------------
        // 2. CREATE AI UPDATE PLAN
        // ----------------------------------------------------

        const updatePlan = await createAIUpdatePlan(
            project,
            userInstruction
        );


        // ----------------------------------------------------
        // 3. NORMALIZE UPDATE PLAN
        // ----------------------------------------------------

        const normalizedPlan = normalizeUpdatePlan(
            updatePlan
        );


        // ----------------------------------------------------
        // 4. APPLY UPDATE
        // ----------------------------------------------------

        const updateResult = await applyUpdatePlan(
            projectId,
            normalizedPlan
        );


        if (!updateResult || updateResult.success === false) {
            throw new Error(
                updateResult?.error ||
                'Update plan failed'
            );
        }


        // ----------------------------------------------------
        // 5. INCREMENT VERSION
        // ----------------------------------------------------

        const newVersion = incrementProjectVersion(
            projectId
        );


        // ----------------------------------------------------
        // 6. REGENERATE PROJECT IF BLUEPRINT CHANGED
        // ----------------------------------------------------

        const currentProject = getProject(projectId);

        if (
            normalizedPlan.blueprintChanges &&
            normalizedPlan.blueprintChanges.length > 0
        ) {

            await regenerateProjectAfterBlueprintUpdate(
                projectId
            );
        }


        // ----------------------------------------------------
        // 7. SAVE UPDATED STATE
        // ----------------------------------------------------

        const updatedProject = getProject(projectId);

        updatedProject.status = 'UPDATED';
        updatedProject.version = newVersion;
        updatedProject.updatedAt = now();

        saveRegistry();


        // ----------------------------------------------------
        // 8. RUN VALIDATION
        // ----------------------------------------------------

        const validation = await validateAfterUpdate(
            projectId
        );


        // ----------------------------------------------------
        // 9. IF VALIDATION FAILS → COMPLETE ROLLBACK
        // ----------------------------------------------------

        if (!validation.success) {

            const rollback = safeRollbackProject(
                projectId,
                oldVersion
            );

            return {
                success: false,
                projectId,
                status: 'ROLLED_BACK',
                oldVersion,
                failedVersion: newVersion,
                validation,
                rollback,
                message:
                    'Update failed validation. Previous working version restored.'
            };
        }


        // ----------------------------------------------------
        // 10. SUCCESS
        // ----------------------------------------------------

        const finalProject = getProject(projectId);

        finalProject.status = 'UPDATED';
        finalProject.updatedAt = now();

        saveRegistry();


        return {
            success: true,
            projectId,
            oldVersion,
            newVersion,
            status: 'UPDATED',
            validation,
            backupCreated,
            message:
                'Project updated successfully and passed validation.'
        };


    } catch (error) {

        // ----------------------------------------------------
        // ERROR → COMPLETE ROLLBACK
        // ----------------------------------------------------

        let rollback = null;

        if (backupCreated) {

            rollback = safeRollbackProject(
                projectId,
                oldVersion
            );
        }

        const failedProject = getProject(projectId);

        if (failedProject) {

            failedProject.status =
                rollback?.success
                    ? 'ROLLED_BACK'
                    : 'UPDATE_FAILED';

            failedProject.updatedAt = now();

            saveRegistry();
        }


        return {
            success: false,
            projectId,
            status:
                rollback?.success
                    ? 'ROLLED_BACK'
                    : 'UPDATE_FAILED',
            error: error.message,
            oldVersion,
            rollback,
            message:
                rollback?.success
                    ? 'Update failed. Previous version restored automatically.'
                    : 'Update failed and automatic rollback could not be completed.'
        };
    }
}


// ============================================================
// SELF-HEALING UPDATE
// ============================================================

async function selfHealProjectSafe(
    projectId,
    userInstruction
) {

    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const workingVersion = project.version || 1;


    try {

        // ----------------------------------------------------
        // 1. FULL BACKUP
        // ----------------------------------------------------

        createFullProjectBackup(
            projectId
        );


        // ----------------------------------------------------
        // 2. MARK SELF-HEALING
        // ----------------------------------------------------

        project.status = 'SELF_HEALING';
        project.updatedAt = now();

        saveRegistry();


        // ----------------------------------------------------
        // 3. APPLY SAFE UPDATE
        // ----------------------------------------------------

        const result =
            await updateAutonomousProjectSafe(
                projectId,
                userInstruction
            );


        // ----------------------------------------------------
        // 4. UPDATE FAILED
        // ----------------------------------------------------

        if (!result.success) {

            return {
                success: false,
                projectId,
                status: result.status,
                result,
                message:
                    'Self-healing update failed. Safe version retained.'
            };
        }


        // ----------------------------------------------------
        // 5. FINAL SELF CHECK
        // ----------------------------------------------------

        const selfCheck =
            await runProjectSelfCheck(
                projectId
            );


        // ----------------------------------------------------
        // 6. SELF CHECK FAILED
        // ----------------------------------------------------

        if (!selfCheck.success) {

            const rollback =
                safeRollbackProject(
                    projectId,
                    workingVersion
                );

            return {
                success: false,
                projectId,
                status: 'ROLLED_BACK',
                selfCheck,
                rollback,
                message:
                    'Self-check failed. Previous working version restored.'
            };
        }


        // ----------------------------------------------------
        // 7. SELF-HEALING SUCCESS
        // ----------------------------------------------------

        const healedProject =
            getProject(projectId);

        healedProject.status =
            'SELF_HEALED';

        healedProject.updatedAt =
            now();

        saveRegistry();


        return {
            success: true,
            projectId,
            status: 'SELF_HEALED',
            version: healedProject.version,
            selfCheck,
            message:
                'Project successfully updated and self-healing checks passed.'
        };


    } catch (error) {

        // ----------------------------------------------------
        // EMERGENCY ROLLBACK
        // ----------------------------------------------------

        const rollback =
            safeRollbackProject(
                projectId,
                workingVersion
            );


        const failedProject =
            getProject(projectId);

        if (failedProject) {

            failedProject.status =
                rollback.success
                    ? 'ROLLED_BACK'
                    : 'SELF_HEAL_FAILED';

            failedProject.updatedAt =
                now();

            saveRegistry();
        }


        return {
            success: false,
            projectId,
            status:
                rollback.success
                    ? 'ROLLED_BACK'
                    : 'SELF_HEAL_FAILED',
            error: error.message,
            rollback,
            message:
                rollback.success
                    ? 'Self-healing failed. Previous working version restored.'
                    : 'Critical self-healing failure.'
        };
    }
}


// ============================================================
// API — SAFE UPDATE
// ============================================================

router.post('/safe-update/:id', async (req, res) => {

    try {

        const { id } = req.params;

        const instruction =
            cleanText(
                req.body?.prompt ||
                req.body?.instruction ||
                req.body?.change ||
                req.body?.request ||
                ''
            );

        if (!instruction) {

            return res.status(400).json({
                success: false,
                error:
                    'Update instruction is required'
            });
        }


        const result =
            await updateAutonomousProjectSafe(
                id,
                instruction
            );


        res.json(result);

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ============================================================
// API — SELF HEAL
// ============================================================

router.post('/safe-self-heal/:id', async (req, res) => {

    try {

        const { id } = req.params;

        const instruction =
            cleanText(
                req.body?.prompt ||
                req.body?.instruction ||
                req.body?.change ||
                req.body?.request ||
                ''
            );


        if (!instruction) {

            return res.status(400).json({
                success: false,
                error:
                    'Self-healing instruction is required'
            });
        }


        const result =
            await selfHealProjectSafe(
                id,
                instruction
            );


        res.json(result);

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ============================================================
// END PART 4J
// ============================================================
// ============================================================
// PART 4K — AUTONOMOUS AI CHANGE LOOP
// User Request → Analyze → Plan → Update → Validate → Repair
// ============================================================

function buildAutonomousLoopPrompt(project, userRequest) {

    return `
You are the Autonomous Software Engineer for SamarthAI.

PROJECT:
Name: ${project.name}
ID: ${project.id}
Version: ${project.version}

CURRENT PROJECT BLUEPRINT:
${JSON.stringify(project.blueprint || {}, null, 2)}

USER REQUEST:
${userRequest}

Your job is to understand the user's request and decide exactly
what needs to change in the generated project.

Return ONLY valid JSON:

{
  "understood": true,
  "summary": "short explanation",
  "changes": [
    {
      "type": "modify|create|delete",
      "file": "relative/file/path",
      "reason": "why this file must change",
      "instructions": "exact implementation instructions"
    }
  ],
  "blueprintChanges": [],
  "requiresRepair": false
}

Rules:
1. Never invent unrelated changes.
2. Preserve existing working functionality.
3. Modify the minimum number of files necessary.
4. Never use absolute paths.
5. Never access files outside the project.
6. Do not expose API keys or secrets.
7. If a feature requires a new file, explicitly list it.
8. If the request is ambiguous, make the safest reasonable interpretation.
`;
}


async function analyzeAutonomousChange(
    projectId,
    userRequest
) {

    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const prompt =
        buildAutonomousLoopPrompt(
            project,
            userRequest
        );

    const aiResponse =
        await askGemini(prompt);

    const parsed =
        parseAIJson(aiResponse);

    if (!parsed) {

        return {
            understood: true,
            summary: 'AI plan could not be parsed.',
            changes: [],
            blueprintChanges: [],
            requiresRepair: true
        };
    }

    return parsed;
}


// ------------------------------------------------------------
// Validate AI plan before execution
// ------------------------------------------------------------

function validateAutonomousPlan(plan) {

    if (!plan || typeof plan !== 'object') {
        return {
            valid: false,
            error: 'Invalid AI plan'
        };
    }

    if (!Array.isArray(plan.changes)) {
        plan.changes = [];
    }

    if (!Array.isArray(plan.blueprintChanges)) {
        plan.blueprintChanges = [];
    }

    const allowedTypes = [
        'modify',
        'create',
        'delete'
    ];

    for (const change of plan.changes) {

        if (!change.file) {
            return {
                valid: false,
                error: 'Change file is missing'
            };
        }

        if (!allowedTypes.includes(change.type)) {
            return {
                valid: false,
                error:
                    `Invalid change type: ${change.type}`
            };
        }

        if (!isSafeProjectPath(change.file)) {
            return {
                valid: false,
                error:
                    `Unsafe project path: ${change.file}`
            };
        }
    }

    return {
        valid: true
    };
}


// ------------------------------------------------------------
// Execute one autonomous cycle
// ------------------------------------------------------------

async function executeAutonomousCycle(
    projectId,
    userRequest
) {

    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const oldVersion =
        project.version || 1;


    // --------------------------------------------------------
    // 1. ANALYZE
    // --------------------------------------------------------

    const plan =
        await analyzeAutonomousChange(
            projectId,
            userRequest
        );


    // --------------------------------------------------------
    // 2. VALIDATE PLAN
    // --------------------------------------------------------

    const planValidation =
        validateAutonomousPlan(plan);

    if (!planValidation.valid) {

        return {
            success: false,
            stage: 'PLAN_VALIDATION',
            error: planValidation.error
        };
    }


    // --------------------------------------------------------
    // 3. NOTHING TO CHANGE
    // --------------------------------------------------------

    if (
        plan.changes.length === 0 &&
        plan.blueprintChanges.length === 0
    ) {

        return {
            success: true,
            changed: false,
            projectId,
            version: oldVersion,
            summary:
                plan.summary ||
                'No changes were required.'
        };
    }


    // --------------------------------------------------------
    // 4. EXECUTE SAFE UPDATE
    // --------------------------------------------------------

    const result =
        await updateAutonomousProjectSafe(
            projectId,
            userRequest
        );


    if (!result.success) {

        return {
            success: false,
            stage: 'UPDATE',
            projectId,
            result
        };
    }


    // --------------------------------------------------------
    // 5. SELF CHECK
    // --------------------------------------------------------

    const selfCheck =
        await runProjectSelfCheck(
            projectId
        );


    if (!selfCheck.success) {

        return {
            success: false,
            stage: 'SELF_CHECK',
            projectId,
            selfCheck,
            result
        };
    }


    return {
        success: true,
        changed: true,
        projectId,
        oldVersion,
        newVersion:
            getProject(projectId).version,
        summary:
            plan.summary ||
            'Autonomous change completed.',
        plan,
        selfCheck
    };
}


// ============================================================
// AUTONOMOUS REPAIR LOOP
// ============================================================

async function runAutonomousRepairLoop(
    projectId,
    userRequest,
    maxAttempts = 3
) {

    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    let attempts = 0;
    let lastResult = null;


    while (attempts < maxAttempts) {

        attempts++;


        try {

            lastResult =
                await executeAutonomousCycle(
                    projectId,
                    userRequest
                );


            // -----------------------------------------------
            // SUCCESS
            // -----------------------------------------------

            if (lastResult.success) {

                const finalProject =
                    getProject(projectId);

                finalProject.status =
                    'AUTONOMOUS_SUCCESS';

                finalProject.updatedAt =
                    now();

                saveRegistry();


                return {
                    success: true,
                    projectId,
                    attempts,
                    status:
                        'AUTONOMOUS_SUCCESS',
                    result: lastResult
                };
            }


            // -----------------------------------------------
            // FAILURE → ASK AI FOR REPAIR
            // -----------------------------------------------

            const repairInstruction = `
The previous autonomous update failed.

Original user request:
${userRequest}

Failure information:
${JSON.stringify(
    lastResult,
    null,
    2
)}

Fix the project so the original request can be completed.

Do not remove existing working features.
Make the smallest safe correction possible.
`;


            lastResult =
                await executeAutonomousCycle(
                    projectId,
                    repairInstruction
                );


            if (lastResult.success) {

                const finalProject =
                    getProject(projectId);

                finalProject.status =
                    'AUTONOMOUS_REPAIRED';

                finalProject.updatedAt =
                    now();

                saveRegistry();


                return {
                    success: true,
                    projectId,
                    attempts,
                    status:
                        'AUTONOMOUS_REPAIRED',
                    result: lastResult
                };
            }


        } catch (error) {

            lastResult = {
                success: false,
                error: error.message
            };
        }
    }


    // --------------------------------------------------------
    // ALL ATTEMPTS FAILED
    // --------------------------------------------------------

    const currentProject =
        getProject(projectId);

    if (currentProject) {

        currentProject.status =
            'AUTONOMOUS_FAILED';

        currentProject.updatedAt =
            now();

        saveRegistry();
    }


    return {
        success: false,
        projectId,
        attempts,
        status:
            'AUTONOMOUS_FAILED',
        lastResult,
        message:
            'Autonomous system could not safely complete the request.'
    };
}


// ============================================================
// API — AUTONOMOUS CHANGE
// ============================================================

router.post('/autonomous-change/:id', async (req, res) => {

    try {

        const { id } = req.params;

        const userRequest =
            cleanText(
                req.body?.prompt ||
                req.body?.request ||
                req.body?.instruction ||
                req.body?.change ||
                ''
            );


        if (!userRequest) {

            return res.status(400).json({
                success: false,
                error:
                    'Please provide a change request.'
            });
        }


        const result =
            await runAutonomousRepairLoop(
                id,
                userRequest,
                3
            );


        res.json(result);

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ============================================================
// API — ANALYZE ONLY
// ============================================================

router.post('/autonomous-analyze/:id', async (req, res) => {

    try {

        const { id } = req.params;

        const userRequest =
            cleanText(
                req.body?.prompt ||
                req.body?.request ||
                req.body?.instruction ||
                ''
            );


        if (!userRequest) {

            return res.status(400).json({
                success: false,
                error:
                    'Please provide a request.'
            });
        }


        const plan =
            await analyzeAutonomousChange(
                id,
                userRequest
            );


        const validation =
            validateAutonomousPlan(plan);


        res.json({
            success: validation.valid,
            projectId: id,
            plan,
            validation
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ============================================================
// API — AUTONOMOUS STATUS
// ============================================================

router.get('/autonomous-status/:id', (req, res) => {

    try {

        const project =
            getProject(req.params.id);

        if (!project) {

            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }


        res.json({
            success: true,
            projectId: project.id,
            projectName: project.name,
            version: project.version,
            status: project.status,
            updatedAt: project.updatedAt,
            autonomous: true
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ============================================================
// END PART 4K
// ============================================================
// ============================================================
// PART 4L — DIRECT PLAN EXECUTION ENGINE
// AI PLAN → VALIDATE → BACKUP → EXECUTE → TEST → ROLLBACK
// ============================================================


// ------------------------------------------------------------
// Execute an already-approved autonomous plan
// ------------------------------------------------------------

async function executeApprovedAutonomousPlan(
    projectId,
    plan
) {

    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const oldVersion =
        project.version || 1;


    // --------------------------------------------------------
    // 1. Validate plan
    // --------------------------------------------------------

    const planValidation =
        validateAutonomousPlan(plan);

    if (!planValidation.valid) {

        return {
            success: false,
            stage: 'PLAN_VALIDATION',
            error: planValidation.error
        };
    }


    // --------------------------------------------------------
    // 2. Nothing to change
    // --------------------------------------------------------

    if (
        plan.changes.length === 0 &&
        plan.blueprintChanges.length === 0
    ) {

        return {
            success: true,
            changed: false,
            projectId,
            version: oldVersion,
            message:
                'No changes required.'
        };
    }


    // --------------------------------------------------------
    // 3. Create complete backup
    // --------------------------------------------------------

    createFullProjectBackup(
        projectId
    );


    try {

        project.status = 'UPDATING';
        project.updatedAt = now();

        saveRegistry();


        // ----------------------------------------------------
        // 4. Apply blueprint changes FIRST
        // ----------------------------------------------------

        if (
            plan.blueprintChanges &&
            plan.blueprintChanges.length > 0
        ) {

            applyBlueprintChanges(
                projectId,
                plan.blueprintChanges
            );
        }


        // ----------------------------------------------------
        // 5. Apply file changes from SAME AI PLAN
        // ----------------------------------------------------

        const updateResult =
            await applyUpdatePlan(
                projectId,
                plan
            );


        if (
            !updateResult ||
            updateResult.success === false
        ) {

            throw new Error(
                updateResult?.error ||
                'Plan execution failed'
            );
        }


        // ----------------------------------------------------
        // 6. Regenerate project when blueprint changed
        // ----------------------------------------------------

        if (
            plan.blueprintChanges &&
            plan.blueprintChanges.length > 0
        ) {

            await regenerateProjectAfterBlueprintUpdate(
                projectId
            );
        }


        // ----------------------------------------------------
        // 7. Increment version
        // ----------------------------------------------------

        const newVersion =
            incrementProjectVersion(
                projectId
            );


        // ----------------------------------------------------
        // 8. Save updated state
        // ----------------------------------------------------

        const updatedProject =
            getProject(projectId);

        updatedProject.status =
            'UPDATE_PENDING_VALIDATION';

        updatedProject.version =
            newVersion;

        updatedProject.updatedAt =
            now();

        saveRegistry();


        // ----------------------------------------------------
        // 9. Save state snapshot of NEW version
        // ----------------------------------------------------

        createProjectStateBackup(
            projectId,
            newVersion
        );


        // ----------------------------------------------------
        // 10. Run complete self-check
        // ----------------------------------------------------

        const validation =
            await validateAfterUpdate(
                projectId
            );


        // ----------------------------------------------------
        // 11. Validation FAILED
        // ----------------------------------------------------

        if (!validation.success) {

            const rollback =
                safeRollbackProject(
                    projectId,
                    oldVersion
                );


            return {
                success: false,
                changed: false,
                projectId,
                oldVersion,
                failedVersion: newVersion,
                stage: 'VALIDATION',
                validation,
                rollback,
                status:
                    rollback.success
                        ? 'ROLLED_BACK'
                        : 'ROLLBACK_FAILED'
            };
        }


        // ----------------------------------------------------
        // 12. SUCCESS
        // ----------------------------------------------------

        const finalProject =
            getProject(projectId);

        finalProject.status =
            'UPDATED';

        finalProject.updatedAt =
            now();

        saveRegistry();


        return {
            success: true,
            changed: true,
            projectId,
            oldVersion,
            newVersion,
            status: 'UPDATED',
            validation,
            message:
                'Approved autonomous plan executed successfully.'
        };


    } catch (error) {


        // ----------------------------------------------------
        // Emergency rollback
        // ----------------------------------------------------

        const rollback =
            safeRollbackProject(
                projectId,
                oldVersion
            );


        const failedProject =
            getProject(projectId);

        if (failedProject) {

            failedProject.status =
                rollback.success
                    ? 'ROLLED_BACK'
                    : 'UPDATE_FAILED';

            failedProject.updatedAt =
                now();

            saveRegistry();
        }


        return {
            success: false,
            changed: false,
            projectId,
            oldVersion,
            status:
                rollback.success
                    ? 'ROLLED_BACK'
                    : 'UPDATE_FAILED',
            error: error.message,
            rollback,
            message:
                rollback.success
                    ? 'Execution failed. Previous version restored.'
                    : 'Execution and rollback failed.'
        };
    }
}


// ------------------------------------------------------------
// Autonomous loop using ONE AI plan
// ------------------------------------------------------------

async function runAutonomousSinglePlanLoop(
    projectId,
    userRequest,
    maxAttempts = 3
) {

    const project =
        getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }


    let attempts = 0;
    let currentRequest =
        userRequest;

    let lastResult = null;


    while (attempts < maxAttempts) {

        attempts++;


        try {

            // ------------------------------------------------
            // AI creates ONE plan
            // ------------------------------------------------

            const plan =
                await analyzeAutonomousChange(
                    projectId,
                    currentRequest
                );


            // ------------------------------------------------
            // Execute THAT SAME plan
            // ------------------------------------------------

            lastResult =
                await executeApprovedAutonomousPlan(
                    projectId,
                    plan
                );


            // ------------------------------------------------
            // SUCCESS
            // ------------------------------------------------

            if (lastResult.success) {

                const finalProject =
                    getProject(projectId);

                finalProject.status =
                    'AUTONOMOUS_SUCCESS';

                finalProject.updatedAt =
                    now();

                saveRegistry();


                return {
                    success: true,
                    projectId,
                    attempts,
                    status:
                        'AUTONOMOUS_SUCCESS',
                    result: lastResult
                };
            }


            // ------------------------------------------------
            // FAILURE → prepare repair request
            // ------------------------------------------------

            currentRequest = `
Original user request:
${userRequest}

The previous implementation attempt failed.

Failure details:
${JSON.stringify(
    lastResult,
    null,
    2
)}

Create a corrected implementation plan.

IMPORTANT:
- Preserve all existing working features.
- Fix only the failed implementation.
- Do not remove unrelated functionality.
- Make the smallest safe change.
- Return a complete valid JSON plan.
`;


        } catch (error) {

            lastResult = {
                success: false,
                error: error.message
            };


            currentRequest = `
Original request:
${userRequest}

Previous autonomous attempt produced this error:
${error.message}

Create a safer corrected implementation plan.
`;
        }
    }


    // --------------------------------------------------------
    // All attempts failed
    // --------------------------------------------------------

    const finalProject =
        getProject(projectId);

    if (finalProject) {

        finalProject.status =
            'AUTONOMOUS_FAILED';

        finalProject.updatedAt =
            now();

        saveRegistry();
    }


    return {
        success: false,
        projectId,
        attempts,
        status:
            'AUTONOMOUS_FAILED',
        lastResult,
        message:
            'Autonomous system could not complete the request safely.'
    };
}


// ============================================================
// API — SINGLE PLAN AUTONOMOUS ENGINE
// ============================================================

router.post(
    '/autonomous-execute/:id',
    async (req, res) => {

        try {

            const { id } =
                req.params;


            const userRequest =
                cleanText(
                    req.body?.prompt ||
                    req.body?.request ||
                    req.body?.instruction ||
                    req.body?.change ||
                    ''
                );


            if (!userRequest) {

                return res.status(400).json({
                    success: false,
                    error:
                        'Please provide a request.'
                });
            }


            const result =
                await runAutonomousSinglePlanLoop(
                    id,
                    userRequest,
                    3
                );


            res.json(result);


        } catch (error) {

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);


// ============================================================
// END PART 4L
// ============================================================
// ============================================================
// PART 4M — PROJECT CODE CONTEXT ENGINE
// AI → READ REAL FILES → UNDERSTAND CODE → CREATE BETTER PLAN
// ============================================================


// ------------------------------------------------------------
// Collect important source files for AI analysis
// ------------------------------------------------------------

function collectAIProjectContext(projectId, maxFiles = 30) {

    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const directory =
        projectDirectory(projectId);

    if (!fs.existsSync(directory)) {
        throw new Error('Project directory not found');
    }

    const files = [];

    function walk(currentDirectory) {

        if (files.length >= maxFiles) {
            return;
        }

        const entries =
            fs.readdirSync(
                currentDirectory,
                { withFileTypes: true }
            );

        for (const entry of entries) {

            if (files.length >= maxFiles) {
                break;
            }

            // Ignore internal/version folders
            if (
                entry.name === 'node_modules' ||
                entry.name === '.git' ||
                entry.name === '.versions'
            ) {
                continue;
            }

            const fullPath =
                path.join(
                    currentDirectory,
                    entry.name
                );

            if (entry.isDirectory()) {

                walk(fullPath);

            } else {

                const relativePath =
                    path.relative(
                        directory,
                        fullPath
                    );

                const extension =
                    path.extname(entry.name)
                        .toLowerCase();

                const allowedExtensions = [
                    '.html',
                    '.css',
                    '.js',
                    '.cjs',
                    '.json',
                    '.md',
                    '.txt',
                    '.xml',
                    '.svg'
                ];

                if (
                    !allowedExtensions.includes(
                        extension
                    )
                ) {
                    continue;
                }

                try {

                    const content =
                        fs.readFileSync(
                            fullPath,
                            'utf8'
                        );

                    // Avoid sending extremely large files
                    const limitedContent =
                        content.length > 30000
                            ? content.slice(0, 30000) +
                              '\n\n[FILE TRUNCATED]'
                            : content;

                    files.push({
                        path: relativePath,
                        size: content.length,
                        content: limitedContent
                    });

                } catch (error) {

                    files.push({
                        path: relativePath,
                        size: 0,
                        content:
                            '[FILE COULD NOT BE READ]'
                    });
                }
            }
        }
    }

    walk(directory);

    return files;
}


// ------------------------------------------------------------
// Build complete AI code context
// ------------------------------------------------------------

function buildAIProjectContext(
    projectId,
    userRequest
) {

    const project =
        getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const files =
        collectAIProjectContext(
            projectId,
            30
        );

    return {
        project: {
            id: project.id,
            name: project.name,
            slug: project.slug,
            version: project.version,
            status: project.status
        },

        requirement:
            project.requirement || {},

        blueprint:
            project.blueprint || {},

        userRequest,

        files
    };
}


// ------------------------------------------------------------
// Ask AI to understand REAL project code
// ------------------------------------------------------------

async function analyzeRealProjectCode(
    projectId,
    userRequest
) {

    const context =
        buildAIProjectContext(
            projectId,
            userRequest
        );


    const prompt = `
You are the senior software architect for SamarthAI.

You are modifying an EXISTING generated project.

You must inspect the ACTUAL project files before deciding
what should change.

PROJECT INFORMATION:
${JSON.stringify(
    context.project,
    null,
    2
)}

CURRENT REQUIREMENT:
${JSON.stringify(
    context.requirement,
    null,
    2
)}

CURRENT BLUEPRINT:
${JSON.stringify(
    context.blueprint,
    null,
    2
)}

USER REQUEST:
${context.userRequest}

ACTUAL PROJECT FILES:
${JSON.stringify(
    context.files,
    null,
    2
)}

Analyze the real code and return ONLY valid JSON:

{
  "understood": true,
  "summary": "what the user wants",
  "analysis": {
    "affectedFiles": [],
    "existingFeatures": [],
    "risks": [],
    "dependencies": []
  },
  "changes": [
    {
      "type": "modify|create|delete",
      "file": "relative/file/path",
      "reason": "why this file changes",
      "instructions": "precise implementation instructions"
    }
  ],
  "blueprintChanges": [],
  "tests": [
    "test that should be performed"
  ]
}

IMPORTANT RULES:

1. Use the actual files as the primary source of truth.
2. Do not assume a file exists if it is not shown.
3. Preserve existing working functionality.
4. Change only files required for the request.
5. Never expose secrets or API keys.
6. Never use absolute file paths.
7. Never use ../ paths.
8. Do not modify package dependencies unless necessary.
9. Do not delete functionality unless the user explicitly asks.
10. Keep changes compatible with the existing project structure.
11. If the requested feature already exists, improve it instead
    of creating a duplicate.
12. If a file is missing, explicitly use type "create".
13. If a change can be made in one file, do not unnecessarily
    modify multiple files.
14. Return valid JSON only.
`;


    const aiResponse =
        await askGemini(prompt);

    const parsed =
        parseAIJson(aiResponse);


    if (!parsed) {

        return {
            understood: false,
            summary:
                'AI could not parse the project analysis.',
            analysis: {
                affectedFiles: [],
                existingFeatures: [],
                risks: [],
                dependencies: []
            },
            changes: [],
            blueprintChanges: [],
            tests: []
        };
    }


    return parsed;
}


// ------------------------------------------------------------
// Validate REAL-CODE AI plan
// ------------------------------------------------------------

function validateRealCodePlan(
    projectId,
    plan
) {

    const baseDirectory =
        projectDirectory(projectId);

    if (!plan || typeof plan !== 'object') {

        return {
            valid: false,
            error: 'Invalid project analysis'
        };
    }


    if (!Array.isArray(plan.changes)) {

        return {
            valid: false,
            error: 'Changes must be an array'
        };
    }


    const allowedTypes = [
        'modify',
        'create',
        'delete'
    ];


    for (const change of plan.changes) {

        if (!change.file) {

            return {
                valid: false,
                error:
                    'Change file is missing'
            };
        }


        if (
            !allowedTypes.includes(
                change.type
            )
        ) {

            return {
                valid: false,
                error:
                    `Invalid change type: ${change.type}`
            };
        }


        if (
            !isSafeProjectPath(
                change.file
            )
        ) {

            return {
                valid: false,
                error:
                    `Unsafe path: ${change.file}`
            };
        }


        const resolved =
            path.resolve(
                baseDirectory,
                change.file
            );

        const relative =
            path.relative(
                baseDirectory,
                resolved
            );


        if (
            relative.startsWith('..') ||
            path.isAbsolute(relative)
        ) {

            return {
                valid: false,
                error:
                    `Path outside project: ${change.file}`
            };
        }
    }


    return {
        valid: true
    };
}


// ------------------------------------------------------------
// Create AI plan from REAL project code
// ------------------------------------------------------------

async function createRealCodeUpdatePlan(
    projectId,
    userRequest
) {

    const plan =
        await analyzeRealProjectCode(
            projectId,
            userRequest
        );


    const validation =
        validateRealCodePlan(
            projectId,
            plan
        );


    if (!validation.valid) {

        return {
            success: false,
            error: validation.error,
            plan
        };
    }


    return {
        success: true,
        plan
    };
}


// ============================================================
// API — ANALYZE REAL PROJECT
// ============================================================

router.post(
    '/analyze-code/:id',
    async (req, res) => {

        try {

            const { id } =
                req.params;

            const userRequest =
                cleanText(
                    req.body?.prompt ||
                    req.body?.request ||
                    req.body?.instruction ||
                    ''
                );


            if (!userRequest) {

                return res.status(400).json({
                    success: false,
                    error:
                        'Please provide a request.'
                });
            }


            const result =
                await createRealCodeUpdatePlan(
                    id,
                    userRequest
                );


            res.json({
                success: result.success,
                projectId: id,
                analysis: result.plan,
                error:
                    result.error || null
            });


        } catch (error) {

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);


// ============================================================
// API — PROJECT CODE CONTEXT
// ============================================================

router.get(
    '/code-context/:id',
    (req, res) => {

        try {

            const context =
                buildAIProjectContext(
                    req.params.id,
                    ''
                );


            res.json({
                success: true,
                project: context.project,
                files:
                    context.files.map(file => ({
                        path: file.path,
                        size: file.size
                    }))
            });


        } catch (error) {

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);


// ============================================================
// END PART 4M
// ============================================================
// ============================================================
// PART 4N — REAL CODE AUTONOMOUS EXECUTION
// READ REAL FILES → PLAN → BACKUP → EXECUTE → TEST → ROLLBACK
// ============================================================


// ------------------------------------------------------------
// Generate an updated file using the REAL existing file
// ------------------------------------------------------------

async function generateRealCodeFile(
    projectId,
    filePath,
    instructions,
    projectContext
) {

    if (!isSafeProjectPath(filePath)) {
        throw new Error(
            `Unsafe project path: ${filePath}`
        );
    }

    const fullPath =
        resolveProjectFile(
            projectId,
            filePath
        );

    let existingContent = '';

    if (fs.existsSync(fullPath)) {
        existingContent =
            fs.readFileSync(
                fullPath,
                'utf8'
            );
    }

    const prompt = `
You are an expert software engineer working on an existing project.

PROJECT:
${JSON.stringify(
    projectContext.project,
    null,
    2
)}

FILE:
${filePath}

EXISTING FILE CONTENT:
${existingContent}

REQUESTED CHANGE:
${instructions}

IMPORTANT:
1. Return ONLY the complete new file content.
2. Do not use markdown code fences.
3. Preserve all existing working functionality.
4. Make only the requested changes.
5. Do not remove unrelated code.
6. Do not add fake functionality.
7. Do not expose API keys or secrets.
8. Keep the code compatible with the existing project.
9. If the existing file is already correct, return it with only
   necessary improvements.
`;


    const result =
        await askGemini(prompt);

    if (!result || !result.trim()) {
        throw new Error(
            `AI returned empty content for ${filePath}`
        );
    }

    return result.trim();
}


// ------------------------------------------------------------
// Execute REAL CODE plan
// ------------------------------------------------------------

async function executeRealCodePlan(
    projectId,
    plan
) {

    const project =
        getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }


    const validation =
        validateRealCodePlan(
            projectId,
            plan
        );


    if (!validation.valid) {

        return {
            success: false,
            stage: 'PLAN_VALIDATION',
            error: validation.error
        };
    }


    const changes =
        Array.isArray(plan.changes)
            ? plan.changes
            : [];


    if (
        changes.length === 0 &&
        (!plan.blueprintChanges ||
         plan.blueprintChanges.length === 0)
    ) {

        return {
            success: true,
            changed: false,
            projectId,
            version:
                project.version || 1,
            message:
                'No code changes required.'
        };
    }


    const oldVersion =
        project.version || 1;


    // --------------------------------------------------------
    // FULL BACKUP
    // --------------------------------------------------------

    createFullProjectBackup(
        projectId
    );


    try {

        project.status =
            'REAL_CODE_UPDATING';

        project.updatedAt =
            now();

        saveRegistry();


        // ----------------------------------------------------
        // Read actual project context
        // ----------------------------------------------------

        const projectContext =
            buildAIProjectContext(
                projectId,
                plan.summary || ''
            );


        const executedFiles = [];
        const skippedFiles = [];


        // ----------------------------------------------------
        // Execute every planned file change
        // ----------------------------------------------------

        for (const change of changes) {

            const filePath =
                change.file;


            // -----------------------------------------------
            // DELETE
            // -----------------------------------------------

            if (change.type === 'delete') {

                deleteProjectFile(
                    projectId,
                    filePath
                );

                executedFiles.push({
                    file: filePath,
                    type: 'delete'
                });

                continue;
            }


            // -----------------------------------------------
            // MODIFY / CREATE
            // -----------------------------------------------

            if (
                change.type === 'modify' ||
                change.type === 'create'
            ) {

                const newContent =
                    await generateRealCodeFile(
                        projectId,
                        filePath,
                        change.instructions ||
                            change.reason ||
                            'Implement requested change.',
                        projectContext
                    );


                writeProjectFile(
                    projectId,
                    filePath,
                    newContent
                );


                executedFiles.push({
                    file: filePath,
                    type: change.type
                });

                continue;
            }


            skippedFiles.push({
                file: filePath,
                reason:
                    'Unsupported change type'
            });
        }


        // ----------------------------------------------------
        // Blueprint changes
        // ----------------------------------------------------

        if (
            plan.blueprintChanges &&
            plan.blueprintChanges.length > 0
        ) {

            applyBlueprintChanges(
                projectId,
                plan.blueprintChanges
            );
        }


        // ----------------------------------------------------
        // Regenerate if blueprint changed
        // ----------------------------------------------------

        if (
            plan.blueprintChanges &&
            plan.blueprintChanges.length > 0
        ) {

            await regenerateProjectAfterBlueprintUpdate(
                projectId
            );
        }


        // ----------------------------------------------------
        // VERSION
        // ----------------------------------------------------

        const newVersion =
            incrementProjectVersion(
                projectId
            );


        // ----------------------------------------------------
        // SAVE NEW STATE
        // ----------------------------------------------------

        const updatedProject =
            getProject(projectId);

        updatedProject.version =
            newVersion;

        updatedProject.status =
            'REAL_CODE_PENDING_VALIDATION';

        updatedProject.updatedAt =
            now();

        saveRegistry();


        createProjectStateBackup(
            projectId,
            newVersion
        );


        // ----------------------------------------------------
        // SELF CHECK
        // ----------------------------------------------------

        const validationResult =
            await validateAfterUpdate(
                projectId
            );


        // ----------------------------------------------------
        // VALIDATION FAILED
        // ----------------------------------------------------

        if (!validationResult.success) {

            const rollback =
                safeRollbackProject(
                    projectId,
                    oldVersion
                );


            return {
                success: false,
                changed: false,
                projectId,
                oldVersion,
                failedVersion:
                    newVersion,
                stage:
                    'REAL_CODE_VALIDATION',
                executedFiles,
                validation:
                    validationResult,
                rollback,
                status:
                    rollback.success
                        ? 'ROLLED_BACK'
                        : 'ROLLBACK_FAILED'
            };
        }


        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        const finalProject =
            getProject(projectId);

        finalProject.status =
            'REAL_CODE_UPDATED';

        finalProject.updatedAt =
            now();

        saveRegistry();


        return {
            success: true,
            changed: true,
            projectId,
            oldVersion,
            newVersion,
            status:
                'REAL_CODE_UPDATED',
            executedFiles,
            skippedFiles,
            validation:
                validationResult,
            message:
                'Real project files updated successfully.'
        };


    } catch (error) {

        // ----------------------------------------------------
        // EMERGENCY ROLLBACK
        // ----------------------------------------------------

        const rollback =
            safeRollbackProject(
                projectId,
                oldVersion
            );


        const failedProject =
            getProject(projectId);

        if (failedProject) {

            failedProject.status =
                rollback.success
                    ? 'ROLLED_BACK'
                    : 'REAL_CODE_UPDATE_FAILED';

            failedProject.updatedAt =
                now();

            saveRegistry();
        }


        return {
            success: false,
            changed: false,
            projectId,
            oldVersion,
            status:
                rollback.success
                    ? 'ROLLED_BACK'
                    : 'REAL_CODE_UPDATE_FAILED',
            error: error.message,
            rollback
        };
    }
}


// ------------------------------------------------------------
// Complete real-code autonomous loop
// ------------------------------------------------------------

async function runRealCodeAutonomousLoop(
    projectId,
    userRequest,
    maxAttempts = 3
) {

    const project =
        getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }


    let attempt = 0;
    let request =
        userRequest;

    let lastResult = null;


    while (attempt < maxAttempts) {

        attempt++;


        try {

            // ------------------------------------------------
            // READ REAL FILES + CREATE PLAN
            // ------------------------------------------------

            const analysis =
                await createRealCodeUpdatePlan(
                    projectId,
                    request
                );


            if (!analysis.success) {

                lastResult = {
                    success: false,
                    stage:
                        'REAL_CODE_ANALYSIS',
                    error:
                        analysis.error,
                    plan:
                        analysis.plan
                };

            } else {

                // --------------------------------------------
                // EXECUTE SAME PLAN
                // --------------------------------------------

                lastResult =
                    await executeRealCodePlan(
                        projectId,
                        analysis.plan
                    );
            }


            // ------------------------------------------------
            // SUCCESS
            // ------------------------------------------------

            if (lastResult.success) {

                const finalProject =
                    getProject(projectId);

                finalProject.status =
                    'AUTONOMOUS_CODE_SUCCESS';

                finalProject.updatedAt =
                    now();

                saveRegistry();


                return {
                    success: true,
                    projectId,
                    attempts: attempt,
                    status:
                        'AUTONOMOUS_CODE_SUCCESS',
                    result:
                        lastResult
                };
            }


            // ------------------------------------------------
            // PREPARE REPAIR REQUEST
            // ------------------------------------------------

            request = `
Original user request:
${userRequest}

The previous real-code implementation failed.

Failure:
${JSON.stringify(
    lastResult,
    null,
    2
)}

Create a corrected plan by inspecting the CURRENT
project files again.

IMPORTANT:
- Do not assume the old code is unchanged.
- Read the actual current files.
- Preserve working functionality.
- Fix only the problem.
- Do not introduce unrelated changes.
`;
            

        } catch (error) {

            lastResult = {
                success: false,
                error: error.message
            };


            request = `
Original user request:
${userRequest}

Previous attempt failed with:
${error.message}

Inspect the CURRENT project files and create
a safer corrected implementation plan.
`;
        }
    }


    // --------------------------------------------------------
    // FINAL FAILURE
    // --------------------------------------------------------

    const failedProject =
        getProject(projectId);

    if (failedProject) {

        failedProject.status =
            'AUTONOMOUS_CODE_FAILED';

        failedProject.updatedAt =
            now();

        saveRegistry();
    }


    return {
        success: false,
        projectId,
        attempts: attempt,
        status:
            'AUTONOMOUS_CODE_FAILED',
        lastResult,
        message:
            'Real-code autonomous execution failed after all attempts.'
    };
}


// ============================================================
// API — REAL CODE AUTONOMOUS UPDATE
// ============================================================

router.post(
    '/real-autonomous-update/:id',
    async (req, res) => {

        try {

            const { id } =
                req.params;


            const userRequest =
                cleanText(
                    req.body?.prompt ||
                    req.body?.request ||
                    req.body?.instruction ||
                    req.body?.change ||
                    ''
                );


            if (!userRequest) {

                return res.status(400).json({
                    success: false,
                    error:
                        'Please provide a change request.'
                });
            }


            const result =
                await runRealCodeAutonomousLoop(
                    id,
                    userRequest,
                    3
                );


            res.json(result);


        } catch (error) {

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);


// ============================================================
// END PART 4N
// ============================================================
// ============================================================
// PART 4O — ADVANCED PROJECT VALIDATION ENGINE
// HTML + CSS + JS + JSON + FILE REFERENCES + ROUTES
// ============================================================


// ------------------------------------------------------------
// Read all project files for validation
// ------------------------------------------------------------

function getAllProjectFilesForValidation(projectId) {

    const directory =
        projectDirectory(projectId);

    if (!fs.existsSync(directory)) {
        throw new Error(
            'Project directory not found'
        );
    }

    const results = [];

    function walk(currentDirectory) {

        const entries =
            fs.readdirSync(
                currentDirectory,
                { withFileTypes: true }
            );

        for (const entry of entries) {

            if (
                entry.name === 'node_modules' ||
                entry.name === '.git' ||
                entry.name === '.versions'
            ) {
                continue;
            }

            const fullPath =
                path.join(
                    currentDirectory,
                    entry.name
                );

            if (entry.isDirectory()) {

                walk(fullPath);

            } else {

                const relativePath =
                    path.relative(
                        directory,
                        fullPath
                    );

                results.push({
                    path: relativePath,
                    fullPath
                });
            }
        }
    }

    walk(directory);

    return results;
}


// ------------------------------------------------------------
// Validate HTML files
// ------------------------------------------------------------

function validateHTMLFile(
    fullPath,
    relativePath
) {

    const errors = [];
    const warnings = [];

    let content;

    try {

        content =
            fs.readFileSync(
                fullPath,
                'utf8'
            );

    } catch (error) {

        return {
            file: relativePath,
            valid: false,
            errors: [
                'Could not read HTML file'
            ],
            warnings: []
        };
    }


    if (!/<html[\s>]/i.test(content)) {

        warnings.push(
            'HTML document does not contain <html>'
        );
    }


    if (!/<head[\s>]/i.test(content)) {

        warnings.push(
            'Missing <head>'
        );
    }


    if (!/<body[\s>]/i.test(content)) {

        warnings.push(
            'Missing <body>'
        );
    }


    const scriptMatches =
        content.match(
            /<script[^>]+src=["']([^"']+)["']/gi
        ) || [];


    for (const tag of scriptMatches) {

        const match =
            tag.match(
                /src=["']([^"']+)["']/i
            );

        if (!match) continue;

        const src =
            match[1];

        if (
            src.startsWith('http://') ||
            src.startsWith('https://') ||
            src.startsWith('//') ||
            src.startsWith('data:')
        ) {
            continue;
        }

        const target =
            path.resolve(
                path.dirname(fullPath),
                src
            );

        if (!fs.existsSync(target)) {

            errors.push(
                `Missing script reference: ${src}`
            );
        }
    }


    const linkMatches =
        content.match(
            /<link[^>]+href=["']([^"']+)["']/gi
        ) || [];


    for (const tag of linkMatches) {

        const match =
            tag.match(
                /href=["']([^"']+)["']/i
            );

        if (!match) continue;

        const href =
            match[1];

        if (
            href.startsWith('http://') ||
            href.startsWith('https://') ||
            href.startsWith('//') ||
            href.startsWith('#') ||
            href.startsWith('mailto:')
        ) {
            continue;
        }

        const target =
            path.resolve(
                path.dirname(fullPath),
                href
            );

        if (!fs.existsSync(target)) {

            errors.push(
                `Missing link reference: ${href}`
            );
        }
    }


    const imageMatches =
        content.match(
            /<(?:img|source)[^>]+src=["']([^"']+)["']/gi
        ) || [];


    for (const tag of imageMatches) {

        const match =
            tag.match(
                /src=["']([^"']+)["']/i
            );

        if (!match) continue;

        const src =
            match[1];

        if (
            src.startsWith('http://') ||
            src.startsWith('https://') ||
            src.startsWith('data:')
        ) {
            continue;
        }

        const target =
            path.resolve(
                path.dirname(fullPath),
                src
            );

        if (!fs.existsSync(target)) {

            errors.push(
                `Missing image reference: ${src}`
            );
        }
    }


    return {
        file: relativePath,
        valid: errors.length === 0,
        errors,
        warnings
    };
}


// ------------------------------------------------------------
// Validate CSS files
// ------------------------------------------------------------

function validateCSSFile(
    fullPath,
    relativePath
) {

    const errors = [];
    const warnings = [];

    let content;

    try {

        content =
            fs.readFileSync(
                fullPath,
                'utf8'
            );

    } catch (error) {

        return {
            file: relativePath,
            valid: false,
            errors: [
                'Could not read CSS file'
            ],
            warnings: []
        };
    }


    let braces = 0;

    for (const char of content) {

        if (char === '{') braces++;

        if (char === '}') braces--;

        if (braces < 0) {

            errors.push(
                'Unexpected closing CSS brace'
            );

            break;
        }
    }


    if (braces !== 0) {

        errors.push(
            'Unbalanced CSS braces'
        );
    }


    if (
        content.includes(
            '!important !important'
        )
    ) {

        warnings.push(
            'Repeated !important detected'
        );
    }


    return {
        file: relativePath,
        valid: errors.length === 0,
        errors,
        warnings
    };
}


// ------------------------------------------------------------
// Validate JavaScript files
// ------------------------------------------------------------

function validateJSFile(
    fullPath,
    relativePath
) {

    const errors = [];
    const warnings = [];

    let content;

    try {

        content =
            fs.readFileSync(
                fullPath,
                'utf8'
            );

    } catch (error) {

        return {
            file: relativePath,
            valid: false,
            errors: [
                'Could not read JavaScript file'
            ],
            warnings: []
        };
    }


    try {

        // Basic syntax validation
        new Function(content);

    } catch (error) {

        errors.push(
            `JavaScript syntax error: ${error.message}`
        );
    }


    // Detect obvious unresolved merge markers
    if (
        content.includes(
            '<<<<<<< HEAD'
        ) ||
        content.includes(
            '>>>>>>>'
        ) ||
        content.includes(
            '======='
        )
    ) {

        errors.push(
            'Possible unresolved merge conflict markers'
        );
    }


    // Warn about accidental debug code
    if (
        content.includes(
            'debugger;'
        )
    ) {

        warnings.push(
            'debugger statement detected'
        );
    }


    return {
        file: relativePath,
        valid: errors.length === 0,
        errors,
        warnings
    };
}


// ------------------------------------------------------------
// Validate JSON files
// ------------------------------------------------------------

function validateJSONFile(
    fullPath,
    relativePath
) {

    const errors = [];
    const warnings = [];

    let content;

    try {

        content =
            fs.readFileSync(
                fullPath,
                'utf8'
            );

    } catch (error) {

        return {
            file: relativePath,
            valid: false,
            errors: [
                'Could not read JSON file'
            ],
            warnings: []
        };
    }


    try {

        JSON.parse(content);

    } catch (error) {

        errors.push(
            `Invalid JSON: ${error.message}`
        );
    }


    return {
        file: relativePath,
        valid: errors.length === 0,
        errors,
        warnings
    };
}


// ------------------------------------------------------------
// Detect broken local HTML links
// ------------------------------------------------------------

function validateLocalHTMLReferences(
    projectId
) {

    const directory =
        projectDirectory(projectId);

    const files =
        getAllProjectFilesForValidation(
            projectId
        );

    const errors = [];
    const warnings = [];


    for (const file of files) {

        if (
            path.extname(file.path)
                .toLowerCase() !== '.html'
        ) {
            continue;
        }


        let content;

        try {

            content =
                fs.readFileSync(
                    file.fullPath,
                    'utf8'
                );

        } catch {
            continue;
        }


        const hrefMatches =
            content.match(
                /href=["']([^"']+)["']/gi
            ) || [];


        for (const tag of hrefMatches) {

            const match =
                tag.match(
                    /href=["']([^"']+)["']/i
                );

            if (!match) continue;

            const href =
                match[1];


            if (
                href.startsWith('http://') ||
                href.startsWith('https://') ||
                href.startsWith('//') ||
                href.startsWith('#') ||
                href.startsWith('mailto:') ||
                href.startsWith('tel:')
            ) {
                continue;
            }


            const cleanHref =
                href.split('#')[0]
                    .split('?')[0];


            if (!cleanHref) continue;


            const target =
                path.resolve(
                    path.dirname(
                        file.fullPath
                    ),
                    cleanHref
                );


            const relativeTarget =
                path.relative(
                    directory,
                    target
                );


            if (
                relativeTarget.startsWith('..') ||
                path.isAbsolute(relativeTarget)
            ) {

                errors.push({
                    file: file.path,
                    reference: href,
                    reason:
                        'Reference points outside project'
                });

                continue;
            }


            if (!fs.existsSync(target)) {

                errors.push({
                    file: file.path,
                    reference: href,
                    reason:
                        'Referenced file does not exist'
                });
            }
        }
    }


    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}


// ------------------------------------------------------------
// Check important project files
// ------------------------------------------------------------

function validateProjectStructure(
    projectId
) {

    const directory =
        projectDirectory(projectId);

    const requiredFiles = [
        'index.html'
    ];

    const missing = [];

    for (const file of requiredFiles) {

        if (
            !fs.existsSync(
                path.join(
                    directory,
                    file
                )
            )
        ) {

            missing.push(file);
        }
    }


    return {
        valid:
            missing.length === 0,
        missing
    };
}


// ------------------------------------------------------------
// COMPLETE ADVANCED VALIDATION
// ------------------------------------------------------------

async function runAdvancedProjectValidation(
    projectId
) {

    const project =
        getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }


    const files =
        getAllProjectFilesForValidation(
            projectId
        );


    const fileResults = [];

    let errorCount = 0;
    let warningCount = 0;


    // --------------------------------------------------------
    // File-by-file validation
    // --------------------------------------------------------

    for (const file of files) {

        const extension =
            path.extname(file.path)
                .toLowerCase();


        let result = null;


        if (extension === '.html') {

            result =
                validateHTMLFile(
                    file.fullPath,
                    file.path
                );

        } else if (extension === '.css') {

            result =
                validateCSSFile(
                    file.fullPath,
                    file.path
                );

        } else if (
            extension === '.js' ||
            extension === '.cjs'
        ) {

            result =
                validateJSFile(
                    file.fullPath,
                    file.path
                );

        } else if (extension === '.json') {

            result =
                validateJSONFile(
                    file.fullPath,
                    file.path
                );
        }


        if (result) {

            errorCount +=
                result.errors.length;

            warningCount +=
                result.warnings.length;

            fileResults.push(result);
        }
    }


    // --------------------------------------------------------
    // Project structure
    // --------------------------------------------------------

    const structure =
        validateProjectStructure(
            projectId
        );


    errorCount +=
        structure.missing.length;


    // --------------------------------------------------------
    // Local references
    // --------------------------------------------------------

    const references =
        validateLocalHTMLReferences(
            projectId
        );


    errorCount +=
        references.errors.length;

    warningCount +=
        references.warnings.length;


    // --------------------------------------------------------
    // Final result
    // --------------------------------------------------------

    const success =
        errorCount === 0;


    return {
        success,
        projectId,
        projectName:
            project.name,
        version:
            project.version,
        checkedFiles:
            files.length,
        errorCount,
        warningCount,
        structure,
        references,
        files:
            fileResults,
        checkedAt:
            now(),
        status:
            success
                ? 'VALID'
                : 'INVALID'
    };
}


// ============================================================
// API — ADVANCED VALIDATION
// ============================================================

router.get(
    '/advanced-validate/:id',
    async (req, res) => {

        try {

            const result =
                await runAdvancedProjectValidation(
                    req.params.id
                );


            res.json(result);


        } catch (error) {

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);


// ============================================================
// API — VALIDATION SUMMARY
// ============================================================

router.get(
    '/validation-summary/:id',
    async (req, res) => {

        try {

            const result =
                await runAdvancedProjectValidation(
                    req.params.id
                );


            res.json({
                success:
                    result.success,

                projectId:
                    result.projectId,

                projectName:
                    result.projectName,

                version:
                    result.version,

                checkedFiles:
                    result.checkedFiles,

                errors:
                    result.errorCount,

                warnings:
                    result.warningCount,

                status:
                    result.status,

                checkedAt:
                    result.checkedAt
            });


        } catch (error) {

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);


// ============================================================
// END PART 4O
// ============================================================
// ============================================================
// PART 4P — ADVANCED VALIDATION + AUTONOMOUS REPAIR
// ============================================================


// ------------------------------------------------------------
// Run all validation layers together
// ------------------------------------------------------------

async function runCompleteProjectValidation(projectId) {

    const basicResult =
        await validateAfterUpdate(projectId);

    let advancedResult;

    try {

        advancedResult =
            await runAdvancedProjectValidation(
                projectId
            );

    } catch (error) {

        advancedResult = {
            success: false,
            error: error.message,
            status: 'VALIDATION_ERROR'
        };
    }


    const basicSuccess =
        basicResult &&
        basicResult.success === true;

    const advancedSuccess =
        advancedResult &&
        advancedResult.success === true;


    return {

        success:
            basicSuccess &&
            advancedSuccess,

        projectId,

        basicValidation: basicResult,

        advancedValidation:
            advancedResult,

        summary: {

            basic:
                basicSuccess
                    ? 'PASS'
                    : 'FAIL',

            advanced:
                advancedSuccess
                    ? 'PASS'
                    : 'FAIL',

            final:
                basicSuccess &&
                advancedSuccess
                    ? 'PASS'
                    : 'FAIL'
        },

        checkedAt: now()
    };
}


// ------------------------------------------------------------
// Build repair information from validation errors
// ------------------------------------------------------------

function buildValidationRepairRequest(
    userRequest,
    validation
) {

    return `
ORIGINAL USER REQUEST:
${userRequest}

THE GENERATED PROJECT FAILED VALIDATION.

VALIDATION RESULT:
${JSON.stringify(
    validation,
    null,
    2
)}

Create a NEW corrected implementation plan.

IMPORTANT RULES:

1. Inspect the CURRENT project files again.
2. Fix the actual validation errors.
3. Preserve all existing working features.
4. Do not undo the user's requested feature.
5. Do not make unrelated changes.
6. Fix missing files/references if required.
7. Fix JavaScript syntax errors.
8. Fix JSON syntax errors.
9. Fix HTML reference errors.
10. Fix CSS syntax errors.
11. Never use absolute paths.
12. Never expose API keys or secrets.
13. Return ONLY valid JSON.
`;
}


// ------------------------------------------------------------
// Execute real-code update + complete validation
// ------------------------------------------------------------

async function executeValidatedRealCodePlan(
    projectId,
    plan,
    userRequest
) {

    const project =
        getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }


    const execution =
        await executeRealCodePlan(
            projectId,
            plan
        );


    if (!execution.success) {

        return {
            success: false,
            stage: 'EXECUTION',
            execution
        };
    }


    // --------------------------------------------------------
    // Complete validation
    // --------------------------------------------------------

    const validation =
        await runCompleteProjectValidation(
            projectId
        );


    if (!validation.success) {

        return {
            success: false,
            stage: 'VALIDATION',
            execution,
            validation,
            repairRequest:
                buildValidationRepairRequest(
                    userRequest,
                    validation
                )
        };
    }


    return {
        success: true,
        stage: 'COMPLETE',
        execution,
        validation
    };
}


// ------------------------------------------------------------
// Autonomous repair using CURRENT project files
// ------------------------------------------------------------

async function runAdvancedAutonomousRepair(
    projectId,
    originalRequest,
    failedResult
) {

    const repairRequest =
        buildValidationRepairRequest(
            originalRequest,
            failedResult.validation ||
            failedResult
        );


    // --------------------------------------------------------
    // Read CURRENT files and create NEW plan
    // --------------------------------------------------------

    const analysis =
        await createRealCodeUpdatePlan(
            projectId,
            repairRequest
        );


    if (!analysis.success) {

        return {
            success: false,
            stage: 'REPAIR_ANALYSIS',
            error:
                analysis.error,
            analysis
        };
    }


    // --------------------------------------------------------
    // Execute NEW repair plan
    // --------------------------------------------------------

    const repairExecution =
        await executeRealCodePlan(
            projectId,
            analysis.plan
        );


    if (!repairExecution.success) {

        return {
            success: false,
            stage: 'REPAIR_EXECUTION',
            analysis,
            execution:
                repairExecution
        };
    }


    // --------------------------------------------------------
    // Validate repaired project
    // --------------------------------------------------------

    const repairedValidation =
        await runCompleteProjectValidation(
            projectId
        );


    if (!repairedValidation.success) {

        return {
            success: false,
            stage: 'REPAIR_VALIDATION',
            analysis,
            execution:
                repairExecution,
            validation:
                repairedValidation
        };
    }


    return {
        success: true,
        stage: 'REPAIRED',
        analysis,
        execution:
            repairExecution,
        validation:
            repairedValidation
    };
}


// ============================================================
// FULL AUTONOMOUS ENGINE
// ============================================================

async function runProductionAutonomousLoop(
    projectId,
    userRequest,
    maxAttempts = 3
) {

    const project =
        getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }


    let attempt = 0;

    let currentRequest =
        userRequest;

    let lastResult = null;

    const history = [];


    while (attempt < maxAttempts) {

        attempt++;


        try {

            // ------------------------------------------------
            // STEP 1 — READ CURRENT REAL CODE
            // ------------------------------------------------

            const analysis =
                await createRealCodeUpdatePlan(
                    projectId,
                    currentRequest
                );


            history.push({
                attempt,
                stage:
                    'ANALYSIS',
                result:
                    analysis
            });


            if (!analysis.success) {

                lastResult = {
                    success: false,
                    stage:
                        'ANALYSIS',
                    error:
                        analysis.error
                };

            } else {

                // --------------------------------------------
                // STEP 2 — EXECUTE EXACT AI PLAN
                // --------------------------------------------

                lastResult =
                    await executeValidatedRealCodePlan(
                        projectId,
                        analysis.plan,
                        userRequest
                    );


                history.push({
                    attempt,
                    stage:
                        'EXECUTION_VALIDATION',
                    result:
                        lastResult
                });
            }


            // ------------------------------------------------
            // SUCCESS
            // ------------------------------------------------

            if (lastResult.success) {

                const finalProject =
                    getProject(projectId);

                finalProject.status =
                    'AUTONOMOUS_PRODUCTION_READY';

                finalProject.updatedAt =
                    now();

                saveRegistry();


                return {

                    success: true,

                    projectId,

                    attempts: attempt,

                    status:
                        'AUTONOMOUS_PRODUCTION_READY',

                    version:
                        finalProject.version,

                    history,

                    result:
                        lastResult,

                    message:
                        'Autonomous update completed and all validation layers passed.'
                };
            }


            // ------------------------------------------------
            // STEP 3 — AI REPAIR
            // ------------------------------------------------

            if (
                lastResult.stage ===
                'VALIDATION'
            ) {

                const repair =
                    await runAdvancedAutonomousRepair(
                        projectId,
                        userRequest,
                        lastResult
                    );


                history.push({
                    attempt,
                    stage:
                        'AI_REPAIR',
                    result:
                        repair
                });


                if (repair.success) {

                    const finalProject =
                        getProject(projectId);

                    finalProject.status =
                        'AUTONOMOUS_REPAIRED';

                    finalProject.updatedAt =
                        now();

                    saveRegistry();


                    return {

                        success: true,

                        projectId,

                        attempts: attempt,

                        status:
                            'AUTONOMOUS_REPAIRED',

                        version:
                            finalProject.version,

                        history,

                        result:
                            repair,

                        message:
                            'Project was automatically repaired and passed validation.'
                    };
                }


                lastResult =
                    repair;
            }


            // ------------------------------------------------
            // PREPARE NEXT ATTEMPT
            // ------------------------------------------------

            currentRequest = `
Original user request:

${userRequest}

The current project still has problems.

Latest result:

${JSON.stringify(
    lastResult,
    null,
    2
)}

Inspect the CURRENT project files again.

Create the smallest safe correction required
to complete the original request.

Do not remove working features.
Do not make unrelated changes.
`;


        } catch (error) {

            lastResult = {
                success: false,
                stage: 'SYSTEM_ERROR',
                error: error.message
            };


            history.push({
                attempt,
                stage:
                    'SYSTEM_ERROR',
                result:
                    lastResult
            });
        }
    }


    // --------------------------------------------------------
    // FINAL FAILURE
    // --------------------------------------------------------

    const failedProject =
        getProject(projectId);

    if (failedProject) {

        failedProject.status =
            'AUTONOMOUS_VALIDATION_FAILED';

        failedProject.updatedAt =
            now();

        saveRegistry();
    }


    return {

        success: false,

        projectId,

        attempts: attempt,

        status:
            'AUTONOMOUS_VALIDATION_FAILED',

        history,

        lastResult,

        message:
            'Autonomous engine could not produce a fully validated project.'
    };
}


// ============================================================
// API — PRODUCTION AUTONOMOUS UPDATE
// ============================================================

router.post(
    '/production-autonomous/:id',
    async (req, res) => {

        try {

            const { id } =
                req.params;


            const userRequest =
                cleanText(
                    req.body?.prompt ||
                    req.body?.request ||
                    req.body?.instruction ||
                    req.body?.change ||
                    ''
                );


            if (!userRequest) {

                return res.status(400).json({

                    success: false,

                    error:
                        'Please provide a user request.'
                });
            }


            const result =
                await runProductionAutonomousLoop(
                    id,
                    userRequest,
                    3
                );


            res.json(result);


        } catch (error) {

            res.status(500).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);


// ============================================================
// API — COMPLETE VALIDATION
// ============================================================

router.get(
    '/complete-validation/:id',
    async (req, res) => {

        try {

            const result =
                await runCompleteProjectValidation(
                    req.params.id
                );


            res.json(result);


        } catch (error) {

            res.status(500).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);


// ============================================================
// API — REPAIR PROJECT
// ============================================================

router.post(
    '/repair/:id',
    async (req, res) => {

        try {

            const { id } =
                req.params;


            const request =
                cleanText(
                    req.body?.prompt ||
                    req.body?.request ||
                    req.body?.instruction ||
                    'Fix all project validation errors.'
                );


            const validation =
                await runCompleteProjectValidation(
                    id
                );


            if (validation.success) {

                return res.json({

                    success: true,

                    repaired: false,

                    status:
                        'ALREADY_VALID',

                    validation
                });
            }


            const repair =
                await runAdvancedAutonomousRepair(
                    id,
                    request,
                    {
                        validation
                    }
                );


            res.json({

                success:
                    repair.success,

                projectId: id,

                repair
            });


        } catch (error) {

            res.status(500).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);


// ============================================================
// END PART 4P
// ============================================================
// ============================================================
// PART 4Q — ROLLBACK-SAFE PRODUCTION AUTONOMOUS ENGINE
// ============================================================

/**
 * Part 4Q goals:
 * 1. हर production attempt से पहले complete backup
 * 2. Code update सफल लेकिन validation fail → automatic rollback
 * 3. Repair attempt fail → repair से पहले वाली state restore
 * 4. Successful validation के बाद ही final production status
 * 5. Same project पर autonomous loop को safer बनाना
 */

// ------------------------------------------------------------
// 4Q.1 — Get current project version safely
// ------------------------------------------------------------

function getCurrentProjectVersion(projectId) {
    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const version = Number(project.version || 1);

    if (!Number.isFinite(version) || version < 1) {
        return 1;
    }

    return Math.floor(version);
}


// ------------------------------------------------------------
// 4Q.2 — Create a complete attempt checkpoint
// ------------------------------------------------------------

function createAttemptCheckpoint(projectId, label = 'attempt') {
    const project = getProject(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const currentVersion = getCurrentProjectVersion(projectId);

    // Complete backup of current files + project state
    createFullProjectBackup(projectId);

    return {
        projectId,
        version: currentVersion,
        label,
        createdAt: now()
    };
}


// ------------------------------------------------------------
// 4Q.3 — Rollback to checkpoint
// ------------------------------------------------------------

function rollbackToCheckpoint(projectId, checkpoint) {
    if (!checkpoint || !checkpoint.version) {
        throw new Error('Invalid rollback checkpoint');
    }

    const result = safeRollbackProject(
        projectId,
        checkpoint.version
    );

    return {
        success: !!result.success,
        projectId,
        restoredVersion: checkpoint.version,
        result
    };
}


// ------------------------------------------------------------
// 4Q.4 — Validate current project completely
// ------------------------------------------------------------

async function validateCurrentProductionState(projectId) {
    try {
        const validation = await runCompleteProjectValidation(projectId);

        return {
            success: !!validation.success,
            validation
        };
    } catch (error) {
        return {
            success: false,
            validation: {
                success: false,
                errors: [error.message]
            }
        };
    }
}


// ------------------------------------------------------------
// 4Q.5 — Execute one rollback-safe AI update attempt
// ------------------------------------------------------------

async function executeRollbackSafeAttempt(
    projectId,
    userRequest
) {
    let checkpoint = null;

    try {
        // ----------------------------------------------------
        // STEP 1 — Check project
        // ----------------------------------------------------

        const project = getProject(projectId);

        if (!project) {
            throw new Error('Project not found');
        }

        // ----------------------------------------------------
        // STEP 2 — Create checkpoint BEFORE modification
        // ----------------------------------------------------

        checkpoint = createAttemptCheckpoint(
            projectId,
            'production-attempt'
        );

        updateProjectStatus(
            projectId,
            'AUTONOMOUS_ATTEMPT_RUNNING',
            {
                attemptStartedAt: now(),
                checkpointVersion: checkpoint.version
            }
        );

        // ----------------------------------------------------
        // STEP 3 — Create fresh real-code plan
        // ----------------------------------------------------

        const plan = await createRealCodeUpdatePlan(
            projectId,
            userRequest
        );

        if (!plan || !plan.success) {
            throw new Error(
                plan?.error ||
                'AI failed to create a valid code update plan'
            );
        }

        // ----------------------------------------------------
        // STEP 4 — Execute the plan
        // ----------------------------------------------------

        const execution = await executeRealCodePlan(
            projectId,
            plan.plan || plan
        );

        if (!execution || !execution.success) {
            throw new Error(
                execution?.error ||
                'Real code update execution failed'
            );
        }

        // ----------------------------------------------------
        // STEP 5 — Complete validation
        // ----------------------------------------------------

        const validation =
            await validateCurrentProductionState(projectId);

        if (!validation.success) {

            // IMPORTANT:
            // Update succeeded but validation failed.
            // Restore the exact previous checkpoint.

            const rollback =
                rollbackToCheckpoint(
                    projectId,
                    checkpoint
                );

            updateProjectStatus(
                projectId,
                'AUTONOMOUS_VALIDATION_FAILED_ROLLED_BACK',
                {
                    failedAt: now(),
                    rollbackVersion: checkpoint.version
                }
            );

            return {
                success: false,
                rolledBack: rollback.success,
                reason: 'VALIDATION_FAILED',
                checkpoint,
                validation,
                rollback
            };
        }

        // ----------------------------------------------------
        // STEP 6 — Production success
        // ----------------------------------------------------

        updateProjectStatus(
            projectId,
            'AUTONOMOUS_PRODUCTION_READY',
            {
                productionReadyAt: now(),
                validatedVersion:
                    getCurrentProjectVersion(projectId)
            }
        );

        return {
            success: true,
            rolledBack: false,
            status: 'AUTONOMOUS_PRODUCTION_READY',
            checkpoint,
            execution,
            validation
        };

    } catch (error) {

        // ----------------------------------------------------
        // STEP 7 — Any unexpected failure → rollback
        // ----------------------------------------------------

        let rollback = null;

        if (checkpoint) {
            try {
                rollback =
                    rollbackToCheckpoint(
                        projectId,
                        checkpoint
                    );
            } catch (rollbackError) {
                rollback = {
                    success: false,
                    error: rollbackError.message
                };
            }
        }

        updateProjectStatus(
            projectId,
            'AUTONOMOUS_ATTEMPT_FAILED',
            {
                failedAt: now(),
                error: error.message,
                rollbackAttempted: !!checkpoint,
                rollbackSuccess:
                    rollback?.success || false
            }
        );

        return {
            success: false,
            rolledBack: rollback?.success || false,
            error: error.message,
            checkpoint,
            rollback
        };
    }
}


// ------------------------------------------------------------
// 4Q.6 — Rollback-safe repair attempt
// ------------------------------------------------------------

async function executeRollbackSafeRepair(
    projectId,
    repairRequest
) {
    let checkpoint = null;

    try {

        // ----------------------------------------------------
        // STEP 1 — New checkpoint before repair
        // ----------------------------------------------------

        checkpoint = createAttemptCheckpoint(
            projectId,
            'repair-attempt'
        );

        updateProjectStatus(
            projectId,
            'AUTONOMOUS_REPAIR_RUNNING',
            {
                repairStartedAt: now(),
                checkpointVersion: checkpoint.version
            }
        );

        // ----------------------------------------------------
        // STEP 2 — Generate fresh repair plan
        // ----------------------------------------------------

        const plan = await createRealCodeUpdatePlan(
            projectId,
            repairRequest
        );

        if (!plan || !plan.success) {
            throw new Error(
                plan?.error ||
                'AI failed to create repair plan'
            );
        }

        // ----------------------------------------------------
        // STEP 3 — Execute repair
        // ----------------------------------------------------

        const execution =
            await executeRealCodePlan(
                projectId,
                plan.plan || plan
            );

        if (!execution || !execution.success) {
            throw new Error(
                execution?.error ||
                'Repair execution failed'
            );
        }

        // ----------------------------------------------------
        // STEP 4 — Validate repair
        // ----------------------------------------------------

        const validation =
            await validateCurrentProductionState(
                projectId
            );

        if (!validation.success) {

            // Repair itself made the project invalid.
            // Restore state from BEFORE repair.

            const rollback =
                rollbackToCheckpoint(
                    projectId,
                    checkpoint
                );

            updateProjectStatus(
                projectId,
                'AUTONOMOUS_REPAIR_FAILED_ROLLED_BACK',
                {
                    repairFailedAt: now(),
                    rollbackVersion:
                        checkpoint.version
                }
            );

            return {
                success: false,
                rolledBack: rollback.success,
                reason: 'REPAIR_VALIDATION_FAILED',
                checkpoint,
                validation,
                rollback
            };
        }

        // ----------------------------------------------------
        // STEP 5 — Repair successful
        // ----------------------------------------------------

        updateProjectStatus(
            projectId,
            'AUTONOMOUS_REPAIRED',
            {
                repairedAt: now(),
                validatedVersion:
                    getCurrentProjectVersion(projectId)
            }
        );

        return {
            success: true,
            rolledBack: false,
            status: 'AUTONOMOUS_REPAIRED',
            checkpoint,
            execution,
            validation
        };

    } catch (error) {

        // ----------------------------------------------------
        // STEP 6 — Repair error → rollback
        // ----------------------------------------------------

        let rollback = null;

        if (checkpoint) {
            try {
                rollback =
                    rollbackToCheckpoint(
                        projectId,
                        checkpoint
                    );
            } catch (rollbackError) {
                rollback = {
                    success: false,
                    error: rollbackError.message
                };
            }
        }

        updateProjectStatus(
            projectId,
            'AUTONOMOUS_REPAIR_FAILED',
            {
                failedAt: now(),
                error: error.message,
                rollbackAttempted: !!checkpoint,
                rollbackSuccess:
                    rollback?.success || false
            }
        );

        return {
            success: false,
            rolledBack: rollback?.success || false,
            error: error.message,
            checkpoint,
            rollback
        };
    }
}


// ------------------------------------------------------------
// 4Q.7 — Production loop with safe rollback
// ------------------------------------------------------------

async function runRollbackSafeProductionLoop(
    projectId,
    originalRequest,
    maxAttempts = 3
) {
    const attempts = [];
    let currentRequest = originalRequest;

    for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
    ) {

        updateProjectStatus(
            projectId,
            'AUTONOMOUS_PRODUCTION_ATTEMPT',
            {
                attempt,
                maxAttempts,
                attemptStartedAt: now()
            }
        );

        const result =
            await executeRollbackSafeAttempt(
                projectId,
                currentRequest
            );

        attempts.push({
            attempt,
            type: 'UPDATE',
            result
        });

        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        if (result.success) {

            return {
                success: true,
                status: 'AUTONOMOUS_PRODUCTION_READY',
                attempts,
                finalVersion:
                    getCurrentProjectVersion(projectId)
            };
        }

        // ----------------------------------------------------
        // Build repair request from validation failure
        // ----------------------------------------------------

        let repairRequest = currentRequest;

        if (result.validation) {
            repairRequest =
                buildValidationRepairRequest(
                    currentRequest,
                    result.validation
                );
        }

        // ----------------------------------------------------
        // Repair attempt
        // ----------------------------------------------------

        const repair =
            await executeRollbackSafeRepair(
                projectId,
                repairRequest
            );

        attempts.push({
            attempt,
            type: 'REPAIR',
            result: repair
        });

        // ----------------------------------------------------
        // Repair SUCCESS
        // ----------------------------------------------------

        if (repair.success) {

            return {
                success: true,
                status: 'AUTONOMOUS_REPAIRED',
                attempts,
                finalVersion:
                    getCurrentProjectVersion(projectId)
            };
        }

        // ----------------------------------------------------
        // Prepare next attempt
        // ----------------------------------------------------

        currentRequest =
            buildValidationRepairRequest(
                repairRequest,
                repair.validation || {
                    success: false,
                    errors: [
                        repair.error ||
                        'Autonomous repair failed'
                    ]
                }
            );
    }

    // --------------------------------------------------------
    // FINAL FAILURE
    // --------------------------------------------------------

    updateProjectStatus(
        projectId,
        'AUTONOMOUS_VALIDATION_FAILED',
        {
            failedAt: now(),
            attempts: attempts.length
        }
    );

    return {
        success: false,
        status: 'AUTONOMOUS_VALIDATION_FAILED',
        attempts,
        finalVersion:
            getCurrentProjectVersion(projectId)
    };
}


// ------------------------------------------------------------
// 4Q.8 — Production endpoint
// ------------------------------------------------------------

router.post(
    '/production-safe/:id',
    async (req, res) => {

        try {

            const projectId =
                req.params.id;

            const userRequest =
                cleanText(
                    req.body?.request ||
                    req.body?.prompt ||
                    req.body?.instruction ||
                    ''
                );

            if (!userRequest) {
                return res.status(400).json({
                    success: false,
                    error:
                        'request, prompt or instruction is required'
                });
            }

            const project =
                getProject(projectId);

            if (!project) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            const maxAttempts =
                Math.min(
                    Math.max(
                        Number(
                            req.body?.maxAttempts || 3
                        ),
                        1
                    ),
                    5
                );

            const result =
                await runRollbackSafeProductionLoop(
                    projectId,
                    userRequest,
                    maxAttempts
                );

            return res.json({
                success: result.success,
                projectId,
                status: result.status,
                finalVersion:
                    result.finalVersion,
                attempts:
                    result.attempts?.length || 0,
                details: result
            });

        } catch (error) {

            console.error(
                '[PRODUCTION-SAFE ERROR]',
                error
            );

            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);


// ------------------------------------------------------------
// 4Q.9 — Manual safe rollback endpoint
// ------------------------------------------------------------

router.post(
    '/safe-rollback/:id/:version',
    async (req, res) => {

        try {

            const projectId =
                req.params.id;

            const version =
                Number(req.params.version);

            if (
                !Number.isInteger(version) ||
                version < 1
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        'Invalid version number'
                });
            }

            const project =
                getProject(projectId);

            if (!project) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            const result =
                safeRollbackProject(
                    projectId,
                    version
                );

            return res.json({
                success: !!result.success,
                projectId,
                restoredVersion: version,
                result
            });

        } catch (error) {

            console.error(
                '[SAFE ROLLBACK ERROR]',
                error
            );

            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);


// ------------------------------------------------------------
// 4Q.10 — Production Status Endpoint
// ------------------------------------------------------------

router.get(
    '/production-status/:id',
    (req, res) => {

        try {

            const project =
                getProject(req.params.id);

            if (!project) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            const currentVersion =
                getCurrentProjectVersion(project.id);

            const productionReady =
                project.status ===
                    'AUTONOMOUS_PRODUCTION_READY' ||
                project.status ===
                    'AUTONOMOUS_REPAIRED';

            return res.json({
                success: true,

                projectId: project.id,

                projectName:
                    project.name,

                status:
                    project.status,

                version:
                    currentVersion,

                updatedAt:
                    project.updatedAt || null,

                productionReady:

                    productionReady
            });

        } catch (error) {

            console.error(
                '[PRODUCTION STATUS ERROR]',
                error
            );

            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);


// ------------------------------------------------------------
// 4Q.11 — Autonomous Engine Diagnostic
// ------------------------------------------------------------

router.get(
    '/engine-status',
    (req, res) => {

        return res.json({

            success: true,

            engine:
                'SamarthAI Autonomous Engine',

            version:
                '4Q',

            status:
                'ACTIVE',

            capabilities: {

                aiCodeGeneration:
                    true,

                realCodeAnalysis:
                    true,

                automaticValidation:
                    true,

                automaticRepair:
                    true,

                rollbackProtection:
                    true,

                productionLoop:
                    true,

                androidBuild:
                    'NOT_IMPLEMENTED_YET'
            },

            message:
                'Autonomous engine is running with validation and rollback protection.',

            warning:
                'Production-ready status means the generated web project passed validation. Android APK/AAB build and Play Store publishing are separate steps.'
        });
    }
);


// ============================================================
// FINAL EXPORT — KEEP THIS AT THE VERY END OF THE FILE
// ============================================================

module.exports = router; 
