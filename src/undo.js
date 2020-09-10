function undoSystem() {

  let undoStack = [];
  let redoStack = [];
  let undoButton = null;
  let redoButton = null;

  // undoable(myAction()) pushes the inverse action onto the undo stack
  function undoable(action) {
    if (action !== null) {
      if (redoButton && redoStack.length !== 0) {
        redoButton.setAttribute('disabled', '');
      }
      if (undoButton && undoStack.length === 0) {
        undoButton.removeAttribute('disabled');
      }
      undoStack.push(action);
      redoStack = [];
    }
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
  }

  function setButtons(anUndoButton, aRedoButton) {
    undoButton = anUndoButton;
    redoButton = aRedoButton;
    if (undoButton) {
      undoButton.onclick = undo;
      if (undoStack.length === 0) {
        undoButton.setAttribute('disabled', '');
      } else {
        undoButton.removeAttribute('disabled');
      }
    }
    if (redoButton) {
      redoButton.onclick = redo;
      if (redoStack.length === 0) {
        redoButton.setAttribute('disabled', '');
      } else {
        redoButton.removeAttribute('disabled');
      }
    }
  }

  return {
    undoable,
    setButtons,
    clearUndo,
    undo,
    redo
  };
};
