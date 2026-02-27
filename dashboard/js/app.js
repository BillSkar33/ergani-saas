/**
 * ============================================================
 * Admin Dashboard — Main App (SPA Router)
 * 
 * Διαχειρίζεται:
 * - Login/Register flow
 * - Page navigation (SPA)
 * - Modal open/close
 * ============================================================
 */

// --- DOM Elements ---
const loginPage = document.getElementById('login-page');
const registerPage = document.getElementById('register-page');
const appEl = document.getElementById('app');
const contentEl = document.getElementById('content');
const pageTitleEl = document.getElementById('page-title');
const sidebarCompany = document.getElementById('sidebar-company');

// --- Page Titles ---
const pageTitles = {
    dashboard: '📊 Dashboard',
    employees: '👥 Εργαζόμενοι',
    branches: '🏢 Παραρτήματα',
    timestamps: '📋 Βάρδιες / Ιστορικό',
    fraud: '🚨 Fraud Alerts',
    settings: '⚙️ Ρυθμίσεις',
};

// --- Page Renderers ---
const pageRenderers = {
    dashboard: renderDashboard,
    employees: renderEmployees,
    branches: renderBranches,
    timestamps: renderTimestamps,
    fraud: renderFraud,
    settings: renderSettings,
};

// --- Current Page ---
let currentPage = 'dashboard';

/**
 * Πλοήγηση σε σελίδα
 */
async function navigateTo(page) {
    currentPage = page;
    pageTitleEl.textContent = pageTitles[page] || page;

    // Ενημέρωση active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    // Φόρτωση indicator
    contentEl.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Φόρτωση...</p></div>';

    // Render σελίδα
    const renderer = pageRenderers[page];
    if (renderer) {
        contentEl.innerHTML = await renderer();
    }
}

/**
 * Εμφάνιση app (μετά login)
 */
function showApp() {
    loginPage.classList.add('hidden');
    registerPage.classList.add('hidden');
    appEl.classList.remove('hidden');
    sidebarCompany.textContent = currentEmployer?.companyName || '';
    navigateTo('dashboard');
}

/**
 * Εμφάνιση login
 */
function showLogin() {
    loginPage.classList.remove('hidden');
    registerPage.classList.add('hidden');
    appEl.classList.add('hidden');
}

// --- Modal ---
function openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

// --- Event Listeners ---

// Login form
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    try {
        btn.disabled = true;
        btn.textContent = 'Σύνδεση...';
        errorEl.classList.add('hidden');
        await login(email, password);
        showApp();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Σύνδεση';
    }
});

// Register form
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('register-error');
    try {
        errorEl.classList.add('hidden');
        await register(
            document.getElementById('reg-email').value,
            document.getElementById('reg-password').value,
            document.getElementById('reg-company').value,
            document.getElementById('reg-afm').value,
        );
        showApp();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
    }
});

// Show register / login toggle
document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    loginPage.classList.add('hidden');
    registerPage.classList.remove('hidden');
});
document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    registerPage.classList.add('hidden');
    loginPage.classList.remove('hidden');
});

// Navigation clicks
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.page);
    });
});

// Logout
document.getElementById('logout-btn').addEventListener('click', logout);

// Modal close
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});

// --- Initial Load ---
if (isLoggedIn()) {
    showApp();
} else {
    showLogin();
}
