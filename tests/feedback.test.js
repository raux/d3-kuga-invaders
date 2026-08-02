import { describe, expect, it, vi } from 'vitest';
import { soundRecipeForEvent } from '../src/game/audio.js';
import { createHapticsController, hapticPatternForEvent } from '../src/game/haptics.js';

describe('audio feedback recipes', () => {
  it('uses a distinct layered sound for elite divers', () => {
    const regular = soundRecipeForEvent({ type: 'enemy-destroyed', elite: false });
    const elite = soundRecipeForEvent({ type: 'enemy-destroyed', elite: true });

    expect(regular).toHaveLength(1);
    expect(elite.length).toBeGreaterThan(regular.length);
  });

  it('returns no recipe for an unknown event', () => {
    expect(soundRecipeForEvent({ type: 'unknown' })).toEqual([]);
  });
});

describe('haptic feedback', () => {
  it('prefers the strongest, latest event pattern in a frame', () => {
    const target = { vibrate: vi.fn() };
    const haptics = createHapticsController(target);

    haptics.handleEvents([
      { type: 'shot-fired' },
      { type: 'player-hit' },
    ]);

    expect(target.vibrate).toHaveBeenCalledWith(hapticPatternForEvent({ type: 'player-hit' }));
  });

  it('stops vibration and suppresses feedback when disabled', () => {
    const target = { vibrate: vi.fn() };
    const haptics = createHapticsController(target);

    haptics.setEnabled(false);
    haptics.handleEvents([{ type: 'shot-fired' }]);

    expect(target.vibrate).toHaveBeenCalledTimes(1);
    expect(target.vibrate).toHaveBeenCalledWith(0);
  });
});
