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

function pointerEvent(type, pointerId, clientX = 0) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
  });
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

  it('uses a dead zone and switches joystick direction while dragging', () => {
    const joystick = new TestButton();
    const knob = new TestButton();
    joystick.querySelector = () => knob;
    joystick.getBoundingClientRect = () => ({ left: 0, width: 200, height: 82 });
    knob.getBoundingClientRect = () => ({ width: 62 });
    const input = { setAction: vi.fn() };
    bindJoystick(joystick, input);

    joystick.dispatchEvent(pointerEvent('pointerdown', 3, 110));
    expect(input.setAction).not.toHaveBeenCalled();
    expect(joystick.getAttribute('aria-valuetext')).toBe('Centered');

    joystick.dispatchEvent(pointerEvent('pointermove', 3, 180));
    expect(input.setAction).toHaveBeenLastCalledWith('right', true);
    expect(joystick.dataset.direction).toBe('right');
    expect(joystick.capturedPointers.has(3)).toBe(true);

    joystick.dispatchEvent(pointerEvent('pointermove', 3, 40));
    expect(input.setAction).toHaveBeenNthCalledWith(2, 'right', false);
    expect(input.setAction).toHaveBeenNthCalledWith(3, 'left', true);
    expect(joystick.dataset.direction).toBe('left');

    joystick.dispatchEvent(pointerEvent('pointerup', 3, 40));
    expect(input.setAction).toHaveBeenLastCalledWith('left', false);
    expect(joystick.dataset.direction).toBe('center');
    expect(knob.style.transform).toBe('translate3d(0px, 0, 0)');
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
