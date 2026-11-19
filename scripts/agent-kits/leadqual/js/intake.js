// Intake: принимает заявку с любой формы, приводит поля к одному виду, отсекает мусор.
// @include url.js
const { config, input } = $input.first().json;
const headers = input.headers || {};
const body = typeof input.body === 'object' && input.body ? input.body : {};
const query = input.query || {};
const out = (route, extra) => [{ json: { route, ...extra } }];

const token = headers['x-agent-token'] || body.token || query.token;
if (!config.agent_token || config.agent_token.startsWith('ЗАМЕНИТЕ') || token !== config.agent_token) return out('deny', {});
const debug = Boolean(config.debug_token) && headers['x-agent-debug'] === config.debug_token;

// Поля с любых форм: Tilda, Webflow, WordPress, Google Forms, своя форма
const flat = {};
for (const [k, v] of Object.entries({ ...query, ...body })) flat[String(k).toLowerCase().replace(/[\s_-]+/g, '')] = Array.isArray(v) ? v.join(', ') : v;
const pick = (...keys) => { for (const k of keys) if (flat[k] !== undefined && String(flat[k]).trim()) return String(flat[k]).trim(); return ''; };
const lead = {
  name: pick('name', 'имя', 'fullname', 'yourname', 'contactname').slice(0, 120),
  email: pick('email', 'почта', 'mail', 'youremail').toLowerCase().slice(0, 200),
  phone: pick('phone', 'телефон', 'tel', 'phonenumber', 'mobile').slice(0, 40),
  company: pick('company', 'компания', 'organization', 'organisation', 'companyname').slice(0, 200),
  website: pick('website', 'сайт', 'site', 'url', 'companywebsite').slice(0, 300),
  message: pick('message', 'сообщение', 'comment', 'comments', 'комментарий', 'text', 'request', 'запрос').slice(0, 3000),
  budget: pick('budget', 'бюджет').slice(0, 100),
  source: pick('source', 'utmsource', 'источник', 'formname', 'form') .slice(0, 100) || 'web',
};

// Ловушка для ботов: скрытое поле, которое человек не заполнит
if (pick('hp', 'honeypot', 'fax', 'companywebsitehp')) return out('spam', { debug, reason: 'honeypot' });
// Tilda перед сохранением вебхука шлёт test=test — отвечаем 200, в CRM не пишем
if (!lead.email && !lead.phone && String(flat.test || '').toLowerCase() === 'test') return out('spam', { debug, reason: 'tilda_test' });
if (!lead.email && !lead.phone) return out('bad', { error: 'Нужен email или телефон' });
if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return out('bad', { error: 'Email выглядит неверно' });

// Телефон к международному виду
if (lead.phone) {
  let d = lead.phone.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (config.phone_national_prefix && d.startsWith(config.phone_national_prefix)) d = config.phone_country_code + d.slice(config.phone_national_prefix.length);
  else if (d.length <= 9) d = config.phone_country_code + d;
  lead.phone = d.length >= 8 ? '+' + d : '';
}

// Домен компании: из сайта, иначе из корпоративной почты
const emailDomain = lead.email.split('@')[1] || '';
const free = (config.free_email_domains || []).includes(emailDomain);
let domain = '';
if (lead.website) {
  const u = parseUrl(/^https?:\/\//i.test(lead.website) ? lead.website : 'https://' + lead.website);
  domain = u ? u.hostname.replace(/^www\./, '') : '';
}
if (!domain && emailDomain && !free) domain = emailDomain;
lead.domain = domain;
lead.corporate_email = Boolean(emailDomain) && !free;
if (lead.website && !/^https?:\/\//i.test(lead.website)) lead.website = 'https://' + lead.website;
if (!lead.website && domain) lead.website = 'https://' + domain;

// Двойной клик и повтор формы в течение 10 минут — одна заявка
const store = $getWorkflowStaticData('global');
store.recent = store.recent || {};
const now = Date.now();
for (const [k, t] of Object.entries(store.recent)) if (now - t > 600000) delete store.recent[k];
const key = [lead.email, lead.phone, lead.message.slice(0, 200)].join('|');
if (store.recent[key]) return out('repeat', { debug });
store.recent[key] = now;

let h = 2166136261;
for (const ch of key + now) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
lead.lead_id = 'L-' + now.toString(36).toUpperCase().slice(-5) + h.toString(36).toUpperCase().slice(0, 4);
lead.received = new Date(now).toISOString();
return out('ok', { debug, lead });
