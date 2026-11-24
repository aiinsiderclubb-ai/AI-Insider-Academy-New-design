---
name: render-review
description: Рендерит видео из проекта Remotion и проверяет его до того, как его увидит пользователь — контактный лист кадров, который агент рассматривает сам, проверка кодека, размера, частоты кадров и быстрого старта под площадку, громкость в LUFS, кадр с зонами, которые закроют кнопки Reels, TikTok и Shorts, и лёгкая копия для сайта. Используй, когда видео нужно отрендерить, экспортировать, проверить перед публикацией, сжать для сайта или Telegram, или когда спрашивают «готово?», «как выглядит?», «подойдёт для рилс?». Renders Remotion compositions and reviews the result with ffmpeg.
license: Proprietary. Licensed to the buyer for own and client work; no resale.
metadata:
  author: AI Insider Academy
  version: "1.0"
---

# Рендер и проверка

Видео не считается готовым, пока ты не посмотрел на его кадры. Скрипты делают кадры и замеры; смотришь и решаешь ты. Нужны Node.js 18+ и ffmpeg.

## Порядок работы

1. **Черновик** — половина размера, быстро, чтобы смотреть движение и тайминг (из папки проекта):

   ```bash
   python3 scripts/render.py KineticType --props props/reel.json --draft
   ```

   Только кусок: `--frames 0-89`. Один кадр в PNG: `--still 120`.

2. **Контактный лист** — и открой его:

   ```bash
   python3 scripts/review.py sheet out/KineticType-draft.mp4 --count 12 --out review/sheet.png
   ```

   Кадры взяты из середин равных отрезков; `times` в ответе — время каждого. Подозрительный момент смотри целым кадром: `review.py frames … --at 2.4 5.1`.

3. **Пройди чек-лист** [references/checklist.md](references/checklist.md) по листу. Нашёл ошибку — исправь, отрендери черновик снова, снова лист. Пользователю показывай лист и что исправил.

4. **Безопасные зоны** для вертикального видео — на каждом кадре с текстом:

   ```bash
   python3 scripts/review.py safezone out/KineticType-draft.mp4 --at 1.5 --platform reels --out review/safe.png
   ```

   Красное закроет интерфейс площадки: сверху — профиль, снизу — подпись, справа от середины вниз — кнопки. Текст и лица — внутри зелёной рамки.

5. **Финал** — полный размер, CRF 18, H.264, yuv420p:

   ```bash
   python3 scripts/render.py KineticType --props props/reel.json --web --max-mb 4
   ```

   `--web` дополнительно делает `…-web.mp4`: 1280 по длинной стороне, быстрый старт, без звука (со звуком — `--keep-audio`), в пределах `--max-mb`. Для сайта, лендинга, Telegram.

6. **Технический контроль** под площадку — [references/platforms.md](references/platforms.md):

   ```bash
   python3 scripts/review.py probe out/KineticType.mp4 --platform reels
   python3 scripts/review.py loudness out/KineticType.mp4 --platform reels
   ```

   `problems` пустой — можно публиковать. Каждая проблема приходит с командой исправления.

## Правила

- Не пиши «готово», «отлично выглядит», пока не открыл контактный лист этого рендера.
- Чек-лист проходи весь, даже если правка была маленькой: поправленный тайминг сдвигает соседние биты.
- Ошибка рендера — читай текст ошибки Remotion; частые случаи — [references/troubleshooting.md](references/troubleshooting.md).
- Финальные файлы не перезаписывай поверх старых версий без спроса — сохраняй `v2`, `v3`.
- Громкость не правь «на слух»: только по замеру `loudness`.
