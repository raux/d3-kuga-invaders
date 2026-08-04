import './styles.css';
import { createAudioController } from './game/audio.js';
import { getComboModifiers } from './game/combo.js';
import { COMBO, WORLD } from './game/config.js';
import { createHapticsController } from './game/haptics.js';
import { createInput } from './game/input.js';
import { createRenderer } from './game/renderer.js';
import { createInitialState, startNewGame } from './game/state.js';
import { getFirebaseConfiguration } from './leaderboard/firebase-config.js';
import { normalizeLeaderboardLevel, normalizePlayerName } from './leaderboard/leaderboard.js';
import { bindActionButtons, bindDragControl, bindJoystick } from './game/touch-controls.js';
import { stepGame } from './game/update.js';

const HIGH_SCORE_KEY = 'd3-space-invaders-high-score';
const BEST_LEVEL_KEY = 'd3-space-invaders-best-level';
const PLAYER_NAME_KEY = 'd3-space-invaders-player-name';
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
const leaderboardPanel = document.querySelector('#leaderboard-panel');
const leaderboardForm = document.querySelector('#leaderboard-form');
const playerNameInput = document.querySelector('#player-name');
const saveScoreButton = document.querySelector('#save-score-button');
const leaderboardMessage = document.querySelector('#leaderboard-message');
const leaderboardList = document.querySelector('#leaderboard-list');

let state = createInitialState(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0);
let autoFireEnabled = localStorage.getItem(AUTO_FIRE_KEY) === 'true';
let soundEnabled = localStorage.getItem(SOUND_KEY) !== 'false';
let hapticsEnabled = localStorage.getItem(HAPTICS_KEY) !== 'false';
let previousTimestamp = performance.now();
let savedHighScore = state.highScore;
let savedBestLevel = normalizeLeaderboardLevel(localStorage.getItem(BEST_LEVEL_KEY));
let announcedMode = state.mode;
let leaderboardService = null;
let leaderboardReady = false;
let leaderboardSaving = false;
let lastSubmittedScore = 0;

playerNameInput.value = localStorage.getItem(PLAYER_NAME_KEY) || '';
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

function setLeaderboardMessage(message, status = 'ready') {
  leaderboardPanel.dataset.state = status;
  leaderboardMessage.textContent = message;
}

function formatLeaderboardDate(value) {
  if (!value) return 'Date —';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function renderLeaderboard(entries) {
  leaderboardList.replaceChildren();

  if (entries.length === 0) {
    const placeholder = document.createElement('li');
    placeholder.className = 'leaderboard-placeholder';
    placeholder.textContent = 'No pilots have reported in yet.';
    leaderboardList.append(placeholder);
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    const details = document.createElement('span');
    const scoreValue = document.createElement('strong');
    name.className = 'leaderboard-name';
    name.textContent = entry.displayName;
    details.className = 'leaderboard-details';
    details.textContent = `Level ${entry.bestLevel ?? '—'} · ${formatLeaderboardDate(entry.savedAt)}`;
    scoreValue.className = 'leaderboard-score';
    scoreValue.textContent = String(entry.bestScore).padStart(5, '0');
    item.append(name, details, scoreValue);
    leaderboardList.append(item);
  });
}

function updateLeaderboardInterface() {
  const canSave = leaderboardReady && !leaderboardSaving && state.highScore > 0;
  playerNameInput.disabled = !leaderboardReady || leaderboardSaving;
  saveScoreButton.disabled = !canSave;
  saveScoreButton.textContent = leaderboardSaving
    ? 'Saving…'
    : state.highScore > 0 ? `Save ${String(state.highScore).padStart(5, '0')}` : 'Save best';
}

async function refreshLeaderboard({ announce = true } = {}) {
  if (!leaderboardService) return;

  try {
    const entries = await leaderboardService.listTopScores();
    renderLeaderboard(entries);
    if (announce) {
      setLeaderboardMessage(
        entries.length > 0 ? 'Global scores are up to date.' : 'Be the first pilot on the board.',
        'success',
      );
    }
  } catch (error) {
    console.warn('Leaderboard refresh failed:', error);
    setLeaderboardMessage('The online leaderboard is temporarily unavailable.', 'error');
  }
}

async function saveLeaderboardScore({ automatic = false } = {}) {
  if (!leaderboardReady || !leaderboardService || leaderboardSaving) return;

  const displayName = normalizePlayerName(playerNameInput.value);
  if (!displayName) {
    setLeaderboardMessage('Enter a callsign before saving your score.', 'error');
    if (!automatic) playerNameInput.focus();
    return;
  }
  if (state.highScore <= 0) {
    setLeaderboardMessage('Complete a mission before saving a score.', 'error');
    return;
  }

  leaderboardSaving = true;
  updateLeaderboardInterface();
  setLeaderboardMessage('Sending your best score to the defense network…', 'loading');

  try {
    const saved = await leaderboardService.saveBestScore(
      displayName,
      state.highScore,
      savedBestLevel,
    );
    playerNameInput.value = saved.displayName;
    localStorage.setItem(PLAYER_NAME_KEY, saved.displayName);
    lastSubmittedScore = Math.max(lastSubmittedScore, saved.bestScore);
    await refreshLeaderboard({ announce: false });
    const levelMessage = saved.bestLevel ? ` at level ${saved.bestLevel}` : '';
    setLeaderboardMessage(
      `${saved.displayName} synced a best score of ${String(saved.bestScore).padStart(5, '0')}${levelMessage}.`,
      'success',
    );
  } catch (error) {
    console.warn('Leaderboard save failed:', error);
    setLeaderboardMessage('Score sync failed. Check the Firebase setup and try again.', 'error');
  } finally {
    leaderboardSaving = false;
    updateLeaderboardInterface();
  }
}

async function initializeLeaderboard() {
  const firebase = getFirebaseConfiguration();
  if (!firebase.isConfigured) {
    renderLeaderboard([]);
    setLeaderboardMessage('Online scores will appear after Firebase is configured.', 'unavailable');
    updateLeaderboardInterface();
    return;
  }

  setLeaderboardMessage('Connecting to the global leaderboard…', 'loading');
  try {
    const { createFirebaseLeaderboardService } = await import('./leaderboard/firebase-service.js');
    leaderboardService = await createFirebaseLeaderboardService(firebase.config);
    leaderboardReady = true;
    updateLeaderboardInterface();
    await refreshLeaderboard();
  } catch (error) {
    console.warn('Leaderboard initialization failed:', error);
    setLeaderboardMessage('The online leaderboard could not connect.', 'error');
    updateLeaderboardInterface();
  }
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

  if (
    state.mode === 'gameover'
    && normalizePlayerName(playerNameInput.value)
    && state.highScore > lastSubmittedScore
  ) {
    void saveLeaderboardScore({ automatic: true });
  }
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
      overlayMessage.textContent = `Final score: ${state.score}. The fleet reached level ${state.level}. Save your best score below.`;
      startButton.textContent = 'Try again';
      quitButton.hidden = false;
      quitButton.textContent = 'Title screen';
    }
  }

  updateSettingsInterface();
  updateLeaderboardInterface();
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
leaderboardForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void saveLeaderboardScore();
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

  if (state.highScore > savedHighScore) {
    savedHighScore = state.highScore;
    savedBestLevel = state.level;
    localStorage.setItem(HIGH_SCORE_KEY, String(savedHighScore));
    localStorage.setItem(BEST_LEVEL_KEY, String(savedBestLevel));
  }

  renderer.render(state);
  updateInterface();
  requestAnimationFrame(frame);
}

renderer.render(state);
updateInterface();
void initializeLeaderboard();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((error) => console.warn('Service worker registration failed:', error));
  });
}
