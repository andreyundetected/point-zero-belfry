# 00 · С чего начать (пак «Окно v2»)

## Что в архиве
```
assets/            ← 1700+ моделей, звуки, HDRI, текстуры, шрифты (≈90 МБ)
  models/…           GLB по папкам; подробности — docs/02_ASSET_GUIDE.md
  INDEX_models.txt   список всех моделей (размеры, треугольники, анимации)
  ASSET_MANIFEST.md  сводка
docs/
  00_README_START.md   этот файл
  01_LEVEL_SPEC.md     ПОЛНАЯ спека уровня «Часовая набережная» (со ссылками на ассеты в [скобках])
  02_ASSET_GUIDE.md    масштабы, загрузка, рецепт картинки, анимации, оговорки
  03_START_PROMPT.md   промпт для облачной сессии
  screenshots/         эталонные картинки (ночная улица, интерьер таверны, каталоги)
tools/style_test/  ← две рабочие страницы-доказательства стиля
CREDITS.md         ← авторы и лицензии
```

## Git: как положить это в новую ветку
Старая ветка `claude/sweet-davinci-1ym3mj` — рабочее ядро (+-), но очень плохой визуал, бездушные NPC, мало диалогов. Её не трогаем. Новая ветка стартует с нуля от `master`, а старый код кладём в `reference_old/` только для чтения (агент смотрит, как он выглядит, но не основывается на нём).

```bash
git fetch origin
git checkout -b v2/chasovaya-nabereznaya origin/master
mkdir -p reference_old
git archive origin/claude/sweet-davinci-1ym3mj | tar -x -C reference_old
rm -rf reference_old/node_modules
unzip -o ~/Downloads/okno-v2-pack.zip -d .
git add -A
git commit -m "v2: asset pack + level spec + old code as reference"
git push -u origin v2/chasovaya-nabereznaya
```
Когда уровень будет готов, `reference_old/` удали одним коммитом.

## Что дальше
1. Открой `tools/style_test/index.html` (инструкция там же) и убедись, что картинка тебе нравится.
2. Запусти облачную сессию на ветке `v2/chasovaya-nabereznaya` и вставь промпт из `docs/03_START_PROMPT.md`.
3. Спека — единственный источник правды. Хочешь изменить сюжет — правь `01_LEVEL_SPEC.md`, не код.
