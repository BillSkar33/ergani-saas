# Notifications Skill — Proactive Notifications & Chatbot Integration

## Overview
Guidelines for building proactive notifications and chatbot message flows for the Ergani SaaS platform.

## Supported Platforms
- **Facebook Messenger** — primary channel
- **Viber** — secondary channel
- **Future**: WhatsApp Business API

## Services Involved
```
project-main/services/
├── notification-service/
│   ├── index.js            # Notification dispatcher
│   └── template-engine.js  # Message template renderer
└── scheduler/
    └── index.js            # Cron jobs that trigger notifications
```

## Message Templates (template-engine.js)
```javascript
// Templates are functions that return platform-specific message objects
const templates = {
  SHIFT_REMINDER: (data) => ({
    text: `⏰ Υπενθύμιση βάρδιας: ${data.shiftTime} στη ${data.location}`,
    quick_replies: [
      { title: '✅ Το είδα', payload: 'CONFIRM_SHIFT' },
      { title: '❓ Βοήθεια', payload: 'HELP' }
    ]
  }),

  CHECK_IN_SUCCESS: (data) => ({
    text: `✅ Η είσοδός σας καταχωρήθηκε στην ΕΡΓΑΝΗ στις ${data.time}`
  }),

  LEAVE_APPROVED: (data) => ({
    text: `✅ Η αίτηση άδειάς σας εγκρίθηκε για ${data.dates}`
  }),

  LEAVE_REJECTED: (data) => ({
    text: `❌ Η αίτηση άδειάς σας απορρίφθηκε. Αιτία: ${data.reason}`
  }),

  WEEKLY_SUMMARY: (data) => ({
    text: `📊 Εβδομαδιαία σύνοψη: ${data.checkins} παρουσίες, ${data.hours}h εργασία`
  })
};
```

## Cron Jobs (scheduler)
```javascript
// Shift reminders — 30min before shift start
cron.schedule('*/5 * * * *', async () => {
  const upcomingShifts = await getShiftsStartingIn30Min();
  for (const shift of upcomingShifts) {
    await notificationService.send(shift.employeeMessengerId, 'SHIFT_REMINDER', shift);
  }
});

// Weekly summary — every Sunday at 20:00
cron.schedule('0 20 * * 0', async () => {
  await sendWeeklySummaries();
});
```

## Sending Notifications
```javascript
// notification-service/index.js
async function send(recipientId, templateName, data, platform = 'messenger') {
  const message = templates[templateName](data);

  if (platform === 'messenger') {
    await messengerAPI.sendMessage(recipientId, message);
  } else if (platform === 'viber') {
    await viberAPI.sendMessage(recipientId, message);
  }

  // Log notification sent
  await db.query(
    'INSERT INTO notification_log (employee_id, template, sent_at) VALUES ($1, $2, NOW())',
    [employeeId, templateName]
  );
}
```

## Chatbot Intent Flow
```
Webhook → webhook-gateway → Kafka topic: 'incoming-messages'
                                         ↓
                              message-processor consumes
                              ├── Intent detection
                              ├── Handler dispatch (handlers/)
                              └── Response via notification-service
```

## Key Intents
| Intent         | Trigger                  | Handler                   |
| -------------- | ------------------------ | ------------------------- |
| `CHECK_IN`     | "Μπήκα", GPS checkin     | `checkin.handler.js`      |
| `CHECK_OUT`    | "Βγήκα"                  | `checkout.handler.js`     |
| `MY_SCHEDULE`  | "Πρόγραμμά μου"          | `schedule.handler.js`     |
| `REQUEST_LEAVE`| "Θέλω άδεια"             | `leave.handler.js`        |
| `HELP`         | "Βοήθεια"                | `help.handler.js`         |

## Do's & Don'ts
- ✅ Always use `template-engine.js` — never hardcode messages
- ✅ Log all sent notifications for audit
- ✅ Handle platform-specific message format differences
- ✅ Respect messenger platform rate limits
- ❌ Never send notifications between 22:00—07:00 (Greek time)
- ❌ Never include personal data (AFM, AMKA) in notification text
