# Установка

Распакуйте архив. Получится папка `claude-cinematic-studio`: в ней `skills/` с девятью скиллами и служебная папка `.claude-plugin/`. Она начинается с точки, поэтому в Finder и Проводнике скрыта — это нормально.

## 1. Инструменты

Ставятся один раз на компьютер.

**Node.js 18+** — с nodejs.org, версия LTS. Проверка:

```bash
node --version
```

**ffmpeg:**

```bash
brew install ffmpeg
```

На Windows — `winget install ffmpeg`, на Linux — `sudo apt install ffmpeg`. Проверка: `ffmpeg -version`.

**Python 3.9+.** На macOS и Linux он обычно уже есть: `python3 --version`. На Windows — с python.org.

**Библиотеки для масок и трекинга** нужны только скиллу `footage-composite`:

```bash
python3 -m pip install -r claude-cinematic-studio/skills/footage-composite/scripts/requirements.txt
```

**Blender 4.x** нужен только скиллу `blender-3d`. Бесплатно, с blender.org. На macOS проверка: `/Applications/Blender.app/Contents/MacOS/Blender --version`. Удобно добавить его в PATH, тогда хватит `blender --version`.

## 2. Скиллы

### Claude Code — как плагин

Из папки, где лежит распакованный архив:

```bash
claude plugin marketplace add ./claude-cinematic-studio
```

```bash
claude plugin install insider-cinematic-studio@ai-insider-cinematic
```

Перезапустите Claude Code. Скиллы появятся в меню по `/` с префиксом, например `/insider-cinematic-studio:cinematic-director`. Папку после установки не удаляйте: плагин загружается из неё.

### Claude Code — отдельные скиллы без префикса

```bash
cp -R claude-cinematic-studio/skills/* ~/.claude/skills/
```

Скиллы связаны: каждый обращается к скриптам соседних по их папкам. Копируйте все девять вместе.

### Claude Cowork и приложение Claude

Скиллы загружаются по одному архивом. Заархивируйте папку скилла (например, `skills/cinematic-director`) в ZIP и загрузите в настройках, раздел «Скиллы» (Skills).

Для рендера нужна среда с Node.js, ffmpeg и графикой. В облачной песочнице скиллы напишут концепцию, раскадровку и код сцен, но 3D-видео не отрендерят. Для полного цикла используйте Claude Code на своём компьютере.

### Codex

```bash
mkdir -p ~/.agents/skills && cp -R claude-cinematic-studio/skills/* ~/.agents/skills/
```

## 3. Первый проект

Попросите агента: «Сделай тестовый ролик из шаблона Cinematic Studio». Он создаст проект и спросит разрешения на `npm install`. Или вручную:

```bash
python3 claude-cinematic-studio/skills/cinematic-director/scripts/new_project.py ./my-film
```

```bash
cd my-film && npm install
```

```bash
npx remotion studio
```

Откроется Remotion Studio в браузере: все композиции, предпросмотр, props. Первый рендер скачает Chrome для рендера — около 100 МБ, один раз.

Проверка, что 3D рендерится:

```bash
npx remotion still HeroTitle out/test.png --frame=120 --scale=0.5
```

В `out/test.png` должен быть металлический заголовок «НОВАЯ ЭРА» с кольцами.

## Разрешения

Агент спросит разрешение на `npm install`, `npx remotion …`, `python3 …`, `ffmpeg` и `blender`. Скрипты читают указанные файлы и пишут результат в папку проекта. Ничего не отправляют и не удаляют.

## Обновление и удаление

```bash
claude plugin marketplace update ai-insider-cinematic
```

```bash
claude plugin uninstall insider-cinematic-studio@ai-insider-cinematic
```

Уже созданные проекты обновление не меняет: шаблон копируется в момент создания.

## Если что-то не работает

| Что видите | Что сделать |
|---|---|
| Скиллов нет в меню `/` | Перезапустить агента; в папке скилла должен быть `SKILL.md` |
| `node: command not found` | Установить Node.js, открыть новый терминал |
| `ffmpeg not found` | Установить ffmpeg (шаг 1) |
| `template not found` | Скилл `cinematic-director` скопирован без папки `template/` — скопируйте папку целиком |
| Кадр чёрный или без 3D | Нет WebGL. В `remotion.config.ts` замените `angle` на `swangle` (медленнее). На Linux без GPU — только так |
| Кадр есть, текста нет | Не загрузился шрифт: `npm install` ещё раз, рендер с `--log=verbose` |
| `No module named cv2` | Шаг 1: библиотеки для масок и трекинга |
| `blender: command not found` | Указать полный путь к Blender или добавить его в PATH |
| Рендер очень медленный | Черновики — с `--scale=0.5`; закройте другие 3D-программы; подробнее — `skills/vfx-toolkit/references/performance.md` |
| Не видно `.claude-plugin` | Скрытая папка. В Finder: Cmd+Shift+точка. Для установки видеть её не нужно |
