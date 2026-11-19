// Reminders Plan: какие записи читать — ближайшие, созданные агентом.
const { config: cfg } = $('Config').first().json;
// @include time.js
const now = nowMs();
const ahead = Math.max(1, ...(cfg.reminder_hours || [])) + 1;
return [{ json: { url: eventsUrl({ timeMin: new Date(now).toISOString(), timeMax: new Date(now + ahead * 60 * MIN).toISOString(),
  singleEvents: 'true', orderBy: 'startTime', maxResults: '500', privateExtendedProperty: 'source=chat-agent' }) } }];
