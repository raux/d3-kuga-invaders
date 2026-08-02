function setPressed(button, pressed) {
  button.setAttribute('aria-pressed', String(pressed));
}

export function bindActionButtons(buttons, input) {
  const buttonList = Array.from(buttons);
  const activePointers = new Map();
  const actionCounts = new Map();

  function press(event) {
    if (activePointers.has(event.pointerId)) return;

    event.preventDefault();
    const button = event.currentTarget;
    const action = button.dataset.action;
    activePointers.set(event.pointerId, { action, button });
    actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
    input.setAction(action, true);
    setPressed(button, true);

    if (button.setPointerCapture) {
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional on older mobile browsers.
      }
    }
  }

  function release(event) {
    const active = activePointers.get(event.pointerId);
    if (!active) return;

    event.preventDefault();
    activePointers.delete(event.pointerId);

    const nextCount = Math.max(0, (actionCounts.get(active.action) || 1) - 1);
    if (nextCount === 0) {
      actionCounts.delete(active.action);
      input.setAction(active.action, false);
    } else {
      actionCounts.set(active.action, nextCount);
    }

    const buttonStillPressed = [...activePointers.values()]
      .some(({ button }) => button === active.button);
    setPressed(active.button, buttonStillPressed);
  }

  const listeners = [
    ['pointerdown', press],
    ['pointerup', release],
    ['pointercancel', release],
    ['lostpointercapture', release],
  ];

  buttonList.forEach((button) => {
    setPressed(button, false);
    listeners.forEach(([type, listener]) => button.addEventListener(type, listener));
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  return () => {
    activePointers.forEach(({ action }) => input.setAction(action, false));
    activePointers.clear();
    actionCounts.clear();
    buttonList.forEach((button) => {
      setPressed(button, false);
      listeners.forEach(([type, listener]) => button.removeEventListener(type, listener));
    });
  };
}

export function bindJoystick(control, input, { deadZone = 0.22 } = {}) {
  if (!control) return () => {};

  const knob = control.querySelector('.joystick-knob');
  let activePointerId = null;
  let activeDirection = null;

  function setDirection(direction) {
    if (direction === activeDirection) return;

    if (activeDirection) input.setAction(activeDirection, false);
    activeDirection = direction;
    if (activeDirection) input.setAction(activeDirection, true);
  }

  function updatePresentation(value, direction) {
    const bounds = control.getBoundingClientRect();
    const knobWidth = knob?.getBoundingClientRect().width || Math.min(bounds.height || 64, 64);
    const maxTravel = Math.max(0, (bounds.width - knobWidth) / 2 - 10);
    const offset = value * maxTravel;

    if (knob) knob.style.transform = `translate3d(${offset}px, 0, 0)`;
    control.dataset.direction = direction || 'center';
    control.setAttribute('aria-valuenow', String(Math.round(value * 100)));
    control.setAttribute(
      'aria-valuetext',
      direction === 'left' ? 'Moving left' : direction === 'right' ? 'Moving right' : 'Centered',
    );
  }

  function update(event) {
    const bounds = control.getBoundingClientRect();
    if (bounds.width <= 0) return;

    const center = bounds.left + bounds.width / 2;
    const value = Math.max(-1, Math.min(1, (event.clientX - center) / (bounds.width / 2)));
    const direction = value < -deadZone ? 'left' : value > deadZone ? 'right' : null;
    setDirection(direction);
    updatePresentation(value, direction);
  }

  function reset() {
    setDirection(null);
    control.dataset.active = 'false';
    updatePresentation(0, null);
  }

  function start(event) {
    if (activePointerId !== null) return;

    event.preventDefault();
    activePointerId = event.pointerId;
    control.dataset.active = 'true';
    update(event);

    if (control.setPointerCapture) {
      try {
        control.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional on older mobile browsers.
      }
    }
  }

  function move(event) {
    if (event.pointerId !== activePointerId) return;
    event.preventDefault();
    update(event);
  }

  function stop(event) {
    if (event.pointerId !== activePointerId) return;
    event.preventDefault();
    activePointerId = null;
    reset();
  }

  function keyDown(event) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' ? 'left' : 'right';
    setDirection(direction);
    updatePresentation(direction === 'left' ? -1 : 1, direction);
  }

  function keyUp(event) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    reset();
  }

  const listeners = [
    ['pointerdown', start],
    ['pointermove', move],
    ['pointerup', stop],
    ['pointercancel', stop],
    ['lostpointercapture', stop],
    ['keydown', keyDown],
    ['keyup', keyUp],
  ];
  const preventContextMenu = (event) => event.preventDefault();

  control.dataset.active = 'false';
  reset();
  listeners.forEach(([type, listener]) => control.addEventListener(type, listener));
  control.addEventListener('contextmenu', preventContextMenu);

  return () => {
    activePointerId = null;
    reset();
    listeners.forEach(([type, listener]) => control.removeEventListener(type, listener));
    control.removeEventListener('contextmenu', preventContextMenu);
  };
}

export function bindDragControl(surface, input, worldWidth, { startRegion = 'all' } = {}) {
  let activePointerId = null;

  function updateTarget(event) {
    const bounds = surface.getBoundingClientRect();
    if (bounds.width <= 0) return;

    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    input.setTargetX(ratio * worldWidth);
  }

  function start(event) {
    if (activePointerId !== null) return;

    const bounds = surface.getBoundingClientRect();
    if (
      startRegion === 'bottom-half'
      && Number.isFinite(bounds.top)
      && Number.isFinite(bounds.height)
      && event.clientY < bounds.top + bounds.height / 2
    ) return;

    event.preventDefault();
    activePointerId = event.pointerId;
    updateTarget(event);

    if (surface.setPointerCapture) {
      try {
        surface.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional on older mobile browsers.
      }
    }
  }

  function move(event) {
    if (event.pointerId !== activePointerId) return;
    event.preventDefault();
    updateTarget(event);
  }

  function stop(event) {
    if (event.pointerId !== activePointerId) return;
    event.preventDefault();
    activePointerId = null;
    input.setTargetX(null);
  }

  const listeners = [
    ['pointerdown', start],
    ['pointermove', move],
    ['pointerup', stop],
    ['pointercancel', stop],
    ['lostpointercapture', stop],
  ];
  listeners.forEach(([type, listener]) => surface.addEventListener(type, listener));

  return () => {
    activePointerId = null;
    input.setTargetX(null);
    listeners.forEach(([type, listener]) => surface.removeEventListener(type, listener));
  };
}
