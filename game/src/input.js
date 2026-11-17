// input.js — keyboard + mouse input. WASD moves, mouse orbits the camera
// (pointer lock on click, drag as a fallback), E enters/exits cars, click
// shoots, M starts the next mission, P/Esc pauses, R reloads is not needed
// (infinite ammo), Shift runs, Space jumps.
import { G } from './state.js';

export function initInput(canvas, callbacks) {
  const keys = G.keys;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'KeyM' && callbacks.onMissionKey) callbacks.onMissionKey();
    if ((e.code === 'KeyP' || e.code === 'Escape') && callbacks.onPauseKey) callbacks.onPauseKey();
    if (e.code === 'KeyE' && callbacks.onInteractKey) callbacks.onInteractKey();
    if (e.code === 'KeyF' && callbacks.onInteractKey) callbacks.onInteractKey();
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  canvas.addEventListener('click', () => {
    if (G.started && !G.paused && !G.pointerLocked && canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch (err) { /* pointer lock unavailable */ }
    }
  });
  document.addEventListener('pointerlockchange', () => {
    G.pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (G.pointerLocked) {
      G.mouseDX += e.movementX || 0;
      G.mouseDY += e.movementY || 0;
    } else if (e.buttons === 1 && G.started && !G.paused) {
      G.mouseDX += e.movementX || 0;
      G.mouseDY += e.movementY || 0;
    }
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) G.mouseDown = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) G.mouseDown = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    G.mouseDown = false;
  });
}

export function consumeMouseDelta() {
  const dx = G.mouseDX;
  const dy = G.mouseDY;
  G.mouseDX = 0;
  G.mouseDY = 0;
  return { dx, dy };
}

export function axis() {
  const k = G.keys;
  let x = 0;
  let y = 0;
  if (k.KeyW || k.ArrowUp) y += 1;
  if (k.KeyS || k.ArrowDown) y -= 1;
  if (k.KeyA || k.ArrowLeft) x -= 1;
  if (k.KeyD || k.ArrowRight) x += 1;
  return { x, y };
}
