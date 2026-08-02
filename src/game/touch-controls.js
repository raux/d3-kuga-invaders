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
  const movementActions = ['left', 'right', 'up', 'down'];
  const keyActions = new Map([
    ['arrowleft', 'left'],
    ['a', 'left'],
    ['arrowright', 'right'],
    ['d', 'right'],
    ['arrowup', 'up'],
    ['w', 'up'],
    ['arrowdown', 'down'],
    ['s', 'down'],
  ]);
  let activePointerId = null;
  let activeDirections = new Set();
  let pointerDirections = new Set();
  const keyboardDirections = new Set();
  let pointerAxes = { x: 0, y: 0 };

  function syncDirections() {
    const nextDirections = new Set([...pointerDirections, ...keyboardDirections]);
    movementActions.forEach((action) => {
      if (activeDirections.has(action) !== nextDirections.has(action)) {
        input.setAction(action, nextDirections.has(action));
      }
    });
    activeDirections = nextDirections;
  }

  function directionLabel(directions) {
    const vertical = directions.has('up') ? 'up' : directions.has('down') ? 'down' : '';
    const horizontal = directions.has('left') ? 'left' : directions.has('right') ? 'right' : '';
    if (!vertical && !horizontal) return 'Centered';
    return `Moving ${[vertical, horizontal].filter(Boolean).join(' and ')}`;
  }

  function updatePresentation(xValue, yValue) {
    const bounds = control.getBoundingClientRect();
    const knobBounds = knob?.getBoundingClientRect() || {};
    const fallbackSize = Math.min(bounds.width || 58, bounds.height || 58, 58);
    const knobWidth = knobBounds.width || fallbackSize;
    const knobHeight = knobBounds.height || fallbackSize;
    const maxTravelX = Math.max(0, (bounds.width - knobWidth) / 2 - 10);
    const maxTravelY = Math.max(0, (bounds.height - knobHeight) / 2 - 10);
    const combinedDirections = new Set([...pointerDirections, ...keyboardDirections]);

    if (knob) {
      knob.style.transform = `translate3d(${xValue * maxTravelX}px, ${yValue * maxTravelY}px, 0)`;
    }
    control.dataset.horizontal = combinedDirections.has('left')
      ? 'left'
      : combinedDirections.has('right') ? 'right' : 'center';
    control.dataset.vertical = combinedDirections.has('up')
      ? 'up'
      : combinedDirections.has('down') ? 'down' : 'center';
    control.dataset.direction = directionLabel(combinedDirections).toLowerCase().replace('moving ', '').replaceAll(' ', '-');
    control.setAttribute('aria-label', `Two-axis ship joystick. ${directionLabel(combinedDirections)}.`);
  }

  function updateFromPointer(event) {
    const bounds = control.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    let xValue = (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2);
    let yValue = (event.clientY - (bounds.top + bounds.height / 2)) / (bounds.height / 2);
    const magnitude = Math.hypot(xValue, yValue);
    if (magnitude > 1) {
      xValue /= magnitude;
      yValue /= magnitude;
    }

    pointerDirections = new Set();
    if (xValue < -deadZone) pointerDirections.add('left');
    else if (xValue > deadZone) pointerDirections.add('right');
    if (yValue < -deadZone) pointerDirections.add('up');
    else if (yValue > deadZone) pointerDirections.add('down');
    pointerAxes = { x: xValue, y: yValue };
    syncDirections();
    updatePresentation(xValue, yValue);
  }

  function keyboardAxes() {
    return {
      x: Number(keyboardDirections.has('right')) - Number(keyboardDirections.has('left')),
      y: Number(keyboardDirections.has('down')) - Number(keyboardDirections.has('up')),
    };
  }

  function start(event) {
    if (activePointerId !== null) return;

    event.preventDefault();
    activePointerId = event.pointerId;
    control.dataset.active = 'true';
    updateFromPointer(event);

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
    updateFromPointer(event);
  }

  function stop(event) {
    if (event.pointerId !== activePointerId) return;
    event.preventDefault();
    activePointerId = null;
    pointerDirections.clear();
    pointerAxes = { x: 0, y: 0 };
    syncDirections();
    control.dataset.active = String(keyboardDirections.size > 0);
    const axes = keyboardAxes();
    updatePresentation(axes.x, axes.y);
  }

  function keyDown(event) {
    const action = keyActions.get(event.key.toLowerCase());
    if (!action) return;
    event.preventDefault();
    keyboardDirections.add(action);
    syncDirections();
    control.dataset.active = 'true';
    const axes = activePointerId === null ? keyboardAxes() : pointerAxes;
    updatePresentation(axes.x, axes.y);
  }

  function keyUp(event) {
    const action = keyActions.get(event.key.toLowerCase());
    if (!action) return;
    event.preventDefault();
    keyboardDirections.delete(action);
    syncDirections();
    control.dataset.active = String(activePointerId !== null || keyboardDirections.size > 0);
    const axes = activePointerId === null ? keyboardAxes() : pointerAxes;
    updatePresentation(axes.x, axes.y);
  }

  function reset() {
    activePointerId = null;
    pointerDirections.clear();
    keyboardDirections.clear();
    pointerAxes = { x: 0, y: 0 };
    syncDirections();
    control.dataset.active = 'false';
    updatePresentation(0, 0);
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

  reset();
  listeners.forEach(([type, listener]) => control.addEventListener(type, listener));
  control.addEventListener('contextmenu', preventContextMenu);

  return () => {
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
