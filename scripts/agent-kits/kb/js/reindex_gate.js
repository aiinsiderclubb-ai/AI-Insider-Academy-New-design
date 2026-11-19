// Reindex Gate: проверяет токен у запроса на переиндексацию. Расписанию токен не нужен.
const { config, input } = $input.first().json;
if (input.via === 'schedule') return [{ json: { allowed: true, via: 'schedule' } }];
const headers = input.request?.headers || {};
const body = input.request?.body || {};
const token = headers['x-agent-token'] || body.token;
const ok = Boolean(config.agent_token) && !config.agent_token.startsWith('ЗАМЕНИТЕ') && token === config.agent_token;
return [{ json: { allowed: ok, via: 'webhook' } }];
