import { createRenderSetup } from './render/setup';
import { City } from './world/city';
import { People } from './world/people';
import { Game } from './game/game';

const app = document.getElementById('app')!;
const rs = createRenderSetup(app);
const city = new City(rs);
await city.build();

const people = new People(rs.scene);
await people.load();

const game = new Game(rs, city, people);
game.start();
