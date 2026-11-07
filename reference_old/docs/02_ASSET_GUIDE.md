# 02 · Гайд по ассетам: как их грузить, масштабировать и не испортить картинку

Все модели — **GLB**, без meshopt (уже декодировано), CC0. Пути относительно корня репо: `assets/models/<папка>/<имя>.glb`. В спеке `[папка/имя]` = этот путь без `assets/models/` и `.glb`.

## 1. Что где лежит

| Папка | Шт. | Что внутри | Для чего |
|---|---|---|---|
| `town_kit` | 153 | Kenney Fantasy Town: модульные стены (камень и дерево), окна, двери, арки, крыши, дымоходы, лестницы, ограды, фонтан, лавки, телеги, фонарь, колесо, деревья | Главный «строитель» зданий и площади |
| `buildings_hex` | 93 | KayKit Medieval Hexagon: дома, таверна, церковь, рынок, кузня, замок, башни, мельницы, колодец, сцена — в 4 цветах | Фоновые силуэты, отдалённые здания, сцена |
| `hex_props` | 26 | Бочки, ящики, мешки, флаги (4 цвета), лестница, тачка, ведра, мишень, палатка | Реквизит, флаги семафора |
| `hex_nature` | 42 | Холмы, горы, деревья, облака, камни | Фон |
| `city_bits` | 41 | KayKit City Builder: современные дома, дороги, машины, светофоры, водонапорка, мусорки | Только `watertower` и точечно `bench`, `streetlight`; остальное — другим уровням |
| `dungeon` | 203 | KayKit Dungeon Remastered: стены/полы (камень, дерево), лестницы, столы, стулья, бочки, полки, факелы, свечи, кровати, ключи, монеты, сундуки, баннеры | Интерьеры (таверна, погреб, башня) |
| `furniture/kenney` | 140 | Kenney Furniture Kit: кровати, столы, диваны, шкафы, кухня, ванная, лампы, ковры, **есть современная техника** | Берём только «нейтральное»: `desk`, `bookcase_*`, `chair_desk`, `coat_rack*`, `lamp_*`, `rug_*`, `bed_*`, `books`, `bench`, `table*`, `plant_*` |
| `furniture/kaykit` | 53 | KayKit Furniture Bits: стулья, шкафы, кровати, рамки, ковры, лампы, полки | Тёплый «домашний» набор — предпочтителен |
| `tavern_kitchen` | 144 | KayKit Restaurant Bits: плиты, столешницы, посуда, банки, ящики с едой, окна, двери, холодильник | Кухня и стойка таверны |
| `food` | 200 | Kenney Food Kit | Еда на столах |
| `cemetery/kenney`, `cemetery/kaykit` | 76 + 63 | Kenney Graveyard + KayKit Halloween: **железные фонарные столбы**, фонари, свечи, оградки, склеп, камни, тыквы | Фонари набережной, ограды, атмосфера |
| `nature` | 329 | Kenney Nature Kit: деревья (много видов), камни, цветы, мосты, дорожки/реки, костры, палатки, скалы | Деревья, мосты и причалы, цветы, камины, окружение |
| `pirate_kit` | 30 | Корабли, лодки, пушки, пираты, пальмы, сундуки | Корабли на рейде, баржа, лодки |
| `boats` | 29 | Kenney Watercraft (`boat_watercraft_pack_001–029`) | Лодки и катера |
| `vehicles` | 28 | Kenney Car Kit (игрушечные машины) | Не для этого уровня; `wheel_*` годится на шестерни |
| `items_adventurer` | 27 | Кружки, мечи, щиты, арбалет, колчан, дымовая бомба, книга заклинаний | Мелкие предметы |
| `weapons` | 20 | Kenney Weapon Pack (пистолеты, ножи, гранаты) | Не для этого уровня |
| `characters` | 23 | 12 мини-NPC (32 анимации), 5 героев KayKit (76 анимаций), 6 животных | Люди и звери |

Остальное: `hdri/` (8 EXR 512), `textures/prototype` (26 тестовых текстур) и `textures/procedural` (мои брусчатка/доски/лужи/ореол/шум), `particles/`, `ui/icons` (105 иконок), `audio/` (394 ogg), `fonts/` (7 семейств, кириллица+латиница).

Полный список с размерами (bbox) и числом треугольников: `assets/INDEX_models.txt` и `assets/manifest_models.json`.

## 2. Масштаб — самая частая причина «уродства»

Паки сделаны в разных масштабах. Подтверждённые рендером множители (в `tools/style_test`):

| Набор | Множитель | Заметки |
|---|---|---|
| `town_kit/*` | **×1.4** | Модуль = 1 ед.; стена 0.1×1×1 (толщина×высота×ширина) |
| `buildings_hex/*` | **×2.3** | Базовый размер ~ один гекс; для силуэтов церкви ×3.4 |
| `hex_props/*` | ×1.4 | Бочки/ящики к town_kit |
| `dungeon/*` (пропсы) | ×0.3–0.5 | Плитка пола 4×4, пропсы крупные: стол, стулья примерно ×0.42; стены/полы подбирай под сетку town_kit |
| `furniture/kaykit` | ×0.6–0.8 | Сверяй с мини-NPC |
| `furniture/kenney` | ×1.0–1.4 | Сверяй с мини-NPC |
| `tavern_kitchen/*` | ×0.8–1.0 | Сверяй |
| `characters/npc_mini_*` | **×1.35** | Рост ≈ 1.45×1.35 ≈ 1.9 м (на глаз); ребёнок ×0.8 от этого |
| `characters/hero_*` | **×0.62** | Герой выше мини-NPC, но не великан |
| `nature/*` деревья | ×2 | |
| `cemetery/kenney/lightpost_*` | ×1.3–1.6 | |

**Правило:** не верь числам — делай «рулон» (`ScaleChart`): поставь рядом дверь `[town_kit/wall_door]`, мини-NPC, героя, стул, стол и сверяй высоту в метрах (стандартный дверной проём ≈ 2.1 м). У скинированных персонажей `Box3.setFromObject` врёт — нормализуй рост при загрузке (по кости головы или вручную).

## 3. Загрузка (проверенный код)

```ts
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
const loader = new GLTFLoader(); const cache = new Map<string, Promise<any>>();
export const load = (p: string) => { if(!cache.has(p)) cache.set(p, loader.loadAsync(`/assets/models/${p}.glb`)); return cache.get(p)!; };
export async function spawn(p: string, o: {x?:number,y?:number,z?:number,ry?:number,s?:number} = {}) {
  const g = await load(p);
  const obj = SkeletonUtils.clone(g.scene);               // обязательно для скинированных
  obj.position.set(o.x??0, o.y??0, o.z??0); obj.rotation.y = o.ry??0; obj.scale.setScalar(o.s??1);
  obj.traverse((m:any) => { if(m.isMesh){ m.castShadow = m.receiveShadow = true; } });
  return {obj, animations: g.animations};
}
```

- Для статических повторяющихся кусков (стены, брусчатка, бочки) — `InstancedMesh` или слияние `BufferGeometryUtils.mergeGeometries` по материалу.
- Анимации: `const mixer = new AnimationMixer(obj); mixer.clipAction(THREE.AnimationClip.findByName(animations,'walk')).play()`. У героев (`hero_*`) имена вида `Idle`, `Walking_A`; у мини — `idle`, `walk`; у животных — `AnimalArmature|AnimalArmature|AnimalArmature|Idle`.
- Окружение: `EXRLoader` для `hdri/*.exr`; `scene.environmentIntensity ≈ 0.35`.
- Тайминг: загружай параллельно, показывай прогресс; в `public/assets` в Vite (чтобы работало `/assets/...`).

## 4. Рецепт картинки (скопируй из `tools/style_test/index.html`)

1. Рендерер: `ACESFilmicToneMapping`, `toneMappingExposure 1.05`, тени PCFSoft.
2. Свет: `HemisphereLight(0x5a7fc0, 0x2a2018, 0.8)` + лунный `DirectionalLight(0x8fb2ff, 1.1)`, тень 2048, `bias -0.0006`.
3. Фонари: `PointLight(0xffa850, 14, 11, decay 1.7)` + эмиссивная сфера + аддитивный спрайт-ореол + мерцание.
4. Туман: `FogExp2(0x101a2e, 0.034)`.
5. Земля: `cobble_albedo/normal/roughness` repeat ≈ 34, `roughness 0.42`, `envMapIntensity 1.6`.
6. Лужи: диски `MeshPhysicalMaterial(color 0x04070d, roughness .02, clearcoat 1, opacity .82)`.
7. Дождь: LineSegments, 2600 штрихов.
8. Пост: `RenderPass → UnrealBloomPass(0.75,0.7,0.82) → кастомный грейд/виньетка/зерно → OutputPass`.

## 5. Анимации, на что опираться

| Нужно | Мини (`npc_mini_*`) | Герой (`hero_*`) |
|---|---|---|
| Стоять | `idle` | `Idle` |
| Идти / бежать | `walk` / `sprint` | `Walking_A` / `Running_A` |
| Красться | `crouch` | `Walking_C` (проверь на глаз) |
| Сесть | `sit` | `Sit_Chair_Idle` (+ `_Down`, `_StandUp`) |
| Взять предмет | `pick-up` | `PickUp` |
| Использовать | `interact-right` | `Interact`, `Use_Item` |
| Кивнуть / отказать | `emote-yes` / `emote-no` | `Cheer` |
| Держать предмет | `holding-right` | — |
| Упасть/умереть | `die` | `Death_A` |
| Лечь/спрятаться | — | `Lie_Down`, `Lie_Idle` |

## 6. Фасады: как получить разнообразие без «одного дома на всё»

Собирай здание **сеткой** модулей `town_kit` (1 ед. = 1 м × 1.4). Слои: фундамент (`wall`, камень) → этаж (`wall_wood_*`) → окна → крыша. Меняй:
- **Материал:** `wall_*` (камень) / `wall_wood_*` (дерево).
- **Проёмы:** `wall_window_glass` / `shutters` / `round` / `small` / `stone`, двери `wall_door`, арки `wall_arch*`.
- **Крыша:** `roof_gable*` / `roof_high_gable*` / `roof_flat` / `roof_point` / угловые.
- **Детали:** `overhang`, `chimney*`, `banner_*`, `planks`/`poles` (балконы), `stairs_*`.
- **Цвет/патина:** тонируй `material.color` ±10%, добавляй грязь `textures/procedural/grunge_overlay.png` через `onBeforeCompile` или `aoMap`.

Рекомендуемая таблица (заполни в `src/world/facades.ts`):

| № | Где | Этажи | Материал | Крыша | Особенность |
|---|---|---|---|---|---|
| F1 | Северо-запад | 2 | камень+дерево | gable_detail | Мастерская Тильды, цветочные горшки |
| F2 | Запад | 2+мансарда | дерево | high_gable | Таверна, вывеска, навес |
| F3 | Юго-запад | 1 | камень | flat | Пост стража |
| F4 | Север | 3 | камень | high | Башня с часами |
| F5 | Северо-восток | 2 | дерево | gable | Склад |
| F6 | Восток | 2 | камень | gable_end | Дом с аркой |
| F7 | Юго-восток | 1 | камень | flat | Бюро харбормастера |
| F8 | Фон | — | `buildings_hex/*` | — | Силуэты в тумане |
| F9–F12 | Набережная | 1–2 | смеси | разные | Лавки, мастерские |

## 7. Известные проблемы и честные оговорки

- **Нет поездов:** Kenney Train Kit добыть не удалось. Трамвай собирается кодом из `town_kit` (см. спеку §5.4).
- **Дождь, вода, музыка** — синтезируются в коде (WebAudio / шейдер), готовых файлов нет.
- **`vehicles/*`, `city_bits/*` (дома, машины)** — игрушечные/современные, не вписываются в стиль; не используй в этом уровне.
- **`furniture/kenney`** содержит современную технику (микроволновка, ТВ, ноутбук) — выбирай осторожно.
- **`bus.glb`** из netforge в паке отсутствует; не искать.
- **Скинированные bbox** нельзя доверять; нормализуй рост.
- **Размер:** около 90–100 MB. Для деплоя включи сжатие (meshopt/draco можно вернуть `gltf-transform optimize` — декодированные GLB легко пережать).
- **Shadow acne на модульных стенах:** `shadow.bias -0.0006`, `normalBias 0.02`.
