# 00 · С чего начать (пак «Окно v4 — Затон»)

## Что в архиве
```
assets/              ← все модели, звуки, HDRI, текстуры, шрифты (≈130 МБ распакованным)
  textures/city/       PBR-текстуры города: кирпич, штукатурка, камень, черепица, брусчатка, плиты, доски
  models/people/       реалистичные тела Mixamo + библиотека анимаций UAL
  models/interior_q/   мебель для приюта, домов, кабинетов
  models/village_q/    колокол, скамьи, повозка, камни
  INDEX_models.txt     список всех моделей (размер, треугольники, анимации)
docs/
  00_README_START.md   этот файл
  01_GAME_SPEC.md      ПОЛНАЯ спека: сюжет, мир, карта, места, люди, механики, хронология, прохождение, финал
  02_DIALOGUES.md      все диалоги
  03_ASSET_GUIDE.md    ассеты: что где, масштабы, сборка людей, ретаргет анимаций
  04_START_PROMPT.md   промпт для облачной сессии
  screenshots/         эталон картинки style_v4_street.png
tools/
  style_test/noir.html эталон стиля: процедурная улица, канал, мост, переулок (от первого лица, можно ходить)
  shot.cjs             скриншоты через Playwright
CREDITS.md           авторы и лицензии (всё CC0 / OFL)
```

Старый пак (`okno-v2-pack.zip`) больше не нужен: всё нужное отсюда, старые спеки недействительны.

## Git: новая ветка
```bash
cd point-zero-belfry
git fetch origin
git checkout -b v3/zaton origin/main
git rm -r -q --ignore-unmatch src docs tools assets reference_old public index.html vite.config.* package*.json tsconfig*.json
unzip -o ~/Downloads/okno-v4-pack.zip -d .
git add -A
git commit -m "v3: Затон — спека, диалоги, ассеты, эталон стиля"
git push -u origin v3/zaton
```
Если основная ветка называется `master`, замени `origin/main` на `origin/master`. Старый код остаётся в истории git.

## Посмотреть стиль до запуска сессии
```bash
npm i three
npx vite --open /tools/style_test/noir.html
```
Клик по экрану — захват мыши, WASD — ходить. `?shot=1..5` — ракурсы, `?people=1` — люди (в работе), `?sat=0.2` — доля цвета.

## Дальше
1. Запусти облачную сессию на ветке `v3/zaton` и вставь промпт из `docs/04_START_PROMPT.md`

2. Спека — единственный источник правды. Хочешь изменить сюжет или диалог — правь `01_GAME_SPEC.md` / `02_DIALOGUES.md`, не код
