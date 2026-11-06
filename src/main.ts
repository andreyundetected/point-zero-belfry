import { Game } from './game';
import { t } from './i18n';

const game = new Game();
(window as any).__game = game;
const q = new URLSearchParams(location.search);
const title = game.ui.title(() => game.begin());
(async () => {
  await game.boot((p) => title.setProgress(p));
  title.ready();
  const shot = q.get('shot');
  if (shot) await shotPreset(shot);
  (window as any).READY = false; setTimeout(() => ((window as any).READY = true), shot ? 800 : 100);
})();

/** Пресеты для скриншотов (?shot=plaza|quay|tavern|window|fire): ставят игрока и камеру. */
async function shotPreset(name: string) {
  game.begin(); game.paused = false;
  const S = game.S;
  const place = (x: number, z: number, floor = 0, advanceTo = 0) => { game.pos.set(x, z); game.floor = floor; if (advanceTo) S.advanceTo(advanceTo); S.move(x, z, floor, 0); };
  game.ui.setBanner(''); game.ui.hint.textContent = ''; game.ui.toastEl.remove(); game.ui.banner.style.display = 'none';
  const cam = (p: number[], tg: number[]) => { game.freeCam = { p, t: tg }; };
  const present: Record<string, () => void> = {
    plaza: () => { place(2, 5, 0, 60); cam([11, 4.2, 12], [-8, 1.6, -6]); },
    quay: () => { place(20, 16, 0, 600); cam([27, 3.2, 24], [12, 1.5, 15]); game.camYaw = 0.3; },
    tavern: () => { place(-26.5, 0.8, 0, 700); game.camYaw = 0.35; game.camPitch = 1.05; game.camDist = 7.5; },
    window: () => { place(0, -28.6, 2, 5); game.camYaw = 0.2; game.camPitch = 0.6; game.camDist = 6; },
    fire: () => { place(-17, 2, 0, 2380); game.camYaw = 1.2; game.camPitch = 0.55; game.camDist = 12; },
  };
  present[name]?.();
  game.started = true; game.shotMode = true;
}
void t;
