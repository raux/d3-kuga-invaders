const PATTERNS = Object.freeze({
  'shot-fired': 7,
  'enemy-destroyed': 12,
  'elite-destroyed': [18, 24, 30],
  'combo-tier-increased': [10, 18, 10],
  'overdrive-activated': [18, 24, 18, 24, 36],
  'player-hit': [35, 35, 70],
  'diver-launched': 8,
  'elite-diver-launched': 16,
});

export function hapticPatternForEvent(event) {
  if (event.type === 'enemy-destroyed' && event.elite) return PATTERNS['elite-destroyed'];
  if (event.type === 'diver-launched' && event.elite) return PATTERNS['elite-diver-launched'];
  return PATTERNS[event.type] ?? null;
}

export function createHapticsController(target = globalThis.navigator) {
  let enabled = true;

  function handleEvents(events) {
    if (!enabled || typeof target?.vibrate !== 'function') return;
    const patterns = events.map(hapticPatternForEvent).filter((pattern) => pattern !== null);
    if (!patterns.length) return;
    target.vibrate(patterns.at(-1));
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled && typeof target?.vibrate === 'function') target.vibrate(0);
  }

  return {
    handleEvents,
    isAvailable: typeof target?.vibrate === 'function',
    setEnabled,
  };
}
