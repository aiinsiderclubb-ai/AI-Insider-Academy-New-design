# Рецепты: типографика в сцене

Сниппеты написаны для файла в `src/compositions/` проекта. Пропсы компонентов — те, что в `src/three/*.tsx` и `src/layers/*.tsx`. Время везде в секундах.

Общий заголовок файла:

```tsx
import React from "react";
import { AbsoluteFill } from "remotion";
import { lookOf } from "../lib/looks";
import { Stage } from "../three/Stage";
import { Type3D, REVEALS, EXITS } from "../three/Type3D";
import { locked, dolly, orbit, handheld, cutBetween } from "../three/camera";
import { Grain, Letterbox } from "../layers/Finish";
```

## 1. Заголовок поднимается за продуктом (реальное видео)

Бутерброд из трёх слоёв: плейт снизу, прозрачный 3D-слой с текстом, вырезанный продукт сверху. Продукт закрывает буквы точно по пикселю, потому что вырезка сделана из того же кадра. Плейт и вырезку готовит `footage-composite` (`frames.py`, `matte.py`) или `blender-3d`. Пример целиком — `src/compositions/FootageFX.tsx`.

```tsx
import { Plate, Cutout, speedRamp } from "../layers/Footage";

export const TitleBehind: React.FC = () => {
  const look = lookOf("keynote");
  const remap = speedRamp([[0, 1], [0.9, 1], [1.3, 0.28, "expoOut"], [3.9, 0.28], [4.4, 2.2, "expoIn"]]);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Plate name="device" remap={remap} />
      <Stage look={look} camera={locked([0, 0, 9], [0, 0, 0], 50)} transparent focusRange={6} aberrationBoost={0}>
        <Type3D
          text="ТИТАН"
          look={look}
          size={0.6}            /* 9:16, d≈10, 50 мм: ширина кадра 2,7 → слово ≈ 2,2 (82 %) */
          depth={0.25}
          bevel={0.025}
          tracking={-0.02}
          position={[0, 1.1, -1]}
          reveal={{ at: 1.0, ...REVEALS.riseFromDepth, stagger: 0.07 }}
          exit={{ at: 4.3, duration: 0.5, stagger: 0.03, ease: "expoIn", pose: { y: 2.5, opacity: 0 } }}
        />
      </Stage>
      <Cutout name="device" remap={remap} />
      <Grain amount={look.post.grain} />
    </AbsoluteFill>
  );
};
```

- Плейт и вырезка получают один и тот же `remap`, иначе продукт «отклеится» от фона.
- Подъём текста ставь на начало замедления: зритель успевает прочитать.
- Высоту буквы выбирай так, чтобы продукт закрывал нижние 20–40 % букв. Закрыта только середина одной буквы — выглядит как ошибка.
- Камера `locked`: плейт снят своей камерой, 3D-камера с ним не совпадает. Двигай 3D-камеру, только если трекер дал движение (`useTrack`) и ты переносишь его в позицию.

## 2. Текст за объектом без видео (чистое 3D)

В 3D закрытие делает буфер глубины: объект ближе к камере, текст дальше.

```tsx
import { Monolith, Rings } from "../three/Objects";

<Stage look={look} camera={orbit({ end: 6, radius: 7, height: 0.4, fromDeg: -20, toDeg: 15, mm: 50 })} focusRange={2.5}>
  <Monolith look={look} position={[0, 0, 0.8]} spin={14} tilt={[0, -15, -6]} />
  <Type3D text="ЗА ГРАНЬЮ" look={look} size={0.55} depth={0.24} position={[0, 0.2, -0.9]}
          reveal={{ at: 0.5, ...REVEALS.riseFromDepth }} />
  <Rings look={look} radius={2.4} count={2} appear={1.4} glow={1.8} />
</Stage>
```

Орбита камеры сдвигает объект относительно текста (параллакс), и закрытая часть надписи меняется. Это и продаёт глубину.

## 3. Слово пролетает сквозь камеру и становится склейкой

```tsx
import { Sequence2 } from "../layers/Transitions";
import { Streaks } from "../three/Trails";
import { track } from "../lib/curves";

const travel = track<number>([[0, 0], [2.2, 30, "expoIn"], [3.4, 95, "expoIn"]]);   // путь, не скорость

const ShotA = () => (
  <Stage look={look} camera={handheld(locked([0, 0.2, 6], [0, 0, -10], 28), 0.04, 1.2)} focusRange={6}>
    <Streaks look={look} speed={(t) => travel(t)} count={220} radius={7} length={4} />
    <Type3D text="БУДУЩЕЕ" look={look} size={0.62} depth={0.2}
            reveal={{ at: 0.5, ...REVEALS.flyIn }}
            exit={{ at: 2.6, ...EXITS.pastCamera }} />     {/* 2,6 + 0,6 = 3,2 — момент склейки */}
  </Stage>
);

<Sequence2 at={3.2} kind="zoom" duration={0.4} a={<ShotA />} b={<ShotB />} />
```

Склейку ставь в момент, когда буквы закрывают кадр. Глаз следит за ними и не замечает стык. Сделано в `TechFilm.tsx`.

## 4. Текст по кольцу вокруг объекта

```tsx
import { GlassCore } from "../three/Objects";
import { RingType } from "../three/RingType";

<Stage look={lookOf("neon")} camera={orbit({ start: 0, end: 9, center: [0, -0.1, 0], radius: 6.2, height: 0.35, fromDeg: 0, toDeg: 28, mm: 35 })} focusRange={3.5}>
  <GlassCore look={look} shape="knot" radius={1.05} spin={18} />
  <RingType text="ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ" look={look} radius={2.3} size={0.3} speed={22}
            tilt={[12, 0, -8]} appear={0.4} glow={0.35} />
  <RingType text="NEURAL CORE · 2026 · ONLINE" look={look} font={look.font.mono} radius={3.1} size={0.12}
            speed={-14} tilt={[-10, 0, 8]} appear={1.2} glow={1.2} />
</Stage>
```

- `repeat` не задавай: `"auto"` сам замкнёт кольцо.
- Наклон кольца `tilt` 8–15° к камере: ближняя дуга опускается и читается, дальняя уходит за объект и в стекле видна искажённой.
- Радиус кольца в 2–2,5 раза больше объекта. Ближе — буквы врезаются в объект.
- Камера выше плоскости кольца на 0,3–0,8 и смотрит чуть сверху. С уровня кольца оно схлопывается в линию.
- Финальный титр ставь под кольцом и уводи прицел камеры вниз (см. `OrbitType.tsx`, `aimDown`). Не ставь его поверх ближней дуги.

## 5. Слово на каждую долю

Темп и доли берёт `cut-rhythm` (`beats.py` → `public/data/beats.json`). Положи нужные доли в пропсы или импортируй JSON из `src/data/`.

```tsx
import { Burst } from "../three/Particles";
import { Flash } from "../layers/Finish";
import { dolly, cutBetween, type CameraMove } from "../three/camera";

const hits = [0.47, 1.41, 2.34, 3.28];         // сильные доли, секунды
const words = ["БЫСТРЕЕ", "ВЫШЕ", "СИЛЬНЕЕ", "СЕЙЧАС"];
const angles: [number, number, number][] = [[0, 0, 7], [-2.4, 1.2, 6], [2.6, -0.9, 6.4], [-1.2, -1.6, 5.6]];

const shots: [number, CameraMove][] = hits.map((at, i) => {
  const a = angles[i];
  const end = hits[i + 1] ?? at + 1;
  return [at, dolly({ start: at, end, from: [a[0] * 1.3, a[1] * 1.3, a[2] + 2.4], to: a, ease: "snap", mmFrom: 24, mmTo: 32 })];
});

<Stage look={lookOf("kinetic")} camera={cutBetween(shots)} focusRange={4} aberrationBoost={2}>
  {words.map((w, i) => (
    <Type3D key={i} text={w} look={look} size={0.36} depth={0.18} bevel={0.012}   /* 9:16: ~85 % ширины */
            color={i % 2 ? look.accent : undefined}
            reveal={{ at: hits[i], ...(i % 2 ? REVEALS.flyIn : REVEALS.burst), duration: 0.32, stagger: 0.02 }}
            exit={{ at: (hits[i + 1] ?? hits[i] + 1) - 0.12, ...EXITS.pastCamera, duration: 0.12, stagger: 0 }} />
  ))}
  {hits.map((at, i) => <Burst key={i} look={look} at={at} count={180} speed={6} life={0.9} seed={i + 3} />)}
</Stage>
{hits.map((at, i) => <Flash key={i} at={at} frames={2} peak={0.55} />)}
```

Каждое слово появляется на долю и на ней же меняется угол камеры. Склейка происходит внутри 3D-мира, слова остаются в одном пространстве. Вспышка — 2 кадра и не ярче 0,6, иначе ролик мигает. Сделано в `KineticSpot.tsx`. Перед рендером проверь ширину слов по [sizing.md](sizing.md).

## 6. Подписи HUD

```tsx
<Type3D text="СИНХРОНИЗАЦИЯ" look={look} font={look.font.mono} size={0.06} depth={0.002} bevel={0}
        tracking={0.2} position={[1.8, 0.9, 0.3]} color="#000000" emissive={look.accent} emissiveIntensity={2}
        reveal={{ at: 4.5, duration: 0.05, stagger: 0.025, ease: "linear", pose: { opacity: 0 } }} />
<Type3D text="99.8%" look={look} font={look.font.mono} size={0.14} depth={0.002} bevel={0}
        position={[1.85, 0.7, 0.3]} color="#000000" emissive={look.accent2} emissiveIntensity={2.5}
        reveal={{ at: 4.8, duration: 0.05, stagger: 0.04, ease: "linear", pose: { opacity: 0 } }} />
```

Чёрный цвет и сильное свечение дают чистый светящийся знак, bloom делает ореол. Готовый прицел с подписями — `HudReticle` (`vfx-toolkit`).

## 7. Текст рядом с моделью клиента

Модель `.glb` кладут в `public/models/`. Если её нет, а нужна фотореалистичная — `blender-3d`.

```tsx
import { Model } from "../three/Model";

<Stage look={lookOf("chrome")} camera={dolly({ end: 5, from: [1.2, 0.6, 8], to: [0.3, 0.3, 6.4], mmFrom: 40, mmTo: 50 })}
       focus={() => [0, -1.5, 0]} focusRange={1.8}>
  <Model file="models/sneaker.glb" look={look} size={2.4} spin={18} rotation={[0, -30, 0]} />
  <Type3D text="AIR" look={look} size={0.9} depth={0.3} position={[0, 0.1, -1.6]}
          reveal={{ at: 1.2, ...REVEALS.swing }} />
  <Type3D text="Лёгкость на каждом шаге" look={look} font={look.font.text} size={0.18} depth={0.01} bevel={0}
          position={[0, -1.5, 0.5]} reveal={{ at: 2.6, ...REVEALS.flip, pose: { rx: -40, opacity: 0 } }} />
</Stage>
```

Крупное слово ставь за моделью (z < 0): модель перекрывает его на вращении. Фокус (`focus`) веди туда, куда должен смотреть зритель. В этой сцене — на подзаголовок, когда он появился.
