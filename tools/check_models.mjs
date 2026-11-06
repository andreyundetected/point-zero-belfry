import fs from 'node:fs'; import path from 'node:path';
const files = fs.readdirSync('src/render').filter((f) => f.endsWith('.ts')).map((f) => 'src/render/' + f);
const missing = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/['"`]((?:town_kit|buildings_hex|hex_props|hex_nature|city_bits|dungeon|furniture\/kenney|furniture\/kaykit|tavern_kitchen|food|cemetery\/kenney|cemetery\/kaykit|nature|pirate_kit|boats|vehicles|items_adventurer|characters)\/[A-Za-z0-9_]+)['"`]/g)) {
    if (!fs.existsSync(path.join('assets/models', m[1] + '.glb'))) missing.add(m[1] + '  (' + f + ')');
  }
}
console.log(missing.size ? [...missing].join('\n') : 'все модели существуют');
