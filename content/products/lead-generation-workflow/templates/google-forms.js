/**
 * Google Forms → Lead Intake.
 *
 * 1. Откройте форму → ⋮ → Редактор скриптов (Apps Script).
 * 2. Вставьте этот код, замените ENDPOINT и TOKEN.
 * 3. Слева «Триггеры» → Добавить триггер → функция onFormSubmit,
 *    источник «Из формы», тип «При отправке формы». Разрешите доступ.
 *
 * Названия вопросов в форме — это названия полей. Назовите их так, как ждёт
 * воркфлоу: «Имя», «Телефон», «Email», «Комментарий» — или добавьте свои
 * названия в field_aliases в узле Config.
 */
var ENDPOINT = 'https://REPLACE-N8N-HOST/webhook/lead';
var TOKEN = 'REPLACE_WITH_INTAKE_TOKEN';

function onFormSubmit(e) {
  var data = { token: TOKEN, source: 'google-forms', form: e.source.getTitle() };
  e.response.getItemResponses().forEach(function (item) {
    var answer = item.getResponse();
    data[item.getItem().getTitle()] = Array.isArray(answer) ? answer.join(', ') : String(answer);
  });
  var email = e.response.getRespondentEmail();
  if (email && !data.email) data.email = email;
  UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  });
}
