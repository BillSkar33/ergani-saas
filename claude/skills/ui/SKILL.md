# UI Skill — Dashboard & Frontend Development

## Overview
Guidelines for building and maintaining the Ergani SaaS dashboard frontend.

## Stack
- **HTML5** — semantic markup
- **Vanilla CSS** — custom properties, flexbox/grid layouts
- **Vanilla JS** — ES6+ modules, no framework dependency
- **Fastify Static** — serves the dashboard from `@fastify/static`

## Dashboard Structure
```
project-main/dashboard/
├── index.html          # Employer Dashboard (check-in, schedules, geofencing map)
├── super.html          # Super Admin Dashboard (company management, billing)
├── css/
│   ├── style.css       # Global styles, CSS variables
│   └── ...
└── js/
    ├── api.js          # REST calls to admin-api / super-admin-api
    ├── map.js          # Leaflet.js geofencing map
    └── ...
```

## Design Principles
1. **Mobile-first** — employees often use phones for check-in
2. **Greek language UI** — all labels, errors, messages in Greek
3. **Real-time feedback** — show check-in status, Ergani submission result
4. **Role-based views** — employer vs super-admin views are separate HTML files

## Key Patterns

### API Calls
```javascript
// Always include Authorization header
const res = await fetch('/api/employees', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  }
});
```

### Error Display
```javascript
// Greek error messages
function showError(msg) {
  document.getElementById('error-banner').textContent = msg;
  document.getElementById('error-banner').style.display = 'block';
}
```

### Geofencing Map (Leaflet.js)
- Circle overlays represent geofence zones
- Employee location validated against zones on check-in
- Map tiles from OpenStreetMap

## CSS Variables
```css
:root {
  --primary: #1a56db;
  --success: #0e9f6e;
  --danger: #f05252;
  --bg: #f9fafb;
  --text: #111827;
}
```

## Do's & Don'ts
- ✅ Use `data-` attributes for JS hooks instead of classes
- ✅ Handle loading states visually
- ✅ Validate input client-side before API call
- ❌ Do not use jQuery or heavy frameworks
- ❌ Do not store sensitive data beyond JWT in localStorage
