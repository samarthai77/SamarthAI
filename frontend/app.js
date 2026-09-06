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
    const projectName = document.getElementById('autoProjectName').value;
    const projectType = document.getElementById('autoProjectType').value;
    const domain = document.getElementById('autoDomain').value;
    const resultDiv = document.getElementById('autoResult');

    if (!projectName || !projectType) {
        alert("Please enter Project Name and Type.");
        return;
    }

    resultDiv.innerText = "Generating and running self-healing checks...";

    try {
        const response = await fetch('/api/autonomous/generate-project', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectName,
                projectType,
                domain,
                features: ["GPS", "SOS", "AI Chat", "Database Sync"]
            })
        });

        const data = await response.json();

        if (data.success) {
            resultDiv.innerHTML = `✅ <span style="color: #4ade80;">Success!</span>\n` +
                `Project: ${data.projectName}\n` +
                `Path: ${data.path}\n` +
                `Status: ${data.selfHealingStatus}\n` +
                `Ready for Play Store Export: ${data.readyForPlayStoreExport}`;
        } else {
            resultDiv.innerHTML = `❌ <span style="color: #f87171;">Error:</span> ${data.error}`;
        }
    } catch (err) {
        resultDiv.innerHTML = `❌ <span style="color: #f87171;">Network Error:</span> ${err.message}`;
    }
}
console.log('🚀 SamarthAI Frontend Loaded!');
