---
name: blender-3d
description: Рендерит фотореалистичный продукт или объёмный логотип в Blender из кода — смартфон, флакон, кейс наушников или любой SVG-логотип в хроме, золоте, стекле, в студии с софтбоксами и контровым светом, с облётом и наездом камеры — и отдаёт кадры с фоном и вырезку с альфой, готовые для композитинга с 3D-текстом. Используй, когда нужен продукт «как в Cinema 4D», packshot, turntable, 3D-логотип, logo sting, реалистичное стекло и металл, рекламный рендер продукта, когда у клиента нет съёмки продукта или three.js выглядит недостаточно реалистично. Procedural product and logo renders in Blender with plate and cutout passes.
license: Proprietary. Licensed to the buyer for own and client work; no resale.
metadata:
  author: AI Insider Academy
  version: "1.0"
---

# Продукт и логотип в Blender

Два скрипта строят сцену целиком из кода — модель, материалы, студию, свет, камеру — и рендерят её в фоне, без окна Blender. Результат — та же папка футажа, что у съёмки: кадры с фоном и вырезка с альфой. Дальше она идёт в композицию `FootageFX` через `<Plate>` и `<Cutout>` (скилл `footage-composite`), и 3D-текст встаёт за продуктом.

Нужен Blender 4.2 или новее (проверено на 5.2): https://www.blender.org/download/. Скрипты запускай из папки проекта, путь к скрипту — от папки этого скилла.

## Blender или сцена three.js

| Задача | Где |
|---|---|
| Текст, формы, частицы, HUD, свет, камера вокруг них | `<Stage>` three.js — быстро, всё в одном рендере |
| Готовая модель клиента `.glb` рядом с 3D-текстом | `<Stage>` + компонент `<Model>` (ниже) |
| Фотореалистичный продукт: стекло с преломлением, мягкие тени, контакт с полом | Blender |
| Логотип в хроме или золоте, который должен выглядеть как дорогой металл крупным планом | Blender (`logo_extrude.py`) |
| Нет ни съёмки, ни модели продукта | Blender (`product_turntable.py`) как заглушка или стиль |

Blender даёт честный свет и стекло, но кадр уже «запечён»: камеру после рендера не сдвинешь. Поэтому сначала утверди движение на черновике в низком разрешении.

## Порядок работы

1. **Продукт или логотип — черновик.** 4 кадра в половинном разрешении, чтобы проверить свет и кадр:

   ```bash
   blender -b --factory-startup -P scripts/product_turntable.py -- --out public/footage/device --product device --frames 4 --res 540x960
   ```

   Посмотри `public/footage/device/plate/frame_00001.png` и `frame_00004.png`.

2. **Полный рендер:**

   ```bash
   blender -b --factory-startup -P scripts/product_turntable.py -- --out public/footage/device --name device --product device --look graphite --frames 180 --fps 30 --res 1080x1920
   ```

   Это демо-футаж, который по умолчанию ждёт `FootageFX`. В комплекте его нет — эта команда и трек из `footage-composite` создают его заново:

   ```bash
   python3 ../footage-composite/scripts/track.py public/footage/device --box 0.302,0.245,0.2,0.11 --label camera --smooth 3
   ```

3. **Логотип** из SVG клиента:

   ```bash
   blender -b --factory-startup -P scripts/logo_extrude.py -- --svg brand/logo.svg --out public/footage/logo --material chrome --anim reveal --res 1920x1080
   ```

4. **Композитинг** — `FootageFX` с `footage` = имя папки, или свой кадр по [../footage-composite/references/compositing.md](../footage-composite/references/compositing.md).

5. **Финиш** — свечение и ореол на мастере: `python3 ../grade-finish/scripts/finish.py out/film.mp4 --glow --halation`.

Все флаги с примерами — [references/flags.md](references/flags.md). Проблемы и время рендера — [references/troubleshooting.md](references/troubleshooting.md).

## Что получается

```
public/footage/<name>/
  plate/frame_00001.png    кадр целиком: продукт, фон-циклорама, тень (RGB)
  cutout/frame_00001.png   только продукт, прозрачный фон (RGBA)
  meta.json                {"name","fps","count","width","height","source","engine"}
```

Во втором проходе фон невидим для камеры, но продолжает светить и отражаться в продукте. Поэтому вырезка закрашена так же, как в плейте, и ложится на него без шва — маска не нужна.

## Продукты

- `device` — тыльная сторона телефона: титановая рамка, матовое стекло, блок из трёх камер со вспышкой, логотип. Блок камер — готовая точка для трека.
- `bottle` — флакон из толстого янтарного стекла с золотой крышкой и этикеткой.
- `earbuds-case` — глянцевый белый кейс со швом крышки и зелёным индикатором.

Продукт парит над полом, медленно поворачивается (`--turn`) и чуть всплывает; камера наезжает по плавным Bézier-ключам и облетает его на `--orbit` градусов. Кадр рассчитывается по реальным габаритам модели.

## Стили студии (`--look`)

| look | Фон | Контровый свет | Для чего |
|---|---|---|---|
| `graphite` | почти чёрный графит, световое пятно | холодный голубой | техника, премиум, текст за продуктом |
| `studio-white` | светло-серая циклорама | белый | каталог, packshot, e-commerce |
| `warm` | тёмно-коричневый | тёплый оранжевый | парфюм, напитки, люкс |
| `night-blue` | глубокий синий | синий | ночные tech-ролики, неон |

Стиль студии подбирай под стиль ролика (`src/lib/looks.ts`): `keynote` и `chrome` → `graphite`, `editorial` → `warm`, `neon` → `night-blue`.

## Модель клиента: `<Model>` вместо Blender

Есть `.glb` (из Blender, Cinema 4D, Spline, с сайта производителя)? Ставь его прямо в 3D-сцену рядом с текстом — без рендера в Blender:

```tsx
<Stage look={look} camera={orbit({ radius: 6, fromDeg: -20, toDeg: 20, end: 6 })}>
  <Model file="models/sneaker.glb" look={look} size={2.2} rotation={[0, -30, 0]} spin={12} />
  <RingType text="NEW · AIR · " look={look} radius={2} />
</Stage>
```

Файл — в `public/models/`. `size` — длина самой большой стороны в единицах сцены: модель любого масштаба встанет предсказуемо. `spin` — градусы в секунду вокруг вертикали. `finish="metal" | "plastic" | "glass"` заменяет материалы модели материалом стиля: полезно, когда у модели некрасивые или пустые материалы. Здесь работают bloom, глубина резкости и движение камеры после «рендера». Но стекло и тени проще, чем в Blender.

Формат `.fbx` или `.obj`: открой его в Blender, `File → Export → glTF 2.0 (.glb)`.

## Правила

- Черновик в малом разрешении и 4 кадра — до полного рендера. 180 кадров 1080×1920 — около 15 минут на Apple Silicon.
- Не меняй стиль студии или продукт после трека и масок: перерендер = новые `plate/` и `cutout/`, трек пересчитай.
- Стекло (`bottle`, `--material glass`) смотри на финальном кадре в Cycles, если оно в кадре крупно.
- Сцену для ручной доводки в Blender сохраняй: `--save-blend scene.blend --no-render`.
