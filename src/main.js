import './styles.css';
import { createAudioController } from './game/audio.js';
import { getComboModifiers } from './game/combo.js';
import { COMBO, WORLD } from './game/config.js';
import { createHapticsController } from './game/haptics.js';
import { createInput } from './game/input.js';
import { createRenderer } from './game/renderer.js';
import { createInitialState, startNewGame } from './game/state.js';
import { bindActionButtons, bindDragControl, bindJoystick } from './game/touch-controls.js';
import { stepGame } from './game/update.js';

const HIGH_SCORE_KEY = 'd3-space-invaders-high-score';
const AUTO_FIRE_KEY = 'd3-space-invaders-auto-fire';
const SOUND_KEY = 'd3-space-invaders-sound';
const HAPTICS_KEY = 'd3-space-invaders-haptics';
const svg = document.querySelector('#game-board');
const renderer = createRenderer(svg);
const input = createInput(window);
const audio = createAudioController();
const haptics = createHapticsController();
const score = document.querySelector('#score');
const highScore = document.querySelector('#high-score');
const lives = document.querySelector('#lives');
const level = document.querySelector('#level');
const combo = document.querySelector('#combo');
const overdriveMeter = document.querySelector('#overdrive-meter');
const overdriveTier = document.querySelector('#overdrive-tier');
const overdriveCount = document.querySelector('#overdrive-count');
const overdriveSegments = document.querySelector('#overdrive-segments');
const overdriveTimerFill = document.querySelector('#overdrive-timer-fill');
const comboSegments = Array.from({ length: COMBO.maxStacks }, (_, index) => {
  const segment = document.createElement('span');
  segment.dataset.stack = String(index + 1);
  overdriveSegments.append(segment);
  return segment;
});
const overlay = document.querySelector('#game-overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayMessage = document.querySelector('#overlay-message');
const startButton = document.querySelector('#start-button');
const restartButton = document.querySelector('#restart-button');
const quitButton = document.querySelector('#quit-button');
const pauseButton = document.querySelector('#pause-button');
const soundButton = document.querySelector('#sound-button');
const autoFireButtons = document.querySelectorAll('[data-auto-fire]');
const hapticsButton = document.querySelector('#haptics-button');
const gameStatus = document.querySelector('#game-status');

let state = createInitialState(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0);
let autoFireEnabled = localStorage.getItem(AUTO_FIRE_KEY) === 'true';
let soundEnabled = localStorage.getItem(SOUND_KEY) !== 'false';
let hapticsEnabled = localStorage.getItem(HAPTICS_KEY) !== 'false';
let previousTimestamp = performance.now();
let savedHighScore = state.highScore;
let announcedMode = state.mode;

audio.setEnabled(soundEnabled);
haptics.setEnabled(hapticsEnabled);

function beginGame() {
  input.reset();
  state = startNewGame(state.highScore);
  previousTimestamp = performance.now();
  audio.handleEvents([{ type: 'wave-started', level: 1 }]);
}

function returnToTitle() {
  input.reset();
  state = createInitialState(state.highScore);
  previousTimestamp = performance.now();
}

function confirmAbandon(message) {
  return window.confirm(`${message} Your current mission progress will be lost.`);
}

function togglePause() {
  if (state.mode === 'running') {
    input.reset();
    state.mode = 'paused';
  } else if (state.mode === 'paused') {
    previousTimestamp = performance.now();
    state.mode = 'running';
  }
}

function announceModeChange() {
  if (state.mode === announcedMode) return;

  const messages = {
    running: announcedMode === 'paused' ? 'Mission resumed.' : 'Mission started. Defend Kuga.',
    paused: 'Mission paused.',
    gameover: `Mission ended. Final score: ${state.score}.`,
  };
  gameStatus.textContent = messages[state.mode] || '';
  announcedMode = state.mode;
}

function updateSettingsInterface() {
  soundButton.disabled = !audio.isAvailable;
  soundButton.setAttribute('aria-pressed', String(soundEnabled));
  soundButton.textContent = soundEnabled ? 'Sound on' : 'Sound off';

  autoFireButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(autoFireEnabled));
    button.setAttribute('aria-label', `Auto-fire ${autoFireEnabled ? 'on' : 'off'}`);
    if (button.id === 'desktop-auto-fire-button') {
      button.textContent = `Auto fire ${autoFireEnabled ? 'on' : 'off'}`;
    }
  });

  hapticsButton.disabled = !haptics.isAvailable;
  hapticsButton.setAttribute('aria-pressed', String(hapticsEnabled && haptics.isAvailable));
  hapticsButton.setAttribute(
    'aria-label',
    haptics.isAvailable ? `Haptics ${hapticsEnabled ? 'on' : 'off'}` : 'Haptics unavailable',
  );
}

function updateInterface() {
  score.textContent = String(state.score).padStart(5, '0');
  highScore.textContent = String(state.highScore).padStart(5, '0');
  lives.textContent = '◆'.repeat(Math.max(0, state.lives)) || '—';
  level.textContent = String(state.level).padStart(2, '0');
  const comboModifiers = getComboModifiers(state.combo.stacks);
  combo.textContent = `×${comboModifiers.scoreMultiplier}`;
  combo.title = `${state.combo.stacks} Overdrive stack${state.combo.stacks === 1 ? '' : 's'}`;
  overdriveMeter.dataset.tier = String(comboModifiers.tier);
  overdriveMeter.setAttribute('aria-valuenow', String(state.combo.stacks));
  overdriveMeter.setAttribute(
    'aria-valuetext',
    `${comboModifiers.tierName}, ${state.combo.stacks} of ${COMBO.maxStacks} stacks`,
  );
  overdriveTier.textContent = comboModifiers.tierName;
  overdriveCount.textContent = `${state.combo.stacks}/${COMBO.maxStacks}`;
  comboSegments.forEach((segment, index) => {
    segment.classList.toggle('is-active', index < state.combo.stacks);
  });
  const timerDuration = state.combo.decaying ? COMBO.decaySeconds : COMBO.graceSeconds;
  const timerRatio = state.combo.stacks > 0
    ? Math.max(0, Math.min(1, state.combo.timer / timerDuration))
    : 0;
  overdriveTimerFill.style.transform = `scaleX(${timerRatio})`;
  pauseButton.disabled = !['running', 'paused'].includes(state.mode);
  pauseButton.textContent = state.mode === 'paused' ? 'Resume' : 'Pause';
  pauseButton.setAttribute('aria-pressed', String(state.mode === 'paused'));

  restartButton.hidden = true;
  quitButton.hidden = true;

  if (state.mode === 'running') {
    overlay.hidden = true;
  } else {
    overlay.hidden = false;

    if (state.mode === 'ready') {
      overlayTitle.textContent = 'Defend Kuga';
      overlayMessage.textContent = 'Move in four directions with the joystick or keyboard, or drag horizontally in the lower playfield. Fire to defend Kuga and dodge diving attackers.';
      startButton.textContent = 'Start mission';
    } else if (state.mode === 'paused') {
      overlayTitle.textContent = 'Mission paused';
      overlayMessage.textContent = 'Resume the mission, restart this run, or return to the title screen.';
      startButton.textContent = 'Resume';
      restartButton.hidden = false;
      quitButton.hidden = false;
      quitButton.textContent = 'Quit to title';
    } else {
      overlayTitle.textContent = 'Kuga has fallen';
      overlayMessage.textContent = `Final score: ${state.score}. The fleet reached level ${state.level}.`;
      startButton.textContent = 'Try again';
      quitButton.hidden = false;
      quitButton.textContent = 'Title screen';
    }
  }

  updateSettingsInterface();
  announceModeChange();
}

startButton.addEventListener('click', () => {
  if (state.mode === 'paused') togglePause();
  else beginGame();
});
restartButton.addEventListener('click', () => {
  if (confirmAbandon('Restart the mission?')) beginGame();
});
quitButton.addEventListener('click', () => {
  if (state.mode !== 'paused' || confirmAbandon('Quit to the title screen?')) returnToTitle();
});
pauseButton.addEventListener('click', togglePause);
soundButton.addEventListener('click', async () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem(SOUND_KEY, String(soundEnabled));
  audio.setEnabled(soundEnabled);
  if (soundEnabled) await audio.unlock();
  updateSettingsInterface();
});
autoFireButtons.forEach((button) => {
  button.addEventListener('click', () => {
    autoFireEnabled = !autoFireEnabled;
    localStorage.setItem(AUTO_FIRE_KEY, String(autoFireEnabled));
    updateSettingsInterface();
  });
});
hapticsButton.addEventListener('click', () => {
  if (!haptics.isAvailable) return;
  hapticsEnabled = !hapticsEnabled;
  localStorage.setItem(HAPTICS_KEY, String(hapticsEnabled));
  haptics.setEnabled(hapticsEnabled);
  updateSettingsInterface();
});

const unlockAudio = () => audio.unlock().catch(() => {});
window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
window.addEventListener('keydown', unlockAudio, { once: true, capture: true });

bindActionButtons(document.querySelectorAll('[data-action]'), input);
bindJoystick(document.querySelector('[data-joystick]'), input);
bindDragControl(svg, input, WORLD.width, { startRegion: 'bottom-half' });

function frame(timestamp) {
  if (input.consume('pause')) togglePause();

  const deltaSeconds = (timestamp - previousTimestamp) / 1000;
  previousTimestamp = timestamp;
  const frameInput = input.snapshot();
  if (autoFireEnabled) frameInput.fire = true;
  stepGame(state, deltaSeconds, frameInput);
  audio.handleEvents(state.events);
  haptics.handleEvents(state.events);

  if (state.highScore !== savedHighScore) {
    savedHighScore = state.highScore;
    localStorage.setItem(HIGH_SCORE_KEY, String(savedHighScore));
  }

  renderer.render(state);
  updateInterface();
  requestAnimationFrame(frame);
}

renderer.render(state);
updateInterface();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((error) => console.warn('Service worker registration failed:', error));
  });
}
