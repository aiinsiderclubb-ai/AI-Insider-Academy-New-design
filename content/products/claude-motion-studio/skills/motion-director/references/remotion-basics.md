# Remotion в этом проекте

## Устройство

```
src/
  Root.tsx              все композиции: id, размер, частота, длина, props по умолчанию
  compositions/         сцены: KineticType, DataStory, ProductPromo, Captions, LogoSting, StyleBoard
  components/           движения и элементы (см. motion-rules.md)
  styles/styles.ts      восемь стилей
  styles/fonts.ts       загрузка шрифтов Google Fonts
  lib/motion.ts         время, кривые, доли
public/                 картинки, видео, звук, данные — доступ через staticFile("путь")
```

Предпросмотр в браузере: `npx remotion studio`. Там же можно менять props и смотреть кадр за кадром.

## Props

Каждая композиция берёт данные из props. Не правь текст в коде компонента — передай свой JSON:

```bash
npx remotion render KineticType out/reel.mp4 --props=props/reel.json
```

В файле достаточно полей, которые меняются; остальные берутся из `defaultProps` в `Root.tsx`. Для повторяемости храни props в папке `props/` проекта.

## Новая композиция

1. Файл в `src/compositions/`, компонент оборачивается в `<LookProvider styleId={style}>` — так он получает стиль и шрифты.
2. Регистрация в `src/Root.tsx`: `<Composition id="…" component={…} durationInFrames={…} fps={30} width={…} height={…} defaultProps={…} />`.
3. `npx tsc --noEmit` — проверка типов до рендера.

## Правила, без которых рендер «плывёт»

- Всё, что меняется во времени, считается из `useCurrentFrame()`. Никаких `setTimeout`, CSS `animation` и `transition` — при рендере кадры снимаются не по порядку и не в реальном времени.
- Никакого `Math.random()`. Нужна случайность — `seeded(номер)` из `lib/motion.ts`: одинаковая при каждом рендере.
- Картинки — через `<Img>` из `remotion`, видео — `<OffthreadVideo>`, звук — `<Audio>`: они ждут загрузки перед снимком кадра.
- Файлы из `public/` — через `staticFile("shots/home.png")`, не по относительному пути.
- Внутри `<Sequence from={…}>` время начинается заново: `useCurrentFrame()` там возвращает кадры от начала последовательности.

## Шрифты

`LookProvider` загружает три шрифта стиля и ничего не рисует, пока они не пришли: размер текста подбирается по реальному шрифту. Первый рендер скачивает шрифты с Google Fonts — нужен интернет.

Свой шрифт (фирменный клиента): положи `.woff2` в `public/fonts/`, загрузи через `@remotion/fonts` (`npm i @remotion/fonts@<версия remotion>`):

```ts
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
loadFont({ family: "Brand Sans", url: staticFile("fonts/brand.woff2"), weight: "700" });
```

и подставь `"Brand Sans"` в стиль вместо семейства Google Fonts (поле `family` и загрузчик в `fonts.ts`). Проверь, что в шрифте есть кириллица.

## Звук

```tsx
import { Audio, staticFile } from "remotion";
<Audio src={staticFile("music.mp3")} trimBefore={30 * 31} volume={0.8} />
```

`trimBefore` — с какого кадра трека начинать (31 с × 30 к/с). Доли для этого отрезка считай тем же отрезком: `beats.py music.mp3 --start 31 --length 12`.

## Лицензия

Remotion бесплатен для частных лиц, некоммерческих организаций и компаний до трёх человек. Компаниям от четырёх человек нужна лицензия (remotion.pro). Шаблон и скиллы этого набора — ваши по лицензии AI Insider Academy; на сам Remotion действует его собственная лицензия.
