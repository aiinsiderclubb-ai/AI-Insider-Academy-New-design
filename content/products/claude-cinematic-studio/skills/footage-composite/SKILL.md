---
name: footage-composite
description: Встраивает 3D-графику в реальное видео — раскладывает клип на кадры, вырезает человека или продукт маской (ротоскоп, хромакей, по яркости, GrabCut по рамке), трекает деталь в кадре, ставит объёмный текст за объектом, цепляет выноски к трекнутой точке, делает speed ramp, стоп-кадр и реверс с плавным замедлением через интерполяцию кадров. Используй, когда просят текст за человеком, надпись за продуктом, VFX поверх съёмки, трекинг, ротоскопинг, маску, хромакей, привязать графику к объекту в кадре, замедление, speed ramp, «как в After Effects поверх видео». Composites 3D type and graphics into real footage with mattes, tracking and time remapping.
license: Proprietary. Licensed to the buyer for own and client work; no resale.
metadata:
  author: AI Insider Academy
  version: "1.0"
---

# Композитинг 3D в реальное видео

Футаж в проекте — не видеофайл, а пронумерованные кадры. Так сцена берёт любой исходный кадр в любой момент: speed ramp, стоп-кадр и реверс — это функция времени, а маска и трек того же кадра совпадают с ним до пикселя. Три скрипта готовят материал, композиция `FootageFX` и слой `src/layers/Footage.tsx` собирают кадр.

Скрипты запускай из папки проекта, путь к скрипту — от папки этого скилла. Зависимости один раз:

```bash
python3 -m pip install -r scripts/requirements.txt
```

`frames.py` нужен только ffmpeg; `matte.py`, `track.py` и `../cut-rhythm/scripts/match_cut.py` — numpy и OpenCV; MediaPipe — только для масок людей.

## Что нужно на входе

- Клип: MP4, MOV — любой, который читает ffmpeg. Лучше 4K или 1080p, короткие куски, а не весь исходник.
- Что вырезать: человека, продукт, предмет на хромакее.
- Что трекать: деталь с текстурой — логотип, камеру телефона, пуговицу, угол коробки.
- Права на съёмку, если ролик коммерческий: спроси.

## Структура папки футажа

```
public/footage/<name>/
  meta.json              {"name","fps","count","width","height","source", "slowmo"}
  plate/frame_00001.png  кадры клипа
  cutout/frame_00001.png объект с альфой (RGBA), те же номера
  matte/frame_00001.png  маска в оттенках серого (белое — объект)
  track-<label>.json     трек детали
```

`FootageFX` по умолчанию читает футаж `device` и трек `camera`. В комплекте покупателя футажа нет — пустой проект упадёт на `meta.json`. Сделай демо двумя командами (около 15 минут на Apple Silicon):

```bash
blender -b --factory-startup -P ../blender-3d/scripts/product_turntable.py -- --out public/footage/device --name device --product device --look graphite --frames 180 --fps 30 --res 1080x1920
python3 scripts/track.py public/footage/device --box 0.302,0.245,0.2,0.11 --label camera --smooth 3
```

Первая — скилл `blender-3d`: телефон в графитовой студии, `plate/` и `cutout/`. Вторая трекает его камеру-модуль.

## Порядок работы

1. **Кадры.** Возьми только нужный кусок и сразу нужную ширину:

   ```bash
   python3 scripts/frames.py clip.mp4 --name hero --start 3.2 --length 4 --width 1080
   ```

   Для замедления добавь `--slowmo 4`: ffmpeg дорисует кадры по оптическому потоку (minterpolate, mci), и 25 % скорости будет плавным, без повторов. В `meta.json` останется `fps` исходника и `slowmo: 4`, `<Plate>` учитывает оба. Интерполяция угадывает движение: на руках, волосах, пересечениях бывают «волны» — проверь кадры. Повторный запуск с тем же `--name` требует `--force`.

2. **Маска** — какой режим когда, в [references/matte-guide.md](references/matte-guide.md):

   ```bash
   python3 scripts/matte.py public/footage/hero --mode key --color 0,177,64 --choke 1 --feather 2
   python3 scripts/matte.py public/footage/hero --mode object --box 0.3,0.2,0.4,0.7 --smooth 3
   python3 scripts/matte.py public/footage/hero --mode person --model models/selfie_segmenter.tflite --feather 2 --smooth 5
   ```

   Скрипт пишет `matte/` и `cutout/` и печатает покрытие кадра и самый большой скачок маски между кадрами. Скачок больше 2 % кадра почти всегда значит потерянный край — посмотри этот кадр.

3. **Трек** — как выбрать рамку и что считать хорошим результатом, в [references/tracking.md](references/tracking.md):

   ```bash
   python3 scripts/track.py public/footage/hero --box 0.62,0.18,0.12,0.07 --label logo --smooth 5 --preview
   ```

   `--preview` пишет `track-logo.mp4` с рамкой. Открой его и прокрути: рамка должна сидеть на детали весь клип.

4. **Сборка кадра** — «бутерброд» из трёх слоёв, подробно в [references/compositing.md](references/compositing.md):

   ```tsx
   const remap = speedRamp([[0, 1], [0.9, 1], [1.3, 0.28, "expoOut"], [3.9, 0.28], [4.4, 2.2, "expoIn"]]);
   <Plate name="hero" remap={remap} />
   <Stage look={look} camera={locked([0, 0, 9], [0, 0, 0], 50)} transparent> …3D-текст… </Stage>
   <Cutout name="hero" remap={remap} />
   <Pinned name="hero" label="logo" remap={remap}> …выноска… </Pinned>
   ```

   Один и тот же `remap` передаётся всем слоям — иначе объект «отклеится» от вырезки и трека.

5. **Проверка краёв.** Отрендери кадры, где текст проходит за объектом, и кадры с самым быстрым движением:

   ```bash
   npx remotion still FootageFX out/check-40.png --frame=40
   ```

   Ореол вокруг объекта — `--choke 1`; рваный край — `--feather 2`; край дрожит от кадра к кадру — `--smooth 3`. Подробно — в разделе «Края» [references/matte-guide.md](references/matte-guide.md).

6. **Рендер и финиш:**

   ```bash
   npx remotion render FootageFX out/footage.mp4 --props='{"footage":"hero","trackLabel":"logo","title":"ТИТАН"}'
   python3 ../grade-finish/scripts/finish.py out/footage.mp4 --glow --halation --grain 6
   ```

## Композиция FootageFX

1080×1920, 6 с. Плейт идёт в реальном времени, на 1,3 с врезается в замедление 28 %, за продуктом поднимается 3D-заголовок, на 2,0 с к трекнутой детали цепляется выноска (точка, линия, печатающийся текст), на 4,4 с плейт выстреливает на 220 % и уходит в световой блик. Props:

| prop | что это |
|---|---|
| `look` | стиль из `src/lib/looks.ts`: `keynote`, `chrome`, `kinetic`, `neon`, `editorial` |
| `footage` | имя папки в `public/footage/` |
| `title` | 3D-заголовок за объектом, 1–2 коротких слова |
| `callout`, `calloutValue` | подпись выноски и крупное значение |
| `trackLabel` | метка трека: `track-<label>.json` |
| `fps` | частота рендера; 120 — для размытия движения в `grade-finish` |

Горизонтальный ролик: скопируй композицию в `src/Root.tsx` с `width={1920} height={1080}`. `<Plate>` заполняет кадр как `object-fit: cover`, а `<Pinned>` пересчитывает трек через ту же обрезку, поэтому выноска не съедет.

## Прозрачная сцена и свечение

`<Stage transparent>` рисует 3D поверх плейта и **не включает пост-обработку**: bloom, глубина резкости, виньетка и тон-маппинг пишут непрозрачные пиксели и закрыли бы плейт. Поэтому над футажом:

- свечение и ореол даёт финиш — `../grade-finish/scripts/finish.py --glow --halation` по всему кадру, и плейт, и 3D светятся одинаково;
- зерно — слой `<Grain>` поверх всех трёх слоёв: одно зерно на всём сшивает графику и съёмку;
- глубина резкости — если фон плейта размыт, а текст стоит в этом фоне, оберни `<Stage>` в `<AbsoluteFill style={{ filter: "blur(1.5px)" }}>`.

## Правила

- Плейт, вырезка и трек — из одного `frames.py`. Пересобрал кадры — пересобери маску и трек.
- Текст за объектом читается, только если объект перекрывает его частично. Закрыто больше трети буквы — сдвинь текст или уменьши.
- Цвет 3D подгоняй под плейт, а не наоборот: [references/compositing.md](references/compositing.md), раздел «Цвет».
- Не трекай то, что меняет форму или уходит из кадра. Нужна точка на лице — бери переносицу, не губы.
- Медленнее 25 % без `--slowmo` — будут видны повторы кадров.
- `matte.py --mode person` без файла модели не работает. Модель скачивает пользователь — см. [references/matte-guide.md](references/matte-guide.md).

## Совместно с другими скиллами

- `cinematic-director` — решает, нужен ли футаж, и ставит шот в раскадровку.
- `blender-3d` — свой продукт вместо съёмки: те же `plate/` и `cutout/`.
- `space-type` — как поставить 3D-текст за объектом читаемо.
- `cut-rhythm` — `../cut-rhythm/scripts/match_cut.py` подбирает пару кадров для монтажа по форме; speed ramp ставь на доли.
- `grade-finish` — свечение, ореол, LUT и размытие движения на мастере.
- `cinema-review` — проверка готового ролика.
