const KEY_TO_ACTION = new Map([
  ['ArrowLeft', 'left'],
  ['KeyA', 'left'],
  ['ArrowRight', 'right'],
  ['KeyD', 'right'],
  ['Space', 'fire'],
]);

export function createInput(target = window) {
  const held = new Set();
  const pressed = new Set();
  let targetX = null;

  function setAction(action, active) {
    if (active) {
      if (!held.has(action)) pressed.add(action);
      held.add(action);
    } else {
      held.delete(action);
    }
  }

  function onKeyDown(event) {
    const action = KEY_TO_ACTION.get(event.code);
    if (action) {
      event.preventDefault();
      setAction(action, true);
      return;
    }

    if (event.code === 'KeyP' || event.code === 'Escape') {
      event.preventDefault();
      pressed.add('pause');
    }
  }

  function onKeyUp(event) {
    const action = KEY_TO_ACTION.get(event.code);
    if (action) setAction(action, false);
  }

  function setTargetX(value) {
    targetX = Number.isFinite(value) ? value : null;
  }

  function consume(action) {
    const wasPressed = pressed.has(action);
    pressed.delete(action);
    return wasPressed;
  }

  function snapshot() {
    return {
      left: held.has('left'),
      right: held.has('right'),
      fire: held.has('fire'),
      targetX,
    };
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', () => {
    held.clear();
    targetX = null;
  });

  return { snapshot, consume, setAction, setTargetX };
}
