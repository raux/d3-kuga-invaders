const RECIPES = Object.freeze({
  'shot-fired': [{ frequency: 620, endFrequency: 430, duration: 0.055, type: 'square', volume: 0.035 }],
  'enemy-destroyed': [{ frequency: 180, endFrequency: 90, duration: 0.11, type: 'square', volume: 0.06 }],
  'elite-destroyed': [
    { frequency: 260, endFrequency: 120, duration: 0.16, type: 'sawtooth', volume: 0.07 },
    { frequency: 520, endFrequency: 240, duration: 0.2, type: 'square', volume: 0.045, delay: 0.035 },
  ],
  'combo-increased': [
    { frequency: 520, endFrequency: 680, duration: 0.09, type: 'square', volume: 0.045 },
    { frequency: 680, endFrequency: 880, duration: 0.11, type: 'square', volume: 0.04, delay: 0.075 },
  ],
  'player-hit': [{ frequency: 130, endFrequency: 48, duration: 0.32, type: 'sawtooth', volume: 0.09 }],
  'elite-diver-launched': [{ frequency: 360, endFrequency: 760, duration: 0.2, type: 'sawtooth', volume: 0.035 }],
  'wave-started': [
    { frequency: 220, endFrequency: 330, duration: 0.12, type: 'square', volume: 0.045 },
    { frequency: 330, endFrequency: 520, duration: 0.16, type: 'square', volume: 0.045, delay: 0.11 },
  ],
});

export function soundRecipeForEvent(event) {
  if (event.type === 'enemy-destroyed' && event.elite) return RECIPES['elite-destroyed'];
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
