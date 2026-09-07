// ===== APP CONFIG =====
const API_BASE = 'https://samarthai-backend.onrender.com/api';

// ===== CHECK AUTH =====
function getToken() {
    return localStorage.getItem('token');
}

function isLoggedIn() {
    return !!getToken();
}

// ===== NAVIGATION =====
function navigateTo(page) {
    window.location.href = page;
}

// ===== LOGOUT =====
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigateTo('index.html');
}

// ===== API HELPER =====
async function apiRequest(endpoint, method = 'GET', body = null) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json'
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
        method,
        headers
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    return response.json();
}

// ===== LOAD USER PROFILE =====
async function loadProfile() {
    if (!isLoggedIn()) {
        navigateTo('index.html');
        return;
    }

    try {
        const data = await apiRequest('/auth/profile');
        if (data.error) {
            console.error('Profile error:', data.error);
            return;
        }
        document.getElementById('userName').textContent = data.name || 'User';
        document.getElementById('userEmail').textContent = data.email || '';
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// ===== RUN ON PAGE LOAD =====
document.addEventListener('DOMContentLoaded', () => {
    // Auth check for protected pages
    const protectedPages = ['dashboard.html', 'profile.html', 'chat.html', 'services.html'];
    const currentPage = window.location.pathname.split('/').pop();

    if (protectedPages.includes(currentPage) && !isLoggedIn()) {
        navigateTo('index.html');
    }

    // Load profile if on profile page
    if (currentPage === 'profile.html') {
        loadProfile();
    }
});
async function triggerAutonomousGeneration() {
    const projectName =
        document.getElementById('autoProjectName').value.trim();

    const projectType =
        document.getElementById('autoProjectType').value.trim();

    const domain =
        document.getElementById('autoDomain').value.trim();

    const resultDiv =
        document.getElementById('autoResult');

    if (!projectName || !projectType) {
        alert('Please enter Project Name and Type.');
        return;
    }

    resultDiv.innerHTML =
        '⏳ Generating project...';

    try {
        const response = await fetch(
            `${API_BASE}/autonomous/generate-project`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectName,
                    projectType,
                    domain,
                    features: [
                        'GPS',
                        'SOS',
                        'AI Chat',
                        'Database Sync'
                    ]
                })
            }
        );

        const data =
            await response.json();

        console.log(
            'Autonomous API Response:',
            data
        );

        if (data.success) {

            const project =
                data.project || {};

            resultDiv.innerHTML =
                `✅ <span style="color:#4ade80;">Success!</span><br>` +
                `Project: ${data.projectName || project.name || projectName}<br>` +
                `Project ID: ${data.projectId || project.id || 'N/A'}<br>` +
                `Pages: ${data.totalPages || (project.pages ? project.pages.length : 0)}<br>` +
                `Status: ${data.status || project.status || 'Generated'}<br>` +
                `Play Store Build: ${
                    data.readyForPlayStore === true
                        ? 'Yes'
                        : 'Not built yet'
                }<br>` +
                `Preview: ${
                    data.previewUrl
                        ? `<a href="${API_BASE.replace('/api', '')}${data.previewUrl}" target="_blank" style="color:#60a5fa;">Open Preview</a>`
                        : 'Not available'
                }`;

        } else {

            resultDiv.innerHTML =
                `❌ <span style="color:#f87171;">Error:</span> ${
                    data.error || 'Generation failed.'
                }`;
        }

    } catch (err) {

        console.error(
            'Autonomous Generation Error:',
            err
        );

        resultDiv.innerHTML =
            `❌ <span style="color:#f87171;">Network Error:</span> ${
                err.message
            }`;
    }
} 
console.log('🚀 SamarthAI Frontend Loaded!');
