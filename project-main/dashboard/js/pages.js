/**
 * ============================================================
 * Admin Dashboard — Page Renderers
 *
 * Κάθε function επιστρέφει HTML string για μια σελίδα.
 * Καλούνται από τον router στο app.js
 * ============================================================
 */

// Cache τελευταία φορτωμένα δεδομένα — χρησιμοποιούνται από τα edit modals
let _employees = [];
let _branches = [];

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
    _employees = data.employees || [];
    _branches = branches.branches || [];
    const branchOpts = _branches.map(b =>
      `<option value="${b.id}">${b.name || b.branch_number}</option>`
    ).join('');

    const rows = _employees.map(e => `
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
          <button class="btn btn-primary" onclick="showAddEmployee()">+ Νέος Εργαζόμενος</button>
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
    _branches = data.branches || [];
    const rows = _branches.map(b => `
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
function showAddEmployee() {
  var branchOpts = _branches.map(function(b) {
    return '<option value="' + b.id + '">' + (b.name || b.branch_number) + '</option>';
  }).join('');
  openModal('Νέος Εργαζόμενος',
    '<form onsubmit="addEmployee(event)">' +
      '<div class="form-group"><label>Επώνυμο (ΚΕΦΑΛΑΙΑ)</label><input id="f-eponymo" required placeholder="ΠΑΠΑΔΟΠΟΥΛΟΣ"></div>' +
      '<div class="form-group"><label>Όνομα (ΚΕΦΑΛΑΙΑ)</label><input id="f-onoma" required placeholder="ΓΕΩΡΓΙΟΣ"></div>' +
      '<div class="form-group"><label>ΑΦΜ (9 ψηφία)</label><input id="f-afm" required pattern="\\d{9}" maxlength="9" placeholder="123456789"></div>' +
      '<div class="form-group"><label>Παράρτημα</label><select id="f-branch"><option value="">— Επιλέξτε —</option>' + branchOpts + '</select></div>' +
      '<div class="form-group"><label>Τηλέφωνο</label><input id="f-phone" placeholder="+306912345678"></div>' +
      '<div class="form-group" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="f-external" style="width:auto"><label for="f-external" style="margin:0">Εξωτερικός εργαζόμενος</label></div>' +
      '<div class="modal-actions"><button type="submit" class="btn btn-primary">Αποθήκευση</button></div>' +
    '</form>'
  );
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

function editEmployee(id) {
  const e = _employees.find(emp => emp.id === id);
  if (!e) return alert('Δεν βρέθηκε εργαζόμενος');
  const branchOpts = _branches.map(b =>
    `<option value="${b.id}" ${e.branch_id === b.id ? 'selected' : ''}>${b.name || b.branch_number}</option>`
  ).join('');
  openModal('Επεξεργασία Εργαζομένου', `
    <form onsubmit="saveEmployee(event,'${id}')">
      <div class="form-group"><label>Επώνυμο (ΚΕΦΑΛΑΙΑ)</label><input id="ee-eponymo" required value="${e.eponymo}"></div>
      <div class="form-group"><label>Όνομα (ΚΕΦΑΛΑΙΑ)</label><input id="ee-onoma" required value="${e.onoma}"></div>
      <div class="form-group"><label>Τηλέφωνο</label><input id="ee-phone" value="${e.phone || ''}"></div>
      <div class="form-group"><label>Παράρτημα</label><select id="ee-branch"><option value="">— Χωρίς —</option>${branchOpts}</select></div>
      <div class="form-group" style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="ee-external" style="width:auto" ${e.is_external_worker ? 'checked' : ''}>
        <label for="ee-external" style="margin:0">Εξωτερικός εργαζόμενος</label>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="ee-active" style="width:auto" ${e.is_active ? 'checked' : ''}>
        <label for="ee-active" style="margin:0">Ενεργός</label>
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">💾 Αποθήκευση</button>
      </div>
    </form>
  `);
}

async function saveEmployee(evt, id) {
  evt.preventDefault();
  try {
    await api_put(`/employees/${id}`, {
      eponymo: document.getElementById('ee-eponymo').value,
      onoma: document.getElementById('ee-onoma').value,
      phone: document.getElementById('ee-phone').value || null,
      branchId: document.getElementById('ee-branch').value || null,
      isExternalWorker: document.getElementById('ee-external').checked,
      isActive: document.getElementById('ee-active').checked,
    });
    closeModal();
    navigateTo('employees');
  } catch (err) { alert(err.message); }
}

function editBranch(id) {
  const b = _branches.find(br => br.id === id);
  if (!b) return alert('Δεν βρέθηκε παράρτημα');
  openModal('Επεξεργασία Παραρτήματος', `
    <form onsubmit="saveBranch(event,'${id}')">
      <div class="form-group"><label>Όνομα</label><input id="eb-name" value="${b.name || ''}"></div>
      <div class="form-group"><label>Latitude</label><input id="eb-lat" type="number" step="any" required value="${b.latitude}"></div>
      <div class="form-group"><label>Longitude</label><input id="eb-lng" type="number" step="any" required value="${b.longitude}"></div>
      <div class="form-group"><label>Geofence (μέτρα)</label><input id="eb-radius" type="number" min="10" max="200" value="${b.geofence_radius_meters}"></div>
      <div class="form-group"><label>Max GPS ακρίβεια (μέτρα)</label><input id="eb-accuracy" type="number" value="${b.max_accuracy_meters || 100}"></div>
      <div class="form-group" style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="eb-active" style="width:auto" ${b.is_active ? 'checked' : ''}>
        <label for="eb-active" style="margin:0">Ενεργό</label>
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">💾 Αποθήκευση</button>
      </div>
    </form>
  `);
}

async function saveBranch(evt, id) {
  evt.preventDefault();
  try {
    await api_put(`/branches/${id}`, {
      name: document.getElementById('eb-name').value || null,
      latitude: parseFloat(document.getElementById('eb-lat').value),
      longitude: parseFloat(document.getElementById('eb-lng').value),
      geofenceRadiusMeters: parseInt(document.getElementById('eb-radius').value),
      maxAccuracyMeters: parseInt(document.getElementById('eb-accuracy').value),
      isActive: document.getElementById('eb-active').checked,
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

// ============================================================
// 📅 SCHEDULES PAGE (Ωράρια)
// ============================================================

// Cache ωραρίων & αναθέσεων για edit modals
var _schedules = [];
var _assignments = [];

async function renderSchedules() {
  try {
    const data = await api_get('/schedules');
    const assignments = await api_get('/schedules/assignments');
    const employees = await api_get('/employees');
    const dayNames = ['', 'Δευ', 'Τρ', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ'];

    _schedules = data.schedules || [];
    _assignments = assignments.assignments || [];
    _employees = employees.employees || [];

    const schedRows = _schedules.map(function(s) {
      const days = (s.days_of_week || []).map(function(d) { return dayNames[d]; }).join(', ');
      return '<tr>' +
                '<td><strong>' + s.name + '</strong></td>' +
                '<td>' + (s.start_time || '').slice(0, 5) + ' - ' + (s.end_time || '').slice(0, 5) + '</td>' +
                '<td>' + days + '</td>' +
                '<td>' + (s.is_night_shift ? 'Νυχτ.' : 'Ημερ.') + '</td>' +
                '<td>' + (s.grace_minutes_before || 15) + ' / ' + (s.grace_minutes_after || 10) + ' λεπ.</td>' +
                '<td>' + (s.assigned_count || 0) + '</td>' +
                '<td><button class="btn btn-ghost btn-sm" onclick="deleteSchedule(\'' + s.id + '\')">Διαγρ.</button></td>' +
            '</tr>';
    }).join('');

    const assignRows = _assignments.map(function(a) {
      const days = (a.days_of_week || []).map(function(d) { return dayNames[d]; }).join(', ');
      return '<tr>' +
                '<td><strong>' + a.eponymo + ' ' + a.onoma + '</strong></td>' +
                '<td>' + a.schedule_name + '</td>' +
                '<td>' + (a.start_time || '').slice(0, 5) + ' - ' + (a.end_time || '').slice(0, 5) + '</td>' +
                '<td>' + days + '</td>' +
                '<td>' + (a.effective_from || '—') + ' &rarr; ' + (a.effective_until || 'Μόνιμο') + '</td>' +
                '<td>' +
                  '<button class="btn btn-ghost btn-sm" onclick="editAssignment(\'' + a.id + '\')">Επεξ.</button> ' +
                  '<button class="btn btn-ghost btn-sm" onclick="removeAssignment(\'' + a.id + '\')">Διαγρ.</button>' +
                '</td>' +
            '</tr>';
    }).join('');

    return '<div class="fade-in">' +
            '<div class="section-card" style="margin-bottom:24px;">' +
                '<h3>Πρότυπα Ωραρίων</h3>' +
                '<div class="filters-bar">' +
                    '<button class="btn btn-primary" onclick="showAddSchedule()">+ Νέο Ωράριο</button>' +
                '</div>' +
                '<div class="table-wrap">' +
                    '<table><thead><tr>' +
                        '<th>Όνομα</th><th>Ώρες</th><th>Ημέρες</th><th>Τύπος</th><th>Grace</th><th>Αναθέσεις</th><th></th>' +
                    '</tr></thead>' +
                    '<tbody>' + (schedRows || '<tr><td colspan="7"><div class="empty-state"><p>Δεν υπάρχουν ωράρια</p></div></td></tr>') + '</tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +
            '<div class="section-card">' +
                '<h3>Αναθέσεις Ωραρίων</h3>' +
                '<div class="filters-bar">' +
                    '<button class="btn btn-primary" onclick="showAssignSchedule()">+ Ανάθεση</button>' +
                '</div>' +
                '<div class="table-wrap">' +
                    '<table><thead><tr>' +
                        '<th>Εργαζόμενος</th><th>Ωράριο</th><th>Ώρες</th><th>Ημέρες</th><th>Ισχύς</th><th></th>' +
                    '</tr></thead>' +
                    '<tbody>' + (assignRows || '<tr><td colspan="6"><div class="empty-state"><p>Δεν υπάρχουν αναθέσεις</p></div></td></tr>') + '</tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +
        '</div>';
  } catch (e) { return '<div class="empty-state"><div class="empty-icon">📅</div><p>Σφάλμα φόρτωσης</p></div>'; }
}

// ============================================================
// 🏖️ LEAVES PAGE (Άδειες)
// ============================================================
async function renderLeaves() {
  try {
    const data = await api_get('/leaves');
    const employees = await api_get('/employees');
    _employees = employees.employees || [];
    const typeNames = { annual: 'Κανονική', sick: 'Ασθενείας', unpaid: 'Άνευ αποδοχών', maternity: 'Μητρότητας', other: 'Άλλη' };
    const statusBadge = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' };
    const statusLbl = { pending: 'Εκκρεμεί', approved: 'Εγκεκριμένη', rejected: 'Απορρίφθηκε' };

    const rows = (data.leaves || []).map(function(l) {
      var actions = '';
      if (l.status === 'pending') {
        actions = '<button class="btn btn-success btn-sm" onclick="approveLeave(\'' + l.id + '\')">Εγκρ.</button> ' +
                  '<button class="btn btn-danger btn-sm" onclick="rejectLeave(\'' + l.id + '\')">Απορ.</button> ';
      }
      actions += '<button class="btn btn-ghost btn-sm" onclick="deleteLeave(\'' + l.id + '\')">Διαγρ.</button>';
      return '<tr>' +
            '<td><strong>' + l.eponymo + ' ' + l.onoma + '</strong></td>' +
            '<td>' + (typeNames[l.leave_type] || l.leave_type) + '</td>' +
            '<td>' + l.start_date + ' &rarr; ' + l.end_date + '</td>' +
            '<td><span class="badge ' + statusBadge[l.status] + '">' + statusLbl[l.status] + '</span></td>' +
            '<td>' + (l.notes || '—') + '</td>' +
            '<td>' + actions + '</td>' +
        '</tr>';
    }).join('');

    return '<div class="fade-in">' +
            '<div class="filters-bar">' +
                '<button class="btn btn-primary" onclick="showAddLeave()">+ Νέα Άδεια</button>' +
            '</div>' +
            '<div class="table-wrap">' +
                '<table><thead><tr>' +
                    '<th>Εργαζόμενος</th><th>Τύπος</th><th>Περίοδος</th><th>Κατάσταση</th><th>Σημειώσεις</th><th>Ενέργειες</th>' +
                '</tr></thead>' +
                '<tbody>' + (rows || '<tr><td colspan="6"><div class="empty-state"><p>Δεν υπάρχουν άδειες</p></div></td></tr>') + '</tbody>' +
                '</table>' +
            '</div>' +
        '</div>';
  } catch (e) { return '<div class="empty-state"><div class="empty-icon">🏖️</div><p>Σφάλμα φόρτωσης</p></div>'; }
}

// --- Schedule/Leave Helpers ---
function _buildSchedOpts(selectedId) {
  return _schedules.map(function(s) {
    var sel = (selectedId && s.id === selectedId) ? ' selected' : '';
    return '<option value="' + s.id + '"' + sel + '>' + s.name + ' (' + (s.start_time || '').slice(0, 5) + '-' + (s.end_time || '').slice(0, 5) + ')</option>';
  }).join('');
}
function _buildEmpOpts(selectedId) {
  return _employees.map(function(e) {
    var sel = (selectedId && e.id === selectedId) ? ' selected' : '';
    return '<option value="' + e.id + '"' + sel + '>' + e.eponymo + ' ' + e.onoma + ' (' + e.afm + ')</option>';
  }).join('');
}

function showAddSchedule() {
  openModal('Νέο Ωράριο',
    '<form onsubmit="addSchedule(event)">' +
      '<div class="form-group"><label>Όνομα</label><input id="s-name" required placeholder="Πρωινό"></div>' +
      '<div class="form-group"><label>Ώρα Έναρξης</label><input id="s-start" type="time" required value="08:00"></div>' +
      '<div class="form-group"><label>Ώρα Λήξης</label><input id="s-end" type="time" required value="16:00"></div>' +
      '<div class="form-group"><label>Ημέρες (1=Δευ, 7=Κυρ)</label><input id="s-days" value="1,2,3,4,5" placeholder="1,2,3,4,5"></div>' +
      '<div class="form-group" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="s-night" style="width:auto"><label for="s-night" style="margin:0">Νυχτερινό</label></div>' +
      '<div class="form-group"><label>Grace πριν/μετά (λεπτά)</label><div style="display:flex;gap:8px"><input id="s-grace-before" type="number" value="15" style="width:80px"><input id="s-grace-after" type="number" value="10" style="width:80px"></div></div>' +
      '<div class="modal-actions"><button type="submit" class="btn btn-primary">Αποθήκευση</button></div>' +
    '</form>');
}

async function addSchedule(e) {
  e.preventDefault();
  try {
    await api_post('/schedules', {
      name: document.getElementById('s-name').value,
      startTime: document.getElementById('s-start').value,
      endTime: document.getElementById('s-end').value,
      daysOfWeek: document.getElementById('s-days').value.split(',').map(Number),
      isNightShift: document.getElementById('s-night').checked,
      graceMinutesBefore: parseInt(document.getElementById('s-grace-before').value),
      graceMinutesAfter: parseInt(document.getElementById('s-grace-after').value),
    });
    closeModal(); navigateTo('schedules');
  } catch (err) { alert(err.message); }
}

function showAssignSchedule() {
  openModal('Ανάθεση Ωραρίου',
    '<form onsubmit="assignSchedule(event)">' +
      '<div class="form-group"><label>Εργαζόμενος</label><select id="a-emp" required>' + _buildEmpOpts() + '</select></div>' +
      '<div class="form-group"><label>Ωράριο</label><select id="a-sched" required>' + _buildSchedOpts() + '</select></div>' +
      '<div class="form-group"><label>Από</label><input id="a-from" type="date" required></div>' +
      '<div class="form-group"><label>Μέχρι (κενό=μόνιμο)</label><input id="a-until" type="date"></div>' +
      '<div class="modal-actions"><button type="submit" class="btn btn-primary">Ανάθεση</button></div>' +
    '</form>');
}

async function assignSchedule(e) {
  e.preventDefault();
  try {
    await api_post('/schedules/assign', {
      employeeId: document.getElementById('a-emp').value,
      scheduleId: document.getElementById('a-sched').value,
      effectiveFrom: document.getElementById('a-from').value,
      effectiveUntil: document.getElementById('a-until').value || null,
    });
    closeModal(); navigateTo('schedules');
  } catch (err) { alert(err.message); }
}

async function deleteSchedule(id) { if (confirm('Διαγραφή ωραρίου;')) { await api_delete('/schedules/' + id); navigateTo('schedules'); } }
async function removeAssignment(id) { if (confirm('Αφαίρεση ανάθεσης;')) { await api_delete('/schedules/assign/' + id); navigateTo('schedules'); } }

function editAssignment(id) {
  var a = _assignments.find(function(x) { return x.id === id; });
  if (!a) return alert('Ανάθεση δεν βρέθηκε');
  openModal('Αλλαγή Ανάθεσης Ωραρίου',
    '<form onsubmit="saveAssignment(event,\'' + id + '\')">' +
      '<div class="form-group"><label>Νέο Ωράριο (κενό = χωρίς αλλαγή)</label>' +
        '<select id="ea-sched"><option value="">— Χωρίς αλλαγή —</option>' + _buildSchedOpts() + '</select>' +
      '</div>' +
      '<div class="form-group"><label>Νέα Ημερομηνία Έναρξης</label>' +
        '<input id="ea-from" type="date" value="' + (a.effective_from || '') + '">' +
      '</div>' +
      '<div class="form-group"><label>Νέα Ημερομηνία Λήξης (κενό = μόνιμο)</label>' +
        '<input id="ea-until" type="date" value="' + (a.effective_until || '') + '">' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button type="submit" class="btn btn-primary">Αποθήκευση</button>' +
      '</div>' +
    '</form>');
}

async function saveAssignment(evt, id) {
  evt.preventDefault();
  try {
    var body = {};
    var s = document.getElementById('ea-sched').value;
    var f = document.getElementById('ea-from').value;
    var u = document.getElementById('ea-until').value;
    if (s) body.scheduleId = s;
    if (f) body.effectiveFrom = f;
    body.effectiveUntil = u || null;
    await api_put('/schedules/assign/' + id, body);
    closeModal();
    navigateTo('schedules');
  } catch (err) { alert(err.message); }
}

function showAddLeave() {
  openModal('Νέα Άδεια',
    '<form onsubmit="addLeave(event)">' +
      '<div class="form-group"><label>Εργαζόμενος</label><select id="l-emp" required>' + _buildEmpOpts() + '</select></div>' +
      '<div class="form-group"><label>Τύπος</label><select id="l-type" required>' +
        '<option value="annual">Κανονική</option><option value="sick">Ασθενείας</option>' +
        '<option value="unpaid">Άνευ αποδοχών</option><option value="maternity">Μητρότητας</option>' +
        '<option value="other">Άλλη</option>' +
      '</select></div>' +
      '<div class="form-group"><label>Από</label><input id="l-from" type="date" required></div>' +
      '<div class="form-group"><label>Μέχρι</label><input id="l-to" type="date" required></div>' +
      '<div class="form-group"><label>Σημειώσεις</label><textarea id="l-notes" rows="2"></textarea></div>' +
      '<div class="modal-actions"><button type="submit" class="btn btn-primary">Αποθήκευση</button></div>' +
    '</form>');
}

async function addLeave(e) {
  e.preventDefault();
  try {
    await api_post('/leaves', {
      employeeId: document.getElementById('l-emp').value,
      leaveType: document.getElementById('l-type').value,
      startDate: document.getElementById('l-from').value,
      endDate: document.getElementById('l-to').value,
      notes: document.getElementById('l-notes').value,
    });
    closeModal(); navigateTo('leaves');
  } catch (err) { alert(err.message); }
}

async function approveLeave(id) { await api_put('/leaves/' + id, { status: 'approved' }); navigateTo('leaves'); }
async function rejectLeave(id) { await api_put('/leaves/' + id, { status: 'rejected' }); navigateTo('leaves'); }
async function deleteLeave(id) { if (confirm('Διαγραφή άδειας;')) { await api_delete('/leaves/' + id); navigateTo('leaves'); } }
