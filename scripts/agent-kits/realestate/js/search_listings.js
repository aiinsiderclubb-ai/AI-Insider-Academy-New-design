// Match Listings: подбор объектов из листа Listings по понятным критериям.
// Колонки Listings: listing_id | status | deal_type | property_type | city | area | address | rooms | area_m2 | price | currency | floor | description | url | agent_id | features
// @include text.js
// @include re.js
const { config, input } = $('Config').first().json;
const res = $input.first().json;
if (res.error) {
  return [{ json: { ok: false, result: { found: false, service_error: String(res.error.message || res.error).slice(0, 300), note: 'База объектов недоступна. Не называй никаких объектов. Предложи, что риелтор пришлёт подборку (handoff_to_human).' } } }];
}
const ranges = res.valueRanges || [];
const tab = (name) => sheetRows((ranges.find((r) => decodeURIComponent(r.range || '').replace(/'/g, '').startsWith(name + '!')) || {}).values);
const listings = tab('Listings').filter((l) => norm(l.status) === 'active');
const leads = tab('Leads');

const want = {
  deal: norm(input.deal_type),
  type: norm(input.property_type),
  area: norm(input.area),
  budget: num(input.budget_max),
  ref: normId(input.listing_ref),
};
const roomsText = norm(input.rooms);
let rMin = 0;
let rMax = 99;
const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(roomsText);
if (range) [rMin, rMax] = [Number(range[1]), Number(range[2])];
else if (/^(\d+)\s*\+$/.test(roomsText)) rMin = Number(roomsText.replace(/\D/g, ''));
else if (/^\d+$/.test(roomsText)) rMin = rMax = Number(roomsText);
const roomsWanted = roomsText !== '';

const agentName = (id) => ((config.agents || []).find((a) => a.id === id) || {}).name || '';
const fmt = (n) => Number(n).toLocaleString('ru-RU');
const scored = [];
for (const l of listings) {
  if (want.ref && normId(l.listing_id) === want.ref) {
    scored.push({ l, score: 100, reasons: ['объект из заявки клиента'] });
    continue;
  }
  if (want.deal && norm(l.deal_type) !== want.deal) continue;
  if (want.type && want.type !== 'any' && norm(l.property_type) !== want.type) continue;
  const price = num(l.price);
  const reasons = [];
  let score = 0;
  if (want.budget) {
    if (price <= want.budget) { score += 3; reasons.push(`цена ${fmt(price)} ${l.currency} в бюджете до ${fmt(want.budget)}`); }
    else if (price <= want.budget * 1.1) { score += 1; reasons.push(`цена ${fmt(price)} ${l.currency} — на ${Math.round((price / want.budget - 1) * 100)}% выше бюджета`); }
    else continue;
  }
  const rooms = num(l.rooms);
  if (roomsWanted) {
    if (rooms >= rMin && rooms <= rMax) { score += 2; reasons.push(`комнат: ${rooms}`); }
    else if (Math.abs(rooms - (rooms < rMin ? rMin : rMax)) === 1) { reasons.push(`комнат: ${rooms} (просили ${input.rooms})`); }
    else continue;
  }
  if (want.area) {
    if (norm(l.area).includes(want.area) || want.area.includes(norm(l.area))) { score += 3; reasons.push(`район: ${l.area}`); }
    else { reasons.push(`другой район: ${l.area}`); }
  }
  scored.push({ l, score, reasons });
}
scored.sort((a, b) => b.score - a.score || num(a.l.price) - num(b.l.price));
const top = scored.slice(0, 3);
const inArea = !want.area || top.some((s) => s.reasons.some((r) => r.startsWith('район:')));

const shown = top.map(({ l, reasons }) => ({
  listing_id: l.listing_id,
  title: `${l.rooms ? l.rooms + '-комн. ' : ''}${{ apartment: 'квартира', house: 'дом', commercial: 'коммерческое помещение', land: 'участок' }[norm(l.property_type)] || l.property_type}, ${l.area}`,
  address: l.address,
  rooms: l.rooms,
  area_m2: l.area_m2,
  floor: l.floor,
  price: l.price,
  currency: l.currency,
  features: l.features,
  url: l.url,
  agent: agentName(l.agent_id),
  why: reasons,
}));

// Карточка лида: показанные объекты и этап «подобраны варианты».
let update = null;
const lead = findLead(leads, input.session_id, input.customer_phone);
if (lead && shown.length) {
  const ids = [...new Set([...String(lead.listing_ids || '').split(',').map((x) => x.trim()).filter(Boolean), ...shown.map((s) => s.listing_id)])];
  const next = { ...lead, listing_ids: ids.join(', '), stage: ['new', 'qualified', ''].includes(lead.stage) ? 'matched' : lead.stage, last_contact: new Date().toISOString() };
  update = { valueInputOption: 'RAW', data: [{ range: leadRange(lead._row), values: [leadValues(next)] }] };
}

return [{ json: {
  ok: true,
  update,
  result: {
    found: shown.length > 0,
    listings: shown,
    note: !shown.length
      ? 'Подходящих объектов в базе нет. Не придумывай объекты. Предложи расширить критерии (район, бюджет, комнаты) или чтобы риелтор подобрал вручную.'
      : (inArea ? '' : 'В нужном районе ничего нет — это объекты в других районах, скажи об этом прямо. ')
        + 'Покажи клиенту эти объекты: номер, что это, цена, почему подходит (поле why) и ссылку. Ничего не добавляй от себя: ни этаж, ни ремонт, ни торг — только то, что в данных. Предложи просмотр.',
  },
} }];
