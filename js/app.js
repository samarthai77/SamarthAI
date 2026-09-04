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

console.log('🚀 SamarthAI Frontend Loaded!');
