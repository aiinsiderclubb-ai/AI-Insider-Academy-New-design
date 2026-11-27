# Как добавить свой эффект

Главное правило — **детерминизм**: кадр N всегда рендерится одинаково. Remotion рендерит кадры в нескольких вкладках не по порядку, `grade-finish` смешивает рендер ×4 в motion blur, правки перерендеривают куски. Эффект, который зависит от системных часов или случайных чисел, будет мерцать, рваться на стыках чанков и давать разные кадры при повторе.

Запрещено в кадре: `Math.random()`, `Date.now()`, `performance.now()`, `clock.getElapsedTime()`, `useFrame((state) => state.clock…)`, CSS-анимации и `transition`.
Разрешено: `useTime()` (секунды, `src/lib/time.ts`), `useCurrentFrame()`, `rng(seed)` и `noise1(x, seed)` (`src/lib/curves.ts`).

## Эффект пост-обработки

Цепочка собрана массивом в `src/three/Stage.tsx`, внутри компонента `Scene` (там уже есть время `t`, позиция камеры и стиль). Добавь элемент **перед** `ToneMapping`: тон-маппинг всегда последний.

```tsx
import { LensDistortion, GodRays } from "@react-three/postprocessing";
// внутри Scene, рядом с остальными эффектами:
<EffectComposer multisampling={4} enableNormalPass={false}>
  {[
    /* … DOF, Bloom, ChromaticAberration, Vignette … */
    <LensDistortion key="lens" distortion={new THREE.Vector2(lensK, lensK)} />,
    <ToneMapping key="tm" mode={ToneMappingMode.AGX} />,
  ].filter(…)}
</EffectComposer>
```

Удобнее не хардкодить, а пробросить проп-функцию в `Stage` и `Scene`, например `lensAt?: (t: number) => number`, и вычислять `lensK = lensAt?.(t) ?? 0` в `Scene`. Так каждая сцена задаёт свой эффект по времени.

| Эффект | Детерминизм | Как использовать |
|---|---|---|
| `LensDistortion` | да | Бочка 0,05–0,15 на snap-наезде, нарастание по `track()` за 0,2 с и спад за 0,4 с |
| `GodRays` | да | Нужен проп `sun` — ref на яркий меш (сфера `hdr(...)`). Объёмные лучи из-за объекта. Дорого (~1,5×) |
| `TiltShift`, `HueSaturation`, `BrightnessContrast` | да | Мягкая грейдинг-коррекция кадра; основной грейд — в `grade-finish` |
| `Noise` | **нет** — внутри время композера | Не используй. Зерно — `Grain` из `src/layers/Finish.tsx` (seed = номер кадра) |
| `Glitch` | **нет** — случайные сдвиги и свой таймер | Не используй. Свой глитч — ниже |
| `SSAO`, `N8AO` | да, но очень дорого | Только для крупных продуктовых кадров с контактными тенями |

Проверь, что эффект детерминирован: отрендерь один кадр дважды и сравни файлы.

```bash
npx remotion still MyComp out/a.png --frame=90 && npx remotion still MyComp out/b.png --frame=90 && cmp out/a.png out/b.png && echo одинаково
```

## Свой глитч без случайности

```tsx
import { noise1, rng } from "../lib/curves";

// Пик глитча 0,25 с вокруг склейки: сдвиг каналов и «рывок» камеры
const g = Math.max(0, 1 - Math.abs(t - cutAt) / 0.125);
const jitter = noise1(t * 60, 13) * g;            // меняется каждый кадр, повторяемо
const ca = look.post.aberration + 0.012 * g;      // подставь в ChromaticAberration
// 2D-полосы: срезы кадра со сдвигом по x — генерируй через rng(кадр) в слое поверх Stage
const r = rng(Math.round(t * 30));
```

## Материал с шейдером, ведомым временем

```tsx
import { useMemo } from "react";
import * as THREE from "three";
import { useTime } from "../lib/time";

export function Scanner({ color = "#38f0ff" }: { color?: string }) {
  const t = useTime();
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color).multiplyScalar(3) } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
          void main(){ float y = fract(vUv.y - uTime * 0.6); float line = smoothstep(0.0, 0.02, y) * (1.0 - smoothstep(0.02, 0.1, y));
                       gl_FragColor = vec4(uColor * line, line); }`,
      }),
    [color],
  );
  material.uniforms.uTime.value = t;   // время задаётся из кадра, не из часов
  return (
    <mesh material={material}>
      <planeGeometry args={[2, 3]} />
    </mesh>
  );
}
```

Шум внутри шейдера — только хэш от координат и `uTime`, без `random()` из JS.

## Асинхронная загрузка: useRedrawWhenReady

При рендере 3D-холст перерисовывается, когда Remotion переходит на новый кадр (компонент `FrameSync` в `Stage` делает перерисовку после обновления React и только потом отпускает кадр). Всё, что появляется **позже** — догрузился шрифт, текстура, модель, — в снимок не попадёт: кадр будет без этого объекта, и только иногда.

Если эффект что-то загружает (текстуру, `.glb`, JSON, шрифт), используй хук из `src/three/sync.ts`:

```tsx
import { useRedrawWhenReady } from "./sync";

const [tex, setTex] = useState<THREE.Texture | null>(null);
useEffect(() => { new THREE.TextureLoader().loadAsync(staticFile("textures/flare.png")).then(setTex); }, []);
useRedrawWhenReady(Boolean(tex), "flare texture");   // держит кадр, перерисовывает, когда готово
if (!tex) return null;
```

Хук вызывай безусловно, до любого раннего `return`. Метка видна в логах при таймауте. Так сделаны `Type3D`, `RingType` и `Model`. 2D-слоям (`Img`, `staticFile`) это не нужно: Remotion ждёт картинки сам.

## Чек-лист нового эффекта

1. Значения зависят только от `t`, кадра и seed.
2. Яркое — через `hdr()` и `toneMapped={false}`, не белой краской.
3. Загрузка — через `useRedrawWhenReady`.
4. Два рендера одного кадра совпадают (`cmp`).
5. Время кадра выросло не больше чем на 30 % (см. performance.md) или эффект того стоит.
