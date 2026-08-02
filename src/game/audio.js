const RECIPES = Object.freeze({
  'shot-fired': [{ frequency: 620, endFrequency: 430, duration: 0.055, type: 'square', volume: 0.035 }],
  'combo-tier-increased': [
    { frequency: 520, endFrequency: 680, duration: 0.09, type: 'square', volume: 0.045 },
    { frequency: 680, endFrequency: 880, duration: 0.11, type: 'square', volume: 0.04, delay: 0.075 },
  ],
  'overdrive-activated': [
    { frequency: 330, endFrequency: 660, duration: 0.16, type: 'sawtooth', volume: 0.06 },
    { frequency: 660, endFrequency: 990, duration: 0.22, type: 'square', volume: 0.055, delay: 0.12 },
  ],
  'player-hit': [{ frequency: 130, endFrequency: 48, duration: 0.32, type: 'sawtooth', volume: 0.09 }],
  'elite-dive-group-launched': [
    { frequency: 920, endFrequency: 150, duration: 0.32, type: 'sawtooth', volume: 0.052 },
    { frequency: 520, endFrequency: 80, duration: 0.38, type: 'square', volume: 0.028, delay: 0.035 },
  ],
  'wave-started': [
    { frequency: 220, endFrequency: 330, duration: 0.12, type: 'square', volume: 0.045 },
    { frequency: 330, endFrequency: 520, duration: 0.16, type: 'square', volume: 0.045, delay: 0.11 },
  ],
});

const ENEMY_ROW_FREQUENCIES = Object.freeze([780, 620, 480, 350, 240]);
const ENEMY_ROW_WAVES = Object.freeze(['sine', 'triangle', 'square', 'sawtooth', 'square']);

function enemyExplosionRecipe(event) {
  const row = Math.max(0, Math.min(4, Number(event.row) || 0));
  const tier = Math.max(0, Math.min(4, Number(event.tier) || 0));
  const signatureFrequency = ENEMY_ROW_FREQUENCIES[row];
  const recipes = [
    {
      frequency: signatureFrequency,
      endFrequency: signatureFrequency * (0.62 - tier * 0.025),
      duration: 0.085 + row * 0.012 + tier * 0.008,
      type: ENEMY_ROW_WAVES[row],
      volume: 0.032 + tier * 0.005,
    },
    {
      frequency: 210 + tier * 24,
      endFrequency: 52,
      duration: 0.13 + tier * 0.028,
      type: 'sawtooth',
      volume: 0.045 + tier * 0.007,
      delay: 0.018,
    },
  ];

  if (event.elite) {
    recipes.push({
      frequency: 980,
      endFrequency: 170,
      duration: 0.28,
      type: 'square',
      volume: 0.048,
      delay: 0.035,
    });
  }

  return recipes;
}

export function soundRecipeForEvent(event) {
  if (event.type === 'enemy-destroyed') return enemyExplosionRecipe(event);
  if (event.type === 'enemy-shot-fired') {
    const row = Math.max(0, Math.min(4, Number(event.row) || 0));
    const frequency = 300 - row * 28;
    return [{
      frequency,
      endFrequency: frequency * 0.58,
      duration: 0.075 + row * 0.006,
      type: ENEMY_ROW_WAVES[row],
      volume: 0.024,
    }];
  }
  if (event.type === 'dive-group-launched') {
    if (event.elite) return RECIPES['elite-dive-group-launched'];
    const count = Math.max(1, Math.min(3, event.count || 1));
    return [{
      frequency: 650 + count * 55,
      endFrequency: 190 - count * 18,
      duration: 0.2 + count * 0.045,
      type: 'sawtooth',
      volume: 0.03 + count * 0.006,
    }];
  }
  if (event.type === 'combo-stack-added') {
    const frequency = 300 + Math.min(15, event.stacks || 0) * 22;
    return [{
      frequency,
      endFrequency: frequency * 1.12,
      duration: 0.045,
      type: 'sine',
      volume: 0.018,
    }];
  }
  return RECIPES[event.type] || [];
}

export function createAudioController({ AudioContextClass } = {}) {
  const Context = AudioContextClass
    || globalThis.AudioContext
    || globalThis.webkitAudioContext;
  let context = null;
  let masterGain = null;
  let enabled = true;

  function ensureContext() {
    if (!Context || context) return context;
    context = new Context();
    masterGain = context.createGain();
    masterGain.gain.value = 0.72;
    masterGain.connect(context.destination);
    return context;
  }

  async function unlock() {
    if (!enabled) return false;
    const audioContext = ensureContext();
    if (!audioContext) return false;
    if (audioContext.state === 'suspended') await audioContext.resume();
    return audioContext.state === 'running';
  }

  function playTone(recipe) {
    if (!enabled || !context || context.state !== 'running') return;

    const start = context.currentTime + (recipe.delay || 0);
    const end = start + recipe.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = recipe.type;
    oscillator.frequency.setValueAtTime(recipe.frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, recipe.endFrequency || recipe.frequency),
      end,
    );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(recipe.volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(start);
    oscillator.stop(end + 0.015);
  }

  function handleEvents(events) {
    if (!enabled) return;
    events.flatMap(soundRecipeForEvent).forEach(playTone);
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (masterGain) masterGain.gain.value = enabled ? 0.72 : 0;
  }

  return {
    handleEvents,
    isAvailable: Boolean(Context),
    setEnabled,
    unlock,
  };
}
