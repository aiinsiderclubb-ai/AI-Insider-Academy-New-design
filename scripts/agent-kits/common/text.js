// ---- shared text helpers (inlined into Code nodes by the builder) ----
const STOP = new Set(('и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между это мой мою мое здравствуйте добрый день привет пожалуйста подскажите скажите хочу хотел хотела можно ли вы ваш ваша ваши the a an and or of to in on for is are be it this that with as at by from i you we my our your me do does how what can could please hi hello').split(' '));

function stem(word) {
  let w = word.toLowerCase().replace(/ё/g, 'е');
  if (/^[a-z]+$/.test(w)) return w.replace(/(ing|ed|es|s)$/, '').slice(0, 7);
  w = w.replace(/(ями|ами|иями|ией|ией|ого|ему|ому|ыми|ими|его|ая|яя|ое|ее|ие|ые|ой|ей|ий|ый|ов|ев|ам|ям|ах|ях|ом|ем|ую|юю|ть|ти|ешь|ет|ем|ете|ют|ут|ит|им|ите|ат|ят|ла|ло|ли|ся|сь|а|я|о|е|и|ы|у|ю|ь|й)$/, '');
  return w.slice(0, 6);
}

function terms(text) {
  return (String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem)
    .filter((w) => w.length > 1);
}

function escapeHtml(text) {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sheetRows(values) {
  const [head = [], ...rows] = values || [];
  const keys = head.map((h) => String(h).trim().toLowerCase());
  return rows.map((r, i) => Object.fromEntries([['_row', i + 2], ...keys.map((k, j) => [k, String(r[j] ?? '').trim()])]));
}
