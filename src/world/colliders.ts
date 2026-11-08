// Static collision world. Every solid thing the player can touch is an oriented box (OBB in XZ + vertical range).
// Boxes are registered by the same code that builds the visible geometry, so hitboxes match what you see.
export interface Box {
  cx: number; cz: number; hx: number; hz: number; rot: number; // footprint, rot = ry of the box (radians)
  y0: number; y1: number;                                       // vertical extent (world y)
  kind: string; id?: number; walkable?: boolean; cos: number; sin: number; r: number; off?: boolean; tag?: string;
}
const CELL = 8;
const key = (i: number, j: number) => i * 4096 + j;
export class Colliders {
  boxes: Box[] = [];
  private grid = new Map<number, Box[]>();
  add(cx: number, cz: number, hx: number, hz: number, rot: number, y0: number, y1: number, kind = 'solid'): Box {
    const b: Box = { cx, cz, hx, hz, rot, y0, y1, kind, cos: Math.cos(rot), sin: Math.sin(rot), r: Math.hypot(hx, hz) };
    this.boxes.push(b);
    const i0 = Math.floor((cx - b.r) / CELL), i1 = Math.floor((cx + b.r) / CELL), j0 = Math.floor((cz - b.r) / CELL), j1 = Math.floor((cz + b.r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i + 512, j + 512); (this.grid.get(k) ?? this.grid.set(k, []).get(k)!).push(b); }
    return b;
  }
  /** tag every box added since index `from` (used to toggle intact/ruined states) */
  tagFrom(from: number, tag: string) { for (let i = from; i < this.boxes.length; i++) this.boxes[i].tag = tag; }
  setOff(tag: string, off: boolean) { for (const b of this.boxes) if (b.tag === tag) b.off = off; }
  /** boxes near a point (radius <= CELL) */
  near(x: number, z: number): Box[] {
    return this.grid.get(key(Math.floor(x / CELL) + 512, Math.floor(z / CELL) + 512)) ?? [];
  }
  /** is the point inside any box of the kind, ignoring height */
  inside(x: number, z: number, kinds?: string[], pad = 0): boolean {
    for (const b of this.near(x, z)) {
      if (b.off || (kinds && !kinds.includes(b.kind))) continue;
      const dx = x - b.cx, dz = z - b.cz, lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
      if (Math.abs(lx) <= b.hx + pad && Math.abs(lz) <= b.hz + pad) return true;
    }
    return false;
  }
}
export const world = new Colliders();
