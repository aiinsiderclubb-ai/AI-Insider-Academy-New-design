# Проект Motion Studio

Проект Remotion из набора Claude Motion Studio (AI Insider Academy).

```bash
npm install
npx remotion studio                                   # предпросмотр в браузере
npx remotion render KineticType out/reel.mp4          # рендер
npx remotion render DataStory out/chart.mp4 --props=props/chart.json
```

- `src/Root.tsx` — все композиции и их props по умолчанию.
- `src/compositions/` — сцены.
- `src/components/` — движения и элементы.
- `src/styles/styles.ts` — восемь стилей; стиль меняется полем `style` в props.
- `public/` — картинки, видео, звук и данные (`staticFile("путь")`).

Работать удобнее через агента со скиллами Motion Studio: он пишет props, рендерит черновики и проверяет кадры.

Remotion бесплатен для частных лиц и компаний до трёх человек; компаниям от четырёх человек нужна лицензия Remotion (remotion.pro).
