# style_test — доказательство, что пак даёт красивую картинку

Две автономные страницы (без игровой логики):
- `index.html` — ночная мокрая улица (`?shot=a|b|c` — три ракурса).
- `tavern_interior.html` — разрез входимого интерьера таверны.

## Запуск
Из корня репо:
```bash
npm i three            # нужен только three
npx vite --open /tools/style_test/index.html
# или: python3 -m http.server 8000  → http://localhost:8000/tools/style_test/index.html
```
Импорт-мап в страницах указывает на `../../node_modules/three`, ассеты — на `../../assets/`. Не перекладывай файлы.

## Что копировать в игру
Блок «lighting», «ground», «puddles», «rain», «post» из `index.html`. Масштабы: town_kit ×1.4, hex-здания ×2.3, мини-NPC ×1.35, герой ×0.62.

Эталонные скриншоты: `docs/screenshots/proof_*.png`.
