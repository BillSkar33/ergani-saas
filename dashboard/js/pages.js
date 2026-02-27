/**
 * ============================================================
 * Admin Dashboard — Page Renderers
 * 
 * Κάθε function επιστρέφει HTML string για μια σελίδα.
 * Καλούνται από τον router στο app.js
 * ============================================================
 */

// ============================================================
// 📊 DASHBOARD PAGE
// ============================================================
async function renderDashboard() {
    try {
        const stats = await api_get('/dashboard/stats');
        return `
      <div class="fade-in">
        <div class="stats-grid">
          <div class="stat-card success">
            <div class="stat-icon">✅</div>
            <div class="stat-value">${stats.today.checkIns}</div>
            <div class="stat-label">Check-ins Σήμερα</div>
          </div>
          <div class="stat-card accent">
            <div class="stat-icon">🚪</div>
            <div class="stat-value">${stats.today.checkOuts}</div>
            <div class="stat-label">Check-outs Σήμερα</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-icon">⏳</div>
            <div class="stat-value">${stats.today.openShifts}</div>
            <div class="stat-label">Ανοιχτές Βάρδιες</div>
          </div>
          <div class="stat-card danger">
            <div class="stat-icon">🚨</div>
            <div class="stat-value">${stats.alerts.fraudUnreviewed}</div>
            <div class="stat-label">Fraud Alerts</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📤</div>
            <div class="stat-value">${stats.alerts.pendingErgani}</div>
            <div class="stat-label">Εκκρεμή ΕΡΓΑΝΗ</div>
          </div>
          <div class="stat-card accent">
            <div class="stat-icon">👥</div>
            <div class="stat-value">${stats.totalEmployees}</div>
            <div class="stat-label">Ενεργοί Εργαζόμενοι</div>
          </div>
        </div>
      </div>`;
    } catch {
        return '<div class="empty-state"><div class="empty-icon">📊</div><p>Φόρτωση δεδομένων...</p></div>';
    }
}

// ============================================================
// 👥 EMPLOYEES PAGE
// ============================================================
async function renderEmployees() {
    try {
        const data = await api_get('/employees');
        const branches = await api_get('/branches');
        const branchOpts = (branches.branches || []).map(b =>
            `<option value="${b.id}">${b.name || b.branch_number}</option>`
        ).join('');

        const rows = (data.employees || []).map(e => `
      <tr>
        <td><strong>${e.eponymo} ${e.onoma}</strong></td>
        <td>${e.afm}</td>
        <td>${e.branch_name || '—'}</td>
        <td>${e.linked_platform ? `<span class="badge badge-success">${e.linked_platform}</span>` : '<span class="badge badge-neutral">Μη συνδεδεμένος</span>'}</td>
        <td><span class="badge ${e.is_active ? 'badge-success' : 'badge-danger'}">${e.is_active ? 'Ενεργός' : 'Ανενεργός'}</span></td>
        <td>${e.linking_code || '—'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="genLinkingCode('${e.id}')">🔗 Κωδικός</button>
          <button class="btn btn-ghost btn-sm" onclick="editEmployee('${e.id}')">✏️</button>
        </td>
      </tr>
    `).join('');

        return `
      <div class="fade-in">
        <div class="filters-bar">
          <input type="text" id="emp-search" placeholder="🔍 Αναζήτηση..." onkeyup="searchEmployees()">
          <button class="btn btn-primary" onclick="showAddEmployee('${branchOpts.replace(/'/g, "\\'")}')">+ Νέος Εργαζόμενος</button>
          <button class="btn btn-ghost" onclick="showCsvImport()">📄 CSV Import</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ονοματεπώνυμο</th>
                <th>ΑΦΜ</th>
                <th>Παράρτημα</th>
                <th>Messenger</th>
                <th>Κατάσταση</th>
                <th>Κωδικός</th>
                <th>Ενέργειες</th>
              </tr>
            </thead>
            <tbody id="emp-tbody">${rows || '<tr><td colspan="7"><div class="empty-state"><p>Δεν υπάρχουν εργαζόμενοι</p></div></td></tr>'}</tbody>
          </table>
        </div>
        <div style="margin-top:16px;color:var(--text-muted);font-size:0.85rem">Σύνολο: ${data.total || 0}</div>
      </div>`;
    } catch {
        return '<div class="empty-state"><div class="empty-icon">👥</div><p>Σφάλμα φόρτωσης</p></div>';
    }
}

// ============================================================
// 🏢 BRANCHES PAGE
// ============================================================
async function renderBranches() {
    try {
        const data = await api_get('/branches');
        const rows = (data.branches || []).map(b => `
      <tr>
        <td><strong>${b.name || 'Χωρίς όνομα'}</strong></td>
        <td>${b.branch_number}</td>
        <td>${b.latitude}, ${b.longitude}</td>
        <td>${b.geofence_radius_meters}m</td>
        <td>${b.employee_count || 0}</td>
        <td><span class="badge ${b.is_active ? 'badge-success' : 'badge-danger'}">${b.is_active ? 'Ενεργό' : 'Ανενεργό'}</span></td>
        <td><button class="btn btn-ghost btn-sm" onclick="editBranch('${b.id}')">✏️</button></td>
      </tr>
    `).join('');

        return `
      <div class="fade-in">
        <div class="filters-bar">
          <button class="btn btn-primary" onclick="showAddBranch()">+ Νέο Παράρτημα</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Όνομα</th><th>Αριθμός</th><th>GPS</th><th>Geofence</th><th>Εργαζόμενοι</th><th>Κατάσταση</th><th>Ενέργειες</th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="7"><div class="empty-state"><p>Δεν υπάρχουν παραρτήματα</p></div></td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
    } catch {
        return '<div class="empty-state"><div class="empty-icon">🏢</div><p>Σφάλμα φόρτωσης</p></div>';
    }
}

// ============================================================
// 📋 TIMESTAMPS PAGE
// ============================================================
async function renderTimestamps() {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    try {
        const data = await api_get(`/timestamps?dateFrom=${weekAgo}&dateTo=${today}`);
        const rows = (data.timestamps || []).map(t => {
            const dt = new Date(t.event_timestamp);
            const time = dt.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
            const date = dt.toLocaleDateString('el-GR');
            const actionIcon = t.action_type === 'check_in' ? '✅' : '🚪';
            const statusBadge = {
                pending: 'badge-warning', submitted: 'badge-info',
                confirmed: 'badge-success', failed: 'badge-danger',
            }[t.ergani_status] || 'badge-neutral';

            return `
        <tr>
          <td>${t.eponymo} ${t.onoma}</td>
          <td>${actionIcon} ${t.action_type === 'check_in' ? 'Είσοδος' : 'Έξοδος'}</td>
          <td>${date} ${time}</td>
          <td>${t.branch_name || '—'}</td>
          <td><span class="badge ${t.geofence_status === 'approved' ? 'badge-success' : t.geofence_status === 'rejected' ? 'badge-danger' : 'badge-info'}">${t.geofence_status || '—'}</span></td>
          <td><span class="badge ${statusBadge}">${t.ergani_status}</span></td>
        </tr>`;
        }).join('');

        return `
      <div class="fade-in">
        <div class="filters-bar">
          <input type="date" id="ts-from" value="${weekAgo}" onchange="filterTimestamps()">
          <input type="date" id="ts-to" value="${today}" onchange="filterTimestamps()">
          <button class="btn btn-ghost" onclick="exportCsv()">📥 Export CSV</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Εργαζόμενος</th><th>Ενέργεια</th><th>Ημ/νία Ώρα</th><th>Παράρτημα</th><th>Geofence</th><th>ΕΡΓΑΝΗ</th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="6"><div class="empty-state"><p>Δεν βρέθηκαν χρονοσημάνσεις</p></div></td></tr>'}</tbody>
          </table>
        </div>
        ${data.totalPages > 1 ? `<div class="pagination"><span class="page-info">Σελίδα ${data.page}/${data.totalPages} (${data.total} εγγραφές)</span></div>` : ''}
      </div>`;
    } catch {
        return '<div class="empty-state"><div class="empty-icon">📋</div><p>Σφάλμα φόρτωσης</p></div>';
    }
}

// ============================================================
// 🚨 FRAUD ALERTS PAGE
// ============================================================
async function renderFraud() {
    try {
        const data = await api_get('/fraud-alerts?reviewed=false');
        const rows = (data.alerts || []).map(a => {
            const sevColor = { low: 'badge-info', medium: 'badge-warning', high: 'badge-danger', critical: 'badge-danger' }[a.severity];
            const dt = new Date(a.created_at).toLocaleString('el-GR');
            return `
        <tr>
          <td>${a.eponymo} ${a.onoma}</td>
          <td>${a.alert_type}</td>
          <td><span class="badge ${sevColor}">${a.severity.toUpperCase()}</span></td>
          <td>${dt}</td>
          <td><button class="btn btn-success btn-sm" onclick="reviewAlert('${a.id}')">✅ Εξετάστηκε</button></td>
        </tr>`;
        }).join('');

        return `
      <div class="fade-in">
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Εργαζόμενος</th><th>Τύπος</th><th>Σοβαρότητα</th><th>Ημ/νία</th><th>Ενέργεια</th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">✅</div><p>Κανένα fraud alert!</p></div></td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
    } catch {
        return '<div class="empty-state"><div class="empty-icon">🚨</div><p>Σφάλμα φόρτωσης</p></div>';
    }
}

// ============================================================
// ⚙️ SETTINGS PAGE
// ============================================================
async function renderSettings() {
    try {
        const data = await api_get('/settings');
        const s = data.settings || {};

        return `
      <div class="fade-in">
        <div class="section-card">
          <h3>📬 Ρυθμίσεις Ειδοποιήσεων</h3>
          <form id="settings-form" onsubmit="saveSettings(event)">
            <div class="toggle-group">
              <label>Ειδοποίηση σε κάθε Check-in</label>
              <label class="toggle"><input type="checkbox" name="notifyEachCheckin" ${s.notify_each_checkin ? 'checked' : ''}><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-group">
              <label>Ειδοποίηση Καθυστέρησης</label>
              <label class="toggle"><input type="checkbox" name="notifyLateArrival" ${s.notify_late_arrival !== false ? 'checked' : ''}><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-group">
              <label>Ειδοποίηση Ξεχασμένου Check-out</label>
              <label class="toggle"><input type="checkbox" name="notifyMissedCheckout" ${s.notify_missed_checkout !== false ? 'checked' : ''}><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-group">
              <label>Ειδοποίηση GPS Rejection</label>
              <label class="toggle"><input type="checkbox" name="notifyGpsRejection" ${s.notify_gps_rejection !== false ? 'checked' : ''}><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-group">
              <label>Ειδοποίηση Fraud Alerts</label>
              <label class="toggle"><input type="checkbox" name="notifyFraudAlerts" ${s.notify_fraud_alerts !== false ? 'checked' : ''}><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-group">
              <label>Ειδοποίηση Σφαλμάτων ΕΡΓΑΝΗ</label>
              <label class="toggle"><input type="checkbox" name="notifyErganiErrors" ${s.notify_ergani_errors !== false ? 'checked' : ''}><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-group">
              <label>Εβδομαδιαία Σύνοψη</label>
              <label class="toggle"><input type="checkbox" name="weeklySummaryEnabled" ${s.weekly_summary_enabled !== false ? 'checked' : ''}><span class="toggle-slider"></span></label>
            </div>
            <div class="modal-actions">
              <button type="submit" class="btn btn-primary">💾 Αποθήκευση</button>
            </div>
          </form>
        </div>
        <div class="section-card">
          <h3>ℹ️ Πληροφορίες Λογαριασμού</h3>
          <p style="color:var(--text-secondary)">Email: ${currentEmployer?.email || '—'}</p>
          <p style="color:var(--text-secondary)">Εταιρεία: ${currentEmployer?.companyName || '—'}</p>
        </div>
      </div>`;
    } catch {
        return '<div class="empty-state"><p>Σφάλμα φόρτωσης ρυθμίσεων</p></div>';
    }
}

// ============================================================
// MODAL & ACTION HELPERS
// ============================================================
function showAddEmployee(branchOpts) {
    openModal('Νέος Εργαζόμενος', `
    <form onsubmit="addEmployee(event)">
      <div class="form-group"><label>Επώνυμο (ΚΕΦΑΛΑΙΑ)</label><input id="f-eponymo" required placeholder="ΠΑΠΑΔΟΠΟΥΛΟΣ"></div>
      <div class="form-group"><label>Όνομα (ΚΕΦΑΛΑΙΑ)</label><input id="f-onoma" required placeholder="ΓΕΩΡΓΙΟΣ"></div>
      <div class="form-group"><label>ΑΦΜ (9 ψηφία)</label><input id="f-afm" required pattern="\\d{9}" maxlength="9" placeholder="123456789"></div>
      <div class="form-group"><label>Παράρτημα</label><select id="f-branch"><option value="">— Επιλέξτε —</option>${branchOpts}</select></div>
      <div class="form-group"><label>Τηλέφωνο</label><input id="f-phone" placeholder="+306912345678"></div>
      <div class="form-group" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="f-external" style="width:auto"><label for="f-external" style="margin:0">Εξωτερικός εργαζόμενος</label></div>
      <div class="modal-actions"><button type="submit" class="btn btn-primary">💾 Αποθήκευση</button></div>
    </form>
  `);
}

function showAddBranch() {
    openModal('Νέο Παράρτημα', `
    <form onsubmit="addBranch(event)">
      <div class="form-group"><label>Όνομα</label><input id="b-name" required placeholder="Κεντρικό Κατάστημα"></div>
      <div class="form-group"><label>Αριθμός ΕΡΓΑΝΗ</label><input id="b-number" required placeholder="0"></div>
      <div class="form-group"><label>Latitude</label><input id="b-lat" required type="number" step="any" placeholder="37.9755"></div>
      <div class="form-group"><label>Longitude</label><input id="b-lng" required type="number" step="any" placeholder="23.7348"></div>
      <div class="form-group"><label>Geofence (μέτρα)</label><input id="b-radius" type="number" value="40" min="10" max="200"></div>
      <div class="modal-actions"><button type="submit" class="btn btn-primary">💾 Αποθήκευση</button></div>
    </form>
  `);
}

function showCsvImport() {
    openModal('Μαζική Εισαγωγή (CSV format)', `
    <p style="color:var(--text-secondary);margin-bottom:16px">Εισάγετε JSON array εργαζομένων.<br>Κάθε εγγραφή: <code>{ afm, eponymo, onoma, phone? }</code></p>
    <div class="form-group"><label>JSON Data</label>
      <textarea id="csv-data" rows="8" placeholder='[{"afm":"111111111","eponymo":"ΔΟΚΙΜΑΣΤΙΚΟΣ","onoma":"ΧΡΗΣΤΗΣ"}]'></textarea>
    </div>
    <div class="modal-actions"><button class="btn btn-primary" onclick="importCsv()">📥 Εισαγωγή</button></div>
    <div id="csv-result" style="margin-top:12px"></div>
  `);
}

async function addEmployee(e) {
    e.preventDefault();
    try {
        await api_post('/employees', {
            afm: document.getElementById('f-afm').value,
            eponymo: document.getElementById('f-eponymo').value,
            onoma: document.getElementById('f-onoma').value,
            branchId: document.getElementById('f-branch').value || null,
            phone: document.getElementById('f-phone').value || null,
            isExternalWorker: document.getElementById('f-external').checked,
        });
        closeModal();
        navigateTo('employees');
    } catch (err) { alert(err.message); }
}

async function addBranch(e) {
    e.preventDefault();
    try {
        await api_post('/branches', {
            name: document.getElementById('b-name').value,
            branchNumber: document.getElementById('b-number').value,
            latitude: parseFloat(document.getElementById('b-lat').value),
            longitude: parseFloat(document.getElementById('b-lng').value),
            geofenceRadiusMeters: parseInt(document.getElementById('b-radius').value),
        });
        closeModal();
        navigateTo('branches');
    } catch (err) { alert(err.message); }
}

async function genLinkingCode(empId) {
    try {
        const data = await api_post(`/employees/${empId}/linking-code`);
        openModal('Νέος Κωδικός Σύνδεσης', `
      <div style="text-align:center">
        <p style="color:var(--text-secondary)">Δώστε αυτόν τον κωδικό στον εργαζόμενο:</p>
        <div class="linking-code">${data.linkingCode}</div>
        <p style="font-size:0.85rem;color:var(--text-muted)">Λήγει: ${new Date(data.expiresAt).toLocaleDateString('el-GR')}</p>
      </div>
    `);
    } catch (err) { alert(err.message); }
}

async function importCsv() {
    try {
        const raw = document.getElementById('csv-data').value;
        const employees = JSON.parse(raw);
        const result = await api_post('/employees/import-csv', { employees });
        document.getElementById('csv-result').innerHTML = `
      <span class="badge badge-success">${result.success} επιτυχίες</span>
      ${result.errors.length > 0 ? `<span class="badge badge-danger">${result.errors.length} αποτυχίες</span>
      <pre style="font-size:0.8rem;margin-top:8px;color:var(--text-muted)">${JSON.stringify(result.errors, null, 2)}</pre>` : ''}`;
    } catch (err) { alert('Μη έγκυρο JSON: ' + err.message); }
}

async function reviewAlert(alertId) {
    await api_put(`/fraud-alerts/${alertId}/review`);
    navigateTo('fraud');
}

async function saveSettings(e) {
    e.preventDefault();
    const form = document.getElementById('settings-form');
    const data = {};
    form.querySelectorAll('input[type=checkbox]').forEach(cb => { data[cb.name] = cb.checked; });
    await api_put('/settings', data);
    alert('✅ Ρυθμίσεις αποθηκεύτηκαν!');
}

async function exportCsv() {
    const from = document.getElementById('ts-from')?.value;
    const to = document.getElementById('ts-to')?.value;
    window.open(`/api/admin/timestamps/export?dateFrom=${from}&dateTo=${to}`, '_blank');
}

async function filterTimestamps() {
    navigateTo('timestamps');
}

function searchEmployees() {
    // Simple client-side filter
    const q = document.getElementById('emp-search').value.toLowerCase();
    document.querySelectorAll('#emp-tbody tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}
