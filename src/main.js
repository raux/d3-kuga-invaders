import './styles.css';
import { createInput } from './game/input.js';
import { createRenderer } from './game/renderer.js';
import { createInitialState, startNewGame } from './game/state.js';
import { bindActionButtons } from './game/touch-controls.js';
import { stepGame } from './game/update.js';

const HIGH_SCORE_KEY = 'd3-space-invaders-high-score';
const svg = document.querySelector('#game-board');
const renderer = createRenderer(svg);
const input = createInput(window);
const score = document.querySelector('#score');
const highScore = document.querySelector('#high-score');
const lives = document.querySelector('#lives');
const level = document.querySelector('#level');
const overlay = document.querySelector('#game-overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayMessage = document.querySelector('#overlay-message');
const startButton = document.querySelector('#start-button');
const pauseButton = document.querySelector('#pause-button');
const gameStatus = document.querySelector('#game-status');

let state = createInitialState(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0);
let previousTimestamp = performance.now();
let savedHighScore = state.highScore;
let announcedMode = state.mode;

function beginGame() {
  state = startNewGame(state.highScore);
  previousTimestamp = performance.now();
}

function togglePause() {
  if (state.mode === 'running') state.mode = 'paused';
  else if (state.mode === 'paused') state.mode = 'running';
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

function updateInterface() {
  score.textContent = String(state.score).padStart(5, '0');
  highScore.textContent = String(state.highScore).padStart(5, '0');
  lives.textContent = '◆'.repeat(Math.max(0, state.lives)) || '—';
  level.textContent = String(state.level).padStart(2, '0');
  pauseButton.disabled = !['running', 'paused'].includes(state.mode);
  pauseButton.textContent = state.mode === 'paused' ? 'Resume' : 'Pause';
  pauseButton.setAttribute('aria-pressed', String(state.mode === 'paused'));

  if (state.mode === 'running') {
    overlay.hidden = true;
  } else {
    overlay.hidden = false;

    if (state.mode === 'ready') {
      overlayTitle.textContent = 'Defend Kuga';
      overlayMessage.textContent = 'Move with keyboard or touch controls. Fire to defend Kuga.';
      startButton.textContent = 'Start mission';
    } else if (state.mode === 'paused') {
      overlayTitle.textContent = 'Mission paused';
      overlayMessage.textContent = 'Press P, Escape, or Resume when you are ready.';
      startButton.textContent = 'Resume';
    } else {
      overlayTitle.textContent = 'Kuga has fallen';
      overlayMessage.textContent = `Final score: ${state.score}. The fleet reached level ${state.level}.`;
      startButton.textContent = 'Try again';
    }
  }

  announceModeChange();
}

startButton.addEventListener('click', () => {
  if (state.mode === 'paused') togglePause();
  else beginGame();
});
pauseButton.addEventListener('click', togglePause);

bindActionButtons(document.querySelectorAll('[data-action]'), input);

function frame(timestamp) {
  if (input.consume('pause')) togglePause();

  const deltaSeconds = (timestamp - previousTimestamp) / 1000;
  previousTimestamp = timestamp;
  stepGame(state, deltaSeconds, input.snapshot());

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
