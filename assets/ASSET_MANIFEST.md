# ASSET_MANIFEST

Сводка по пакету ассетов (все CC0/OFL, лицензии — в `assets/LICENSES/` и `CREDITS.md`).

| Папка | Файлов | МБ |
|---|---:|---:|
| `assets/models/boats` | 29 | 1.3 |
| `assets/models/buildings_hex` | 93 | 12.1 |
| `assets/models/cemetery` | 139 | 3.6 |
| `assets/models/characters` | 23 | 16.9 |
| `assets/models/city_bits` | 41 | 2.4 |
| `assets/models/dungeon` | 203 | 9.1 |
| `assets/models/food` | 200 | 3.0 |
| `assets/models/furniture` | 193 | 3.5 |
| `assets/models/hex_nature` | 42 | 1.4 |
| `assets/models/hex_props` | 26 | 0.7 |
| `assets/models/items_adventurer` | 27 | 0.9 |
| `assets/models/nature` | 329 | 2.9 |
| `assets/models/pirate_kit` | 30 | 2.2 |
| `assets/models/tavern_kitchen` | 144 | 6.3 |
| `assets/models/town_kit` | 153 | 1.8 |
| `assets/models/vehicles` | 28 | 3.3 |
| `assets/models/weapons` | 20 | 0.8 |
| `assets/hdri` | 8 | 1.4 |
| `assets/textures/prototype` | 26 | 0.2 |
| `assets/textures/procedural` | 17 | 1.8 |
| `assets/particles` | 148 | 8.8 |
| `assets/ui` | 105 | 1.6 |
| `assets/audio/impact` | 130 | 1.0 |
| `assets/audio/interface` | 100 | 1.0 |
| `assets/audio/rpg_foley` | 51 | 0.7 |
| `assets/audio/ui` | 51 | 0.3 |
| `assets/audio/digital` | 62 | 0.5 |
| `assets/fonts` | 41 | 0.7 |
| `assets/LICENSES` | 23 | 0.0 |
| **Итого** |  | **90.0** |

## Файлы-индексы
- `assets/INDEX_models.txt` — путь | размеры bbox | треугольники | кол-во анимаций (для всех GLB).
- `assets/INDEX_other_files.txt` — аудио, частицы, иконки, шрифты, текстуры.
- `assets/manifest_models.json` — то же в JSON (+ имена анимаций и размер файла).

## Именование
- Всё `snake_case`, латиница. Кит указан папкой (`town_kit/wall_wood_door`).
- Цветовые варианты `buildings_hex`: суффикс `_red|_blue|_green|_yellow`.
- Персонажи: `npc_mini_male_a..f`, `npc_mini_female_a..f`, `hero_*`, `animal_*`.
- Аудио: `.ogg`; HDRI: `.exr` (512 px); шрифты: `.woff2` (кириллица + латиница).

## Что сделано с исходниками
- GLTF/GLB из Kenney/KayKit/Quaternius конвертированы в единый **GLB**, meshopt-сжатие декодировано (грузятся обычным `GLTFLoader`).
- OBJ оружия (`models/weapons`) сконвертированы в GLB (obj2gltf).
- Герои KayKit облегчены (resample/dedup/prune; все 76 анимаций сохранены).
- Процедурные текстуры (`textures/procedural`) сгенерированы скриптом, не из паков.
- Частицы `smoke_*` уменьшены до ≤256 px.
