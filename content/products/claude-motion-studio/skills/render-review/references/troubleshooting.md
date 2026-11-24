# Если рендер не получился

| Что видите | Причина | Что сделать |
|---|---|---|
| `npx: command not found` | Нет Node.js | Установить Node.js 18+ с nodejs.org, перезапустить терминал |
| `Cannot find module 'remotion'` | Не установлены пакеты | `npm install` в папке проекта |
| Первый рендер долго «скачивает» | Remotion скачивает свой Chrome для рендера (~100 МБ) | Один раз; дальше быстро |
| `A delayRender() "Loading fonts…" was called but not cleared` | Нет интернета или Google Fonts недоступен | Проверить сеть; либо локальные шрифты (references/remotion-basics.md в `motion-director`) |
| Текст другим шрифтом | Семейство без нужного начертания или без кириллицы | Проверить вес в `styles.ts` и что шрифт есть в `fonts.ts` |
| `inputRange must contain only finite numbers` | В `interpolate` пришло `Infinity` или `NaN`: пустой массив данных, деление на ноль, нет следующего бита | Проверить props: время, данные графика |
| `staticFile(...)` 404 | Файла нет в `public/` или путь с `/` в начале | Путь без ведущего слэша: `staticFile("shots/home.png")` |
| Видео в кадре чёрное | Формат, который Chrome не читает (HEVC из iPhone, ProRes) | Перекодировать: `ffmpeg -i in.mov -c:v libx264 -pix_fmt yuv420p -crf 18 in.mp4` |
| Кадры «дрожат» от рендера к рендеру | `Math.random()`, `Date.now()` или CSS-анимация в компоненте | Заменить на `seeded()` и `useCurrentFrame()` |
| Рендер медленный | Много кадров, тяжёлые фильтры (`blur`, большие тени) | Черновики с `--draft`; убрать `filter: blur()` с больших слоёв |
| `TypeError: … of undefined` в композиции | В props нет обязательного поля | Сравнить свой JSON с `defaultProps` в `src/Root.tsx` |
| Ошибка TypeScript | Опечатка в поле или типе | `npx tsc --noEmit` покажет файл и строку |
