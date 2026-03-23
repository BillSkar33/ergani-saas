/**
 * ============================================================
 * Admin Dashboard — API Client
 * 
 * Κεντρικό module επικοινωνίας με το Admin REST API.
 * Διαχειρίζεται JWT tokens, authentication, και API calls.
 * ============================================================
 */

const API_BASE = '/api/admin';

/** Αποθηκευμένο JWT token */
let authToken = localStorage.getItem('auth_token') || null;

/** Πληροφορίες εργοδότη */
let currentEmployer = JSON.parse(localStorage.getItem('employer') || 'null');

/**
 * HTTP request με authentication
 */
async function apiRequest(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    // Αν 401 → logout αυτόματα
    if (response.status === 401 && authToken) {
        logout();
        return null;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || `Σφάλμα ${response.status}`);
    }

    return data;
}

/** GET request */
function api_get(path) { return apiRequest(path); }

/** POST request */
function api_post(path, body) { return apiRequest(path, { method: 'POST', body }); }

/** PUT request */
function api_put(path, body) { return apiRequest(path, { method: 'PUT', body }); }

/** DELETE request */
function api_delete(path) { return apiRequest(path, { method: 'DELETE' }); }

/**
 * Login — αποθήκευση token
 */
async function login(email, password) {
    const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password },
    });
    authToken = data.token;
    currentEmployer = data.employer;
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('employer', JSON.stringify(data.employer));
    return data;
}

/**
 * Register — εγγραφή νέου εργοδότη
 */
async function register(email, password, companyName, afmErgodoti) {
    const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: { email, password, companyName, afmErgodoti },
    });
    authToken = data.token;
    currentEmployer = data.employer;
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('employer', JSON.stringify(data.employer));
    return data;
}

/**
 * Logout — καθαρισμός token
 */
function logout() {
    authToken = null;
    currentEmployer = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('employer');
    location.reload();
}

/**
 * Έλεγχος αν ο χρήστης είναι συνδεδεμένος
 */
function isLoggedIn() {
    return !!authToken;
}
