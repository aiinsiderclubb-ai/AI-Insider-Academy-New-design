# Флаги скриптов Blender

Общий вид: `blender -b --factory-startup -P <скрипт> -- <флаги скрипта>`. Всё после `--` получает скрипт. `--factory-startup` — без пользовательских настроек и аддонов Blender: одинаковый результат на любой машине.

## product_turntable.py

| Флаг | По умолчанию | Что делает |
|---|---|---|
| `--out` | — (обязателен) | папка футажа, обычно `public/footage/<name>` |
| `--name` | имя папки | `name` в `meta.json` |
| `--product` | `device` | `device`, `bottle`, `earbuds-case` |
| `--look` | `graphite` | `graphite`, `studio-white`, `warm`, `night-blue` |
| `--frames` | 180 | кадров |
| `--fps` | 30 | частота |
| `--res` | `1080x1920` | `ШИРИНАxВЫСОТА`; горизонталь — `1920x1080` |
| `--engine` | `eevee` | `eevee` или `cycles` |
| `--samples` | 32 (EEVEE), 48 (Cycles) | качество |
| `--turn` | 50 | на сколько градусов поворачивается продукт за шот |
| `--orbit` | 12 | на сколько градусов облетает камера |
| `--lens` | 70 | фокусное, мм (полный кадр). 50 — шире, 85–100 — плотнее и «дороже» |
| `--only` | оба прохода | `plate` или `cutout` |
| `--save-blend` | — | сохранить сцену `.blend` |
| `--no-render` | — | только собрать сцену (вместе с `--save-blend`) |

Примеры:

```bash
# вертикальный демо-телефон для FootageFX
blender -b --factory-startup -P scripts/product_turntable.py -- --out public/footage/device --name device --product device --look graphite --frames 180 --fps 30 --res 1080x1920

# флакон для горизонтального ролика, финальное стекло в Cycles
blender -b --factory-startup -P scripts/product_turntable.py -- --out public/footage/bottle --product bottle --look warm --frames 150 --res 1920x1080 --engine cycles --samples 64

# кейс на белой циклораме, почти без облёта, длинный объектив
blender -b --factory-startup -P scripts/product_turntable.py -- --out public/footage/case --product earbuds-case --look studio-white --turn 30 --orbit 4 --lens 100

# сцена для ручной доводки в Blender, без рендера
blender -b --factory-startup -P scripts/product_turntable.py -- --out public/footage/device --save-blend device.blend --no-render
```

## logo_extrude.py

| Флаг | По умолчанию | Что делает |
|---|---|---|
| `--svg` или `--text` | — (одно из двух) | SVG-логотип или текст |
| `--font` | шрифт Blender | TTF/OTF для `--text`; для кириллицы — шрифт с кириллицей |
| `--out`, `--name` | — | как у турнтейбла |
| `--material` | `chrome` | `chrome`, `gold`, `black-chrome`, `glass`, `matte` |
| `--anim` | `reveal` | `reveal` — поднимается из лежачего положения и встаёт, потом по лицу проходит световая полоса; `turntable` — один плавный поворот на `--turn` |
| `--look` | `graphite` | стиль студии |
| `--width` | 2.0 | ширина логотипа в единицах сцены |
| `--depth` | 0.18 | глубина выдавливания |
| `--bevel` | 0.018 | фаска: она ловит свет, без неё логотип — плоская плита |
| `--turn` | 40 | градусы поворота для `turntable` |
| `--frames`, `--fps`, `--res` | 120, 30, `1920x1080` | |
| `--engine`, `--samples` | `eevee`; 32 (64 для стекла и Cycles) | |
| `--lens` | 85 | |
| `--only`, `--save-blend`, `--no-render` | | как у турнтейбла |

SVG: импортируются только заливки. Обводки и текст в SVG переведи в кривые в редакторе (Illustrator: Object → Expand; Figma: Outline stroke и Flatten). Вложенные контуры — буква «О», кольцо — становятся дырами.

```bash
# хромированный логотип с разворотом — logo sting
blender -b --factory-startup -P scripts/logo_extrude.py -- --svg brand/logo.svg --out public/footage/logo --material chrome --anim reveal

# золото на тёплом фоне, вертикаль
blender -b --factory-startup -P scripts/logo_extrude.py -- --svg brand/logo.svg --out public/footage/logo-gold --material gold --look warm --res 1080x1920

# текстовый логотип кириллицей из шрифта клиента
blender -b --factory-startup -P scripts/logo_extrude.py -- --text "ИИ" --font brand/Unbounded-ExtraBold.ttf --out public/footage/mark --material black-chrome --anim turntable

# стеклянный логотип: только Cycles
blender -b --factory-startup -P scripts/logo_extrude.py -- --svg brand/logo.svg --out public/footage/logo-glass --material glass --engine cycles --samples 96
```

## Общее

- Вывод: `plate/frame_00001.png …`, `cutout/frame_00001.png …`, `meta.json`. Повторный запуск в ту же папку перезаписывает проходы.
- В конце скрипт печатает время каждого прохода и секунды на кадр: `[studio] plate: 180 frames in 514.0 s (2.86 s/frame)`.
- Цвет — AgX (кинематографичный спад бликов), если Blender его поддерживает, иначе Filmic.
