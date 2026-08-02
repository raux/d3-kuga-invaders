import { describe, expect, it, vi } from 'vitest';
import { bindActionButtons } from '../src/game/touch-controls.js';

class TestButton extends EventTarget {
  constructor(action) {
    super();
    this.dataset = { action };
    this.attributes = new Map();
    this.capturedPointers = new Set();
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

function pointerEvent(type, pointerId) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
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
});
