import { Game } from './game';
// let the boot screen paint before the heavy synchronous city/simulation build
requestAnimationFrame(() => setTimeout(() => { new Game(); document.getElementById('boot')?.remove(); }, 30));
