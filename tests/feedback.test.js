import { describe, expect, it, vi } from 'vitest';
import { soundRecipeForEvent } from '../src/game/audio.js';
import { comboTierForStacks, getComboModifiers } from '../src/game/combo.js';
import { COMBO } from '../src/game/config.js';
import { createHapticsController, hapticPatternForEvent } from '../src/game/haptics.js';

describe('Overdrive modifiers', () => {
  it('advances through five tiers and caps weapon growth', () => {
    expect(comboTierForStacks(0)).toBe(0);
    expect(comboTierForStacks(3)).toBe(1);
    expect(comboTierForStacks(12)).toBe(4);

    const overdrive = getComboModifiers(COMBO.maxStacks);
    expect(overdrive.scoreMultiplier).toBe(5);
    expect(overdrive.cooldownMultiplier).toBe(COMBO.minimumCooldownMultiplier);
    expect(overdrive.bulletScale).toBeLessThanOrEqual(1 + COMBO.maximumBulletScaleBonus);
    expect(overdrive.bossDamage).toBe(2);
  });
});

describe('audio feedback recipes', () => {
  it('uses a distinct layered sound for elite divers', () => {
    const regular = soundRecipeForEvent({ type: 'enemy-destroyed', elite: false });
    const elite = soundRecipeForEvent({ type: 'enemy-destroyed', elite: true });

    expect(regular).toHaveLength(1);
    expect(elite.length).toBeGreaterThan(regular.length);
  });

  it('distinguishes enemy fire, standard dives, and elite dives', () => {
    const enemyShot = soundRecipeForEvent({ type: 'enemy-shot-fired' });
    const standardDive = soundRecipeForEvent({ type: 'diver-launched', elite: false });
    const eliteDive = soundRecipeForEvent({ type: 'diver-launched', elite: true });

    expect(enemyShot).toHaveLength(1);
    expect(standardDive).toHaveLength(1);
    expect(eliteDive.length).toBeGreaterThan(standardDive.length);
    expect(eliteDive[0].frequency).not.toBe(standardDive[0].frequency);
  });

  it('raises stack-tone pitch as Overdrive grows', () => {
    const first = soundRecipeForEvent({ type: 'combo-stack-added', stacks: 1 });
    const final = soundRecipeForEvent({ type: 'combo-stack-added', stacks: 15 });

    expect(final[0].frequency).toBeGreaterThan(first[0].frequency);
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
