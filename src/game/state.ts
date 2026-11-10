import { Flags, FlagName } from '../sim/flags';
import { WINDOW } from '../sim/time';

export type ItemId = 'key' | 'jeton' | 'ring' | 'ribbon' | 'manifest' | 'helmsmen' | 'spareKey' | 'cap' | 'note' | 'watch' | 'ledger';
export interface JournalEntry { id: string; t: number; ru: string; en: string; who?: string; place?: { x: number; z: number }; red?: boolean; }
export interface Bookmark { t: number; label: string; auto?: boolean; }
export interface ThreadDef { key: string; ru: string; en: string; marker?: { x: number; z: number }[]; timeHint?: number; }

/** Everything about the player's knowledge + the universe he currently stands in */
export class GameState {
  // --- current universe (reset on every jump) ---
  t = 0; flags = new Flags(); universeStart = 0; changes: string[] = []; money = 40; pocketCopyOf?: string;
  held?: ItemId;                 // item in hand = pocket item: the one thing that travels through time
  worldItems = new Set<string>(); // things already taken in this universe ("jeton@table", ...)
  // --- persistent through jumps ---
  pocket?: ItemId;
  hasGun = false; ammo = 0; mag = 6;
  // Tik grew up here: he knows these people by name from the start; everyone else is a description until somebody gives a name
  know = new Set<string>(['name_agnia', 'name_fern', 'name_foma', 'name_gayl', 'name_harrow', 'name_cord']);
  journal: JournalEntry[] = [];
  bookmarks: Bookmark[] = [];
  thread = 'prologue';
  jumps = 0; dead = false; ended: string | null = null; tickDone = new Set<string>();
  seenEvents = new Set<string>();
  messages: { t: number; ru: string; en: string }[] = [];
  // conversation memory: per branch (reset on a jump) and across all branches
  talks = new Map<string, number>(); topics = new Set<string>(); everTalks = new Map<string, number>(); thoughts = new Set<string>();
  // knowledge with the game time it was learned at (B2): shown with ⟲ when it comes from later than now
  knownAt = new Map<string, number>();
  met = new Set<string>(); portraits: Record<string, string> = {};
  alive = true;
  hp = 2;

  setFlag(n: FlagName) { if (!this.flags.has(n)) { this.flags.set(n, this.t); this.changes.push(n + '@' + Math.floor(this.t)); } }
  learn(id: string) { if (!this.know.has(id)) this.knownAt.set(id, this.t); this.know.add(id); }
  knows(id: string) { return this.know.has(id); }
  note(e: JournalEntry) { if (!this.journal.some(j => j.id === e.id)) this.journal.push(e); }
  give(item: ItemId) { this.pocket = item; this.held = item; }
  has(item: ItemId) { return this.pocket === item; }
  clampT() { this.t = Math.max(0, Math.min(WINDOW, this.t)); }
}
