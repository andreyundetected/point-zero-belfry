# DECISIONS — принятые решения

Формат: что решили → почему.

## Этап 1
- Three.js 0.170 + Vite + TypeScript; `/assets` раздаётся плагином `serve-assets` (dev — middleware, build — копирование в `dist/assets`). Папка `public/` не используется.
- Рецепт картинки взят 1:1 из `tools/style_test/index.html` (ACES, лунный DirectionalLight, hemi, FogExp2 0.034, HDRI night_512, bloom 0.75/0.7/0.82, грейд, виньетка, зерно). Сравнение со скриншотом `proof_night_street_a.png` — визуально идентично (`docs/screenshots/progress_stage1_a.png`).
- Статика расставляется через `StaticBatcher` (InstancedMesh на модель+часть) ради лимита ≤400 draw calls; всё интерактивное/прозрачнеющее — обычные объекты.
- Пул из 12 PointLight, переназначаемый на ближайшие фонари (спека §4.2).
