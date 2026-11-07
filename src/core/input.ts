// Ввод: клавиатура, мышь, pointer lock. Без зависимостей.

export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  dx = 0;
  dy = 0;
  wheel = 0;
  locked = false;
  onMouseDown: (b: number) => void = () => {};
  onMouseUp: (b: number) => void = () => {};
  private el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    el.addEventListener('click', () => {
      if (!this.locked && !document.body.classList.contains('ui-open')) {
        el.requestPointerLock?.();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
    });
    addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.dx += e.movementX;
        this.dy += e.movementY;
      }
    });
    addEventListener('mousedown', (e) => {
      if (this.locked) this.onMouseDown(e.button);
    });
    addEventListener('mouseup', (e) => {
      if (this.locked) this.onMouseUp(e.button);
    });
    addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code: string) { return this.keys.has(code); }
  took(code: string) { return this.pressed.has(code); }
  takeMouse() {
    const d = { dx: this.dx, dy: this.dy, wheel: this.wheel };
    this.dx = 0; this.dy = 0; this.wheel = 0;
    return d;
  }
  endFrame() { this.pressed.clear(); }
  release() { this.locked = false; document.exitPointerLock?.(); }
  get element() { return this.el; }
}
