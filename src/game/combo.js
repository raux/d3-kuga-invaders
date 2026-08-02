import { COMBO } from './config.js';

export function comboTierForStacks(stacks) {
  const bounded = Math.max(0, Math.min(COMBO.maxStacks, stacks));
  return Math.min(COMBO.tierNames.length - 1, Math.floor(bounded / COMBO.stacksPerTier));
}

export function getComboModifiers(stacks) {
  const bounded = Math.max(0, Math.min(COMBO.maxStacks, stacks));
  const tier = comboTierForStacks(bounded);

  return {
    tier,
    tierName: COMBO.tierNames[tier],
    scoreMultiplier: tier + 1,
    cooldownMultiplier: Math.max(
      COMBO.minimumCooldownMultiplier,
      1 - bounded * COMBO.fireRatePerStack,
    ),
    bulletSpeedMultiplier: 1 + Math.min(
      COMBO.maximumBulletSpeedBonus,
      bounded * COMBO.bulletSpeedPerStack,
    ),
    bulletScale: 1 + Math.min(
      COMBO.maximumBulletScaleBonus,
      bounded * COMBO.bulletScalePerStack,
    ),
    bossDamage: bounded >= COMBO.overdriveMinimumStacks ? 2 : 1,
  };
}
