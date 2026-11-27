---
name: vfx-toolkit
description: Визуальные эффекты и кинодетали для 3D-сцен — свечение и bloom, световые следы, гиперпространство, частицы и пыль в луче, взрыв частиц на ударе, орбитальные кольца, неоновая сетка, зеркальный пол, стеклянное преломление, хроматическая аберрация, глубина резкости, голографический HUD, зерно, кашетирование, вспышки, засветки плёнки, переходы. Используй, когда просят VFX, эффекты, «чтобы светилось», glow, light trails, particles, футуристичную графику, HUD, интерфейсы в пространстве, хроматическую аберрацию, «как в рекламе технологий», «добавь вау», а также чтобы встроить свою модель .glb. Cinematic VFX building blocks for the Remotion + three.js template, deterministic and render-safe.
license: Proprietary. Licensed to the buyer for own and client work; no resale.
metadata:
  author: AI Insider Academy
  version: "1.0"
---

# VFX: эффекты и кинодетали

Эффекты здесь — элементы той же 3D-сцены, а не фильтры поверх. Следы света огибают объект и уходят за него, частицы стоят на разной глубине и размываются глубиной резкости, свечение берётся из настоящих «ярких» цветов через bloom. Всё детерминировано: каждый кадр зависит только от времени и seed. Повторный рендер и рендер ×4 для motion blur совпадают до пикселя.

Компоненты: `src/three/Objects.tsx`, `Particles.tsx`, `Trails.tsx`, `Hud.tsx`, `Model.tsx`. Пост-обработка встроена в `src/three/Stage.tsx`. 2D-слои поверх кадра — `src/layers/Finish.tsx` и `Transitions.tsx`. Проект создаёт `cinematic-director`.

## Что нужно на входе

- Раскадровка: в каком кадре какой эффект и зачем.
- Стиль (look): он задаёт силу bloom, аберрации, зерна, виньетки и боке (`look.post`) и два акцентных цвета (`look.accent`, `look.accent2`).
- Модель продукта `.glb` в `public/models/`, если есть.

## Порядок работы

1. **Один главный эффект на кадр.** Остальное — атмосфера на втором плане. Выбирай по таблице ниже и [references/effects-catalog.md](references/effects-catalog.md).
2. **Свет — это яркость выше 1.** Светится то, у чего цвет `hdr(цвет, сила)` и `toneMapped={false}`: bloom подхватывает только яркое выше порога `look.post.bloomThreshold`. Белая краска не светится.
3. **Глубина.** Ставь эффект перед объектом и за ним: частицы в объёме, кольца вокруг, следы с огибанием. Плоские эффекты в одной плоскости с текстом — главный признак «AI-видео».
4. **Время.** Каждый эффект привязан к событию: `Burst` — на удар, `LightTrail` — к движению камеры или склейке, `Rings` — к появлению заголовка (+1 с), `Flash` — на склейку.
5. **Проверь кадрами и стоимостью.** Стоп-кадры `--scale=0.5` на пике эффекта. Если рендер кадра дольше 3 с, см. [references/performance.md](references/performance.md).
6. **Новый эффект** (линза, глитч, лучи) — по [references/adding-effects.md](references/adding-effects.md), с соблюдением детерминизма.

## Задача → эффект

| Нужно | Эффект | Ключевые значения |
|---|---|---|
| Дорогой продуктовый кадр | `MirrorFloor` + `Dust` (белая, `glow` 0,8–1) + стрипы `Stage` | пыль 500–900, `size` 0,03–0,045 |
| Технологичность, данные | `GridFloor` + `HudReticle` + `LightTrail` | сетка `glow` 0,8–1,6, `speed` 0,6–14 |
| Скорость, переход в новый мир | `Streaks` с ускорением + `pastCamera` у текста | путь 0 → 95 ед. за 3,4 с на `expoIn` |
| Удар на долю | `Burst` + `Flash` (2 кадра) + наезд `snap` | `count` 180–320, `speed` 4–6, `life` 0,9–1,6 |
| Объём вокруг заголовка | `Rings` 2–3 шт. | `radius` = ширина слова ×0,75, `glow` 1,6–2,4 |
| Магия, ИИ, «ядро» | `GlassCore` (`knot` / `sphere`) + `RingType` | `radius` 1–1,2 |
| Плёнка, тепло | `LightLeak` + `Grain` + `Letterbox` 2,39 | leak 0,6–0,9 с, `strength` 0,45–0,7 |
| Голограмма продукта | `Model finish="glass"` + `HudReticle` | — |

## Правила

- **Сдержанность.** Bloom выше 1,5 даёт «молочный» кадр, где пропадает объём. Аберрация на всём кадре и всё время — дёшево. Пусть она появляется от скорости камеры (`aberrationBoost` в `Stage`).
- **Два цвета.** Эффекты используют `look.accent` и `look.accent2`. Третий цвет — только для смыслового акцента, один раз за ролик.
- **Каждый эффект появляется и уходит.** Кольца прорисовываются (`appear`), след летит от и до, вспышка гаснет за 2–3 кадра. Эффект, висящий весь ролик без изменений, — фон, и он должен быть тихим.
- **Мотив.** Один повторяющийся элемент на весь ролик: кольца или след света, или сетка. Не всё сразу. Мотив связывает кадры в фильм.
- **Вспышки — максимум 2–3 кадра и не ярче 0,6–0,85.** Частые белые кадры (больше 3 в секунду) опасны для людей со светочувствительностью и отвергаются площадками.
- **Зерно всегда** (`Grain` с `look.post.grain`): связывает 3D и футаж и убирает полосы на тёмных градиентах.
- **Никаких `Math.random()`, `Date.now()`, `performance.now()` в кадре** — только `useTime()`, `rng(seed)`, `noise1()`.

## Короткий справочник

```tsx
import { hdr, Monolith, GlassCore, Rings, MirrorFloor, GridFloor } from "../three/Objects";
import { Dust, Burst } from "../three/Particles";
import { LightTrail, Streaks } from "../three/Trails";
import { HudReticle } from "../three/Hud";
import { Model } from "../three/Model";
import { Grain, Letterbox, Flash, LightLeak } from "../layers/Finish";
import { Sequence2 } from "../layers/Transitions";

<Rings look={look} radius={2.6} count={2} appear={1.6} glow={1.6} />
<Dust look={look} count={700} size={0.035} glow={0.9} color="#ffffff" />
<Burst look={look} at={7.35} count={320} speed={5} />
<LightTrail look={look} start={3.6} duration={1.6} path={[[-4, -1, 2], [-1.5, 0.6, 1.6], [1.6, 0.9, -1.2], [3.5, -0.2, -3]]} />
<Streaks look={look} speed={(t) => travel(t)} count={220} radius={7} length={4} />
<HudReticle look={look} position={[2.1, 1.1, -0.3]} rotation={[0, -20, 0]} radius={0.4} appear={4.2} label="СИНХРОНИЗАЦИЯ" value="99.8%" />
<GlassCore look={look} shape="knot" radius={1.05} spin={18} />
<GridFloor look={look} y={-1.6} speed={14} />
<MirrorFloor look={look} y={-1.15} />
<Model file="models/product.glb" look={look} size={2.2} spin={20} finish="metal" />
```

Поверх `Stage`, в порядке слоёв: `<LightLeak>`, `<Flash>`, `<Letterbox>`, `<Grain>` — зерно последним.

## Связанные скиллы

- `cinematic-director` — где какой эффект по раскадровке.
- `camera-language` — скорость камеры управляет аберрацией и смазом.
- `space-type` — текст, вокруг которого строятся кольца и частицы.
- `footage-composite` — эффекты поверх реального видео (прозрачный `Stage`).
- `blender-3d` — фотореалистичные объекты, которые не тянет three.js.
- `grade-finish` — motion blur, LUT, ореолы (halation) на финальном файле.
- `cinema-review` — проверка вспышек, полос на градиентах и «мёртвых» отрезков.
