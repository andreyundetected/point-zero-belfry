// Flags set by the player's actions in the CURRENT universe, with the time they were set at.
export type FlagName =
  | 'jetonStolen' | 'tapCut' | 'nedSaved' | 'wagonPinPulled' | 'tildaWarned' | 'annaWarned' | 'tikhonTurned' | 'tikhonThreatened'
  | 'tikhonHurt' | 'tikhonDead' | 'tikhonLocked' | 'gaylWarned' | 'ignatDead' | 'lovchiyDead' | 'scarAlert' | 'lampsShot' | 'safeOpened'
  | 'patrolPassed' | 'officeOpen' | 'innerOpen' | 'gateOpen' | 'cartLooked' | 'tikhonKnock' | 'fomaWarned' | 'fomaPaid' | 'sternScared' | 'gunTaken' | 'raidSkipped' | 'ringGiven' | 'alarm' | 'tavernBrawl' | 'ferned' | 'lidiaTold'
  // per-NPC memory of this branch: `talk_<npc>` = end time of the last finished conversation; `prologueOver`, `orvenTalk`…
  | `talk_${string}` | 'prologueOver' | 'nedKept' | 'nedLeftEarly' | 'nedNoBet' | 'fomaAlarmed' | 'cordAngry';
export class Flags {
  private m = new Map<string, number>();
  set(n: FlagName, t: number) { if (!this.m.has(n)) this.m.set(n, t); }
  /** overwrite (unlike set, which keeps the first time) */
  put(n: FlagName, t: number) { this.m.set(n, t); }
  clear(n: FlagName) { this.m.delete(n); }
  has(n: FlagName) { return this.m.has(n); }
  at(n: FlagName) { return this.m.get(n); }
  /** was it set at or before t */
  before(n: FlagName, t: number) { const v = this.m.get(n); return v !== undefined && v <= t; }
  entries() { return [...this.m.entries()].sort((a, b) => a[1] - b[1]); }
  clone() { const f = new Flags(); f.m = new Map(this.m); return f; }
  hash(): string { let h = 2166136261; for (const [k, v] of this.entries()) { const s = k + '@' + Math.floor(v); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } } return (h >>> 0).toString(16); }
}
