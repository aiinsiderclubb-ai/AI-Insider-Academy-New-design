# Подготовка логотипа

## Экспорт из редактора

| Редактор | Как сохранить |
|---|---|
| Figma | Выдели знак → Export → SVG. В настройках: Outline text — включить. |
| Illustrator | Type → Create Outlines; Object → Expand; File → Export → SVG, стили: «Presentation attributes». |
| Inkscape | Path → Object to Path (Shift+Ctrl+C) для всего; сохранить как Plain SVG. |
| Canva | Скачать → SVG (только в платном тарифе). |

## Что мешает и как исправить

| Предупреждение скрипта | Что сделать |
|---|---|
| `text — convert it to outlines` | Перевести текст в кривые (Outline / Create Outlines) |
| `embedded raster image` | Внутри SVG картинка, а не векторы. Нужен векторный оригинал у дизайнера |
| `gradient or pattern fill replaced` | Градиент станет цветом стиля. Либо `monochrome: true`, либо замени градиент сплошным цветом |
| `<clipPath> ignored` / `<mask> ignored` | Release Clipping Mask / Release Mask, затем Expand |
| `CSS classes are not read` | Экспорт со стилями «Presentation attributes», не «CSS» |
| `<use> reference` | Expand / Unlink — символ должен стать обычными путями |
| `arc ... approximated` | Растянутые круги под трансформацией: Object → Transform → Reset / Apply |

## Проверка

```bash
python3 scripts/svg_prepare.py logo.svg --report
```

`paths` — сколько контуров будет прорисовано. 1–12 — хорошо; больше 30 — прорисовка станет шумом, предложи упрощённый знак.
