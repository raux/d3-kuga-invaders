import { describe, expect, it, vi } from 'vitest';
import { bindActionButtons, bindDragControl, bindJoystick } from '../src/game/touch-controls.js';

class TestButton extends EventTarget {
  constructor(action) {
    super();
    this.dataset = { action };
    this.attributes = new Map();
    this.capturedPointers = new Set();
    this.style = {};
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  setPointerCapture(pointerId) {
    this.capturedPointers.add(pointerId);
  }
}

function pointerEvent(type, pointerId, clientX = 0, clientY = 0) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  return event;
}

function keyEvent(type, key) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'key', { value: key });
  return event;
}

describe('touch controls', () => {
  it('captures and releases a held action', () => {
    const left = new TestButton('left');
    const input = { setAction: vi.fn() };
    bindActionButtons([left], input);

    left.dispatchEvent(pointerEvent('pointerdown', 1));
    expect(input.setAction).toHaveBeenCalledWith('left', true);
    expect(left.capturedPointers.has(1)).toBe(true);
    expect(left.getAttribute('aria-pressed')).toBe('true');

    left.dispatchEvent(pointerEvent('pointerup', 1));
    expect(input.setAction).toHaveBeenLastCalledWith('left', false);
    expect(left.getAttribute('aria-pressed')).toBe('false');
  });

  it('supports movement and firing at the same time', () => {
    const left = new TestButton('left');
    const fire = new TestButton('fire');
    const active = new Set();
    const input = {
      setAction(action, enabled) {
        if (enabled) active.add(action);
        else active.delete(action);
      },
    };
    bindActionButtons([left, fire], input);

    left.dispatchEvent(pointerEvent('pointerdown', 1));
    fire.dispatchEvent(pointerEvent('pointerdown', 2));
    expect(active).toEqual(new Set(['left', 'fire']));

    left.dispatchEvent(pointerEvent('pointerup', 1));
    expect(active).toEqual(new Set(['fire']));
  });

  it('supports diagonal two-axis joystick movement with a dead zone', () => {
    const joystick = new TestButton();
    const knob = new TestButton();
    const active = new Set();
    joystick.querySelector = () => knob;
    joystick.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 120 });
    knob.getBoundingClientRect = () => ({ width: 58, height: 58 });
    const input = {
      setAction(action, enabled) {
        if (enabled) active.add(action);
        else active.delete(action);
      },
    };
    bindJoystick(joystick, input);

    joystick.dispatchEvent(pointerEvent('pointerdown', 3, 105, 62));
    expect(active).toEqual(new Set());
    expect(joystick.getAttribute('aria-label')).toContain('Centered');

    joystick.dispatchEvent(pointerEvent('pointermove', 3, 180, 15));
    expect(active).toEqual(new Set(['right', 'up']));
    expect(joystick.dataset.horizontal).toBe('right');
    expect(joystick.dataset.vertical).toBe('up');
    expect(joystick.capturedPointers.has(3)).toBe(true);

    joystick.dispatchEvent(pointerEvent('pointermove', 3, 20, 105));
    expect(active).toEqual(new Set(['left', 'down']));
    expect(joystick.getAttribute('aria-label')).toContain('down and left');

    joystick.dispatchEvent(pointerEvent('pointerup', 3, 20, 105));
    expect(active).toEqual(new Set());
    expect(joystick.dataset.direction).toBe('centered');
    expect(knob.style.transform).toBe('translate3d(0px, 0px, 0)');
  });

  it('supports diagonal keyboard input while the joystick is focused', () => {
    const joystick = new TestButton();
    const knob = new TestButton();
    const active = new Set();
    joystick.querySelector = () => knob;
    joystick.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 120 });
    knob.getBoundingClientRect = () => ({ width: 58, height: 58 });
    bindJoystick(joystick, {
      setAction(action, enabled) {
        if (enabled) active.add(action);
        else active.delete(action);
      },
    });

    joystick.dispatchEvent(keyEvent('keydown', 'ArrowUp'));
    joystick.dispatchEvent(keyEvent('keydown', 'ArrowRight'));
    expect(active).toEqual(new Set(['up', 'right']));

    joystick.dispatchEvent(keyEvent('keyup', 'ArrowUp'));
    joystick.dispatchEvent(keyEvent('keyup', 'ArrowRight'));
    expect(active).toEqual(new Set());
  });

  it('starts lower-playfield dragging only from the bottom half', () => {
    const surface = new TestButton('drag');
    surface.getBoundingClientRect = () => ({ left: 0, top: 100, width: 200, height: 200 });
    const input = { setTargetX: vi.fn() };
    bindDragControl(surface, input, 960, { startRegion: 'bottom-half' });

    surface.dispatchEvent(pointerEvent('pointerdown', 8, 100, 150));
    expect(input.setTargetX).not.toHaveBeenCalled();

    surface.dispatchEvent(pointerEvent('pointerdown', 9, 150, 250));
    expect(input.setTargetX).toHaveBeenLastCalledWith(720);
    expect(surface.capturedPointers.has(9)).toBe(true);
  });

  it('maps a horizontal drag to world coordinates and clears it on release', () => {
    const surface = new TestButton('drag');
    surface.getBoundingClientRect = () => ({ left: 100, width: 200 });
    const input = { setTargetX: vi.fn() };
    bindDragControl(surface, input, 960);

    surface.dispatchEvent(pointerEvent('pointerdown', 7, 150));
    expect(input.setTargetX).toHaveBeenLastCalledWith(240);
    expect(surface.capturedPointers.has(7)).toBe(true);

    surface.dispatchEvent(pointerEvent('pointermove', 7, 250));
    expect(input.setTargetX).toHaveBeenLastCalledWith(720);

    surface.dispatchEvent(pointerEvent('pointerup', 7, 250));
    expect(input.setTargetX).toHaveBeenLastCalledWith(null);
  });
});
