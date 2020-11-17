function undoSystem() {

  let undoStack = [];
  let redoStack = [];
  let undoButton = null;
  let redoButton = null;
  let watchers = [];

  function callWatchers() {
    for (let i = 0; i != watchers.length; ++i) {
      watchers[i]();
    }
  }

  // undoable(myAction()) pushes the inverse action onto the undo stack.
  // returns true if the action wasn't null
  function undoable(action) {
    if (action === null) {
      return false;
    }
    if (redoButton && redoStack.length !== 0) {
      redoButton.setAttribute('disabled', '');
    }
    if (undoButton && undoStack.length === 0) {
      undoButton.removeAttribute('disabled');
    }
    undoStack.push(action);
    redoStack = [];
    callWatchers();
    return true;
  }

  function redo() {
    if (redoStack.length !== 0) {
      const action = redoStack.pop()();
      if (redoButton && redoStack.length === 0) {
        redoButton.setAttribute('disabled', '');
      }
      if (action !== null) {
        if (undoButton && undoStack.length === 0) {
          undoButton.removeAttribute('disabled');
        }
        undoStack.push(action);
        callWatchers();
      }
    }
  }

  function undo() {
    if (undoStack.length !== 0) {
      const action = undoStack.pop()();
      if (undoButton && undoStack.length === 0) {
        undoButton.setAttribute('disabled', '');
      }
      if (action !== null) {
        if (redoButton && redoStack.length === 0) {
          redoButton.removeAttribute('disabled');
        }
        redoStack.push(action);
        callWatchers();
      }
    }
  }

  function clearUndo() {
    if (redoButton && redoStack.length !== 0) {
      redoButton.setAttribute('disabled', '');
    }
    if (undoButton && undoStack.length !== 0) {
      undoButton.setAttribute('disabled', '');
    }
    redoStack = [];
    undoStack = [];
    // although clearing the undo stack is not in itself a change
    // of state, it is usually done just after the table undergoes
    // a big change (that would invalidate the undo stack)
    callWatchers();
  }

  function setButtons(anUndoButton, aRedoButton, afterFn) {
    undoButton = anUndoButton;
    redoButton = aRedoButton;
    if (undoButton) {
      undoButton.onclick = afterFn?
          function() { undo(); afterFn(); }
          : undo;
      if (undoStack.length === 0) {
        undoButton.setAttribute('disabled', '');
      } else {
        undoButton.removeAttribute('disabled');
      }
    }
    if (redoButton) {
      redoButton.onclick = afterFn?
          function() { redo(); afterFn(); }
          : redo;
      if (redoStack.length === 0) {
        redoButton.setAttribute('disabled', '');
      } else {
        redoButton.removeAttribute('disabled');
      }
    }
  }

  function addWatcher(f) {
    watchers.push(f);
  }

  return {
    undoable,
    setButtons,
    clearUndo,
    undo,
    redo,
    addWatcher
  };
};
