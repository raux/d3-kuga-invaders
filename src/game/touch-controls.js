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

export function bindDragControl(surface, input, worldWidth) {
  let activePointerId = null;

  function updateTarget(event) {
    const bounds = surface.getBoundingClientRect();
    if (bounds.width <= 0) return;

    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    input.setTargetX(ratio * worldWidth);
  }

  function start(event) {
    if (activePointerId !== null) return;

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
