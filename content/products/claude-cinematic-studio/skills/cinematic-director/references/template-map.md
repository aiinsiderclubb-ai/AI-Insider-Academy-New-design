# Карта проекта

Проект создаётся `scripts/new_project.py` из папки `template/` этого скилла. Remotion 4.0.546, React 19.2.9, three.js 0.184, @react-three/fiber 9.8.2, drei 10.7.9, @react-three/postprocessing 3.2.2. Версии закреплены точно — не обновляй их по одной: Remotion требует, чтобы все его пакеты были одной версии.

```
src/
  Root.tsx                 композиции, длительность в секундах, fps из props
  lib/
    curves.ts              bezier(), ease.*, spring(), coast(), track(), rng(), noise1()
    time.ts                useTime() — секунды; useSeconds() — секунды → кадры
    looks.ts               пять стилей: LOOKS, lookOf()
    fonts.ts               TTF для 3D-текста (npm, кириллица)
  three/
    Stage.tsx              3D-кадр: камера, студийный свет, окружение, пост-обработка
    camera.ts              locked, dolly, orbit, crane, dollyZoom, cutBetween, handheld, lens()
    Type3D.tsx             объёмный текст по буквам; REVEALS, EXITS
    RingType.tsx           текст по кольцу вокруг объекта
    Objects.tsx            Monolith, GlassCore, Rings, MirrorFloor, GridFloor, hdr()
    Model.tsx              модель клиента .glb из public/models
    Particles.tsx          Dust, Burst
    Trails.tsx             LightTrail, Streaks
    Hud.tsx                HudReticle
    font.ts, sync.ts       загрузка шрифтов; перерисовка кадра после асинхронной загрузки
  layers/
    Footage.tsx            Plate, Cutout, Pinned, useTrack, speedRamp, freezeAt, reverse
    Transitions.tsx        Sequence2: cut, whip, zoom, flash, fade
    Finish.tsx             Grain, Letterbox, Flash, LightLeak
  compositions/            HeroTitle, OrbitType, TechFilm, KineticSpot, FootageFX
public/
  footage/<имя>/           plate/, cutout/, meta.json, track-*.json (footage-composite, blender-3d)
  models/                  .glb клиента
  audio/                   музыка, beats.json, sfx stem
remotion.config.ts         ANGLE-рендер WebGL, PNG-кадры, H.264, concurrency 2
```

## Как устроен 3D-кадр

`<Stage look camera>` создаёт WebGL-холст на весь кадр. Внутри — всё, что в одном пространстве: текст, объекты, частицы, следы, HUD. `Stage` сам ставит:

- камеру по `CameraMove` — позиция, цель, угол зрения, крен, функции времени;
- студийные софтбоксы в окружении — их видно только в отражениях металла и стекла; `stripSweep` — скорость, с которой блики ползут;
- ключевой и контровой свет стиля;
- пост-обработку: глубина резкости (фокус — цель камеры или `focus`), bloom, хроматическая аберрация (растёт со скоростью камеры, `aberrationBoost`), виньетка, тональная кривая AgX.

`transparent` убирает фон — так 3D ложится между футажом и его маской.

## Время и частота кадров

Все композиции считают время в секундах через `useTime()`. Длительность и fps задаёт `calculateMetadata` в `Root.tsx` из prop `fps` (по умолчанию 30). Поэтому:

```bash
npx remotion render TechFilm out/tech.mp4                          # 30 fps
npx remotion render TechFilm out/tech@120.mp4 --props '{"fps":120}' # для motion blur в grade-finish
```

## Новая композиция

1. Скопируй ближайшую из `src/compositions/`, переименуй компонент и схему.
2. Зарегистрируй в `Root.tsx`: `calculateMetadata={seconds(N)}`, `width`/`height` по формату, `defaultProps` с текстами.
3. Сцены — функции внутри файла, по одной на шот; несколько шотов — через `Sequence2` (отдельные сцены) или `cutBetween` (склейки внутри одной сцены).
4. Проверка: `npx tsc --noEmit`, потом `npx remotion still <Id> out/f.png --frame=N --scale=0.5`.

## Отладка пустого или чёрного кадра

- Всё, что грузится асинхронно внутри `Stage` (шрифт, модель, текстура), должно вызывать `useRedrawWhenReady(ready, label)`. `Type3D`, `RingType`, `Model` уже это делают.
- Нет WebGL: в `remotion.config.ts` стоит `angle`. На Linux-сервере без GPU — `swangle` (медленно).
- Кадр есть, но без текста: шрифт не загрузился — смотри лог рендера с `--log=verbose`.
- Все Remotion-пакеты одной версии: `npx remotion versions`.
