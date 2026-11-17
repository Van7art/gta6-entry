// input.js — keyboard + mouse state. Tracks held keys, edge-triggered
// presses (E, N, Esc...), and mouse drag for the orbit camera.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.clicked = false;
    this.clickX = 0;
    this.clickY = 0;
    this.dragging = false;
    this.onFirstGesture = null;
    this.gestureSeen = false;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this.gesture();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('mousedown', (e) => {
      // Only canvas clicks drive the game: clicks on menus/buttons must
      // never fire the pistol (the HUD itself is pointer-events:none).
      if (e.target.id !== 'game-canvas') return;
      this.mouseDown = true;
      this.dragging = true;
      this.clicked = true;
      this.clickX = e.clientX;
      this.clickY = e.clientY;
      this.gesture();
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (this.dragging) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  gesture() {
    if (!this.gestureSeen) {
      this.gestureSeen = true;
      if (this.onFirstGesture) this.onFirstGesture();
    }
  }

  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }

  // Drive / walk axes: -1..1.
  driveInput() {
    const throttle = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) + (this.down('KeyS') || this.down('ArrowDown') ? -1 : 0);
    const steer = (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0) + (this.down('KeyD') || this.down('ArrowRight') ? -1 : 0);
    return { throttle, steer, handbrake: this.down('Space') };
  }

  walkInput() {
    const f = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) + (this.down('KeyS') || this.down('ArrowDown') ? -1 : 0);
    const r = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) + (this.down('KeyA') || this.down('ArrowLeft') ? -1 : 0);
    return { forward: f, right: r, sprint: this.down('ShiftLeft') || this.down('ShiftRight') };
  }

  // Consume the per-frame edge state at the end of each frame.
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.clicked = false;
  }
}
