# Установка

Распакуйте архив. Получится папка `claude-motion-studio` — в ней `skills/` с восемью скиллами и служебная папка `.claude-plugin/` (начинается с точки, поэтому в Finder и Проводнике скрыта — это нормально).

## 1. Инструменты для видео

Один раз на компьютер.

**Node.js 18+** — с nodejs.org (версия LTS). Проверка:

```bash
node --version
```

**ffmpeg:**

```bash
brew install ffmpeg
```

На Windows — `winget install ffmpeg`, на Linux — `sudo apt install ffmpeg`. Проверка: `ffmpeg -version`.

**Python 3.8+** — на macOS и Linux обычно уже есть: `python3 --version`. На Windows — с python.org.

## 2. Скиллы

### Claude Code — как плагин

Из папки, где лежит распакованный архив:

```bash
claude plugin marketplace add ./claude-motion-studio
```

```bash
claude plugin install insider-motion-studio@ai-insider-motion
```

Перезапустите Claude Code. Скиллы появятся в меню по `/` с префиксом: `/insider-motion-studio:motion-director`. Папку после установки не удаляйте — плагин загружается из неё.

### Claude Code — отдельные скиллы без префикса

```bash
cp -R claude-motion-studio/skills/* ~/.claude/skills/
```

Скиллы связаны: `kinetic-type` и другие обращаются к скриптам `motion-director` и `render-review` по соседним папкам. Копируйте все восемь вместе.

### Claude Cowork и приложение Claude

Скиллы загружаются по одному архивом: заархивируйте папку скилла (например, `skills/motion-director`) в ZIP и загрузите в настройках, раздел «Скиллы» (Skills). Для рендера нужна среда, где есть Node.js и ffmpeg; в облачной песочнице без них скиллы напишут проект и раскадровку, но видео не отрендерят. Для полного цикла используйте Claude Code на своём компьютере.

### Codex

```bash
mkdir -p ~/.agents/skills && cp -R claude-motion-studio/skills/* ~/.agents/skills/
```

## 3. Первый проект

Попросите агента: «Сделай тестовый рилс из шаблона Motion Studio». Он создаст проект и спросит разрешения на `npm install`. Или вручную:

```bash
python3 claude-motion-studio/skills/motion-director/scripts/new_project.py ./my-video
```

```bash
cd my-video && npm install
```

```bash
npx remotion studio
```

Откроется Remotion Studio в браузере: все композиции, предпросмотр, props. Первый рендер скачает Chrome для рендера — около 100 МБ, один раз.

## Разрешения

Агент спросит разрешение на `npm install`, `npx remotion …`, `python3 …` и `ffmpeg`. Скрипты читают указанные файлы и пишут результат в папку проекта; `capture.py` открывает адреса, которые вы назвали. Ничего не отправляют и не удаляют.

## Обновление и удаление

```bash
claude plugin marketplace update ai-insider-motion
```

```bash
claude plugin uninstall insider-motion-studio@ai-insider-motion
```

Уже созданные проекты обновление не меняет: шаблон копируется в момент создания.

## Если что-то не работает

| Что видите | Что сделать |
|---|---|
| Скиллов нет в меню `/` | Перезапустить агента; в папке скилла должен быть `SKILL.md` |
| `node: command not found` | Установить Node.js, открыть новый терминал |
| `ffmpeg not found` | Установить ffmpeg (шаг 1) |
| `template not found` | Скилл `motion-director` скопирован без папки `template/` — скопируйте папку целиком |
| Рендер упал | Таблица ошибок — `skills/render-review/references/troubleshooting.md` |
| Не видно `.claude-plugin` | Скрытая папка. В Finder: Cmd+Shift+точка. Для установки видеть её не нужно |
