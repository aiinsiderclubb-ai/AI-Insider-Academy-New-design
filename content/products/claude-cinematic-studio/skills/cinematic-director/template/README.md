# Проект Claude Cinematic Studio

Remotion + three.js. Время в секундах, частота кадров — из prop `fps`.

```bash
npm install
npx remotion studio                                   # предпросмотр
npx remotion still HeroTitle out/f.png --frame=120     # стоп-кадр
npx remotion render HeroTitle out/hero.mp4             # 30 fps
npx remotion render HeroTitle out/hero@120.mp4 --props '{"fps":120}'   # для motion blur
```

Композиции: `HeroTitle`, `OrbitType`, `TechFilm`, `KineticSpot`, `FootageFX`. `FootageFX` ждёт футаж в `public/footage/<имя>/` (plate/, cutout/, meta.json, track-*.json) — его делают скрипты `footage-composite` или `blender-3d`.

Карта файлов и компонентов — `skills/cinematic-director/references/template-map.md` в наборе.
