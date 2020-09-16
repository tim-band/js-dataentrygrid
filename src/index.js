/**
 * Initialize an HTML table to be a data entry grid.
 * 
 * @param {string}  containerId id of the `table` element you want to make interactive
 * @param {number} rows count of rows already existing in the table
 * @param {number} columns count of columns already existing in the table
 * @returns {Object} The table object.
 */
function createDataEntryGrid(containerId, rows, columns) {
  var rowCount = rows;
  var columnCount = columns;
  var anchorRow = 0;
  var anchorColumn = 0;
  var selectionRow = 0;
  var selectionColumn = 0;
  var returnColumn = 0;
  var inputBox = null;
  var contextMenu = null;
  var localizedText = {
    deleteRow: 'Delete row',
    addRowBefore: 'Add row before',
    addRowAfter: 'Add row after'
  };
  const undo = undoSystem();
  function noop() { return null; }
  var commitEdit = noop;
  var table = document.getElementById(containerId); // while we aren't creating our own table

  function getRow(r) {
    return getTbody().getElementsByTagName('TR')[r];
  }

  function getCell(r, c) {
    return getRow(r).getElementsByTagName('TD')[c];
  }

  function getAnchor() {
    return getCell(anchorRow, anchorColumn);
  }

  function getColumnHeaders() {
    var thead = table.getElementsByTagName('THEAD');
    if (thead.length === 0) {
      return [];
    }
    var ths = thead[0].getElementsByTagName('TH');
    var headers = [];
    for (var i = 1; i !== ths.length; ++i) {
      headers.push(ths[i].textContent);
    }
    return headers;
  }

  // Create a DOM element containing a load of other
  // elements:
  // createElementArray('TR', 'TD', ['one, 'two', 'three'], function(e,x) {e.textContent = x;})
  // Can use an already-constructed element for container.
  // Can use the number of items instead of an array for items (and get 0, 1, 2...)
  // Can leave out adaptFn.
  function createElementArray(container, element, items, adaptFn) {
    if (typeof (container) === 'string') {
      container = document.createElement(container);
    }
    var size = items;
    var getItem = function (index) { return index; }
    if (typeof (items) === 'object') {
      getItem = function (index) { return items[index]; }
      size = items.length;
    }
    for (var i = 0; i != size; ++i) {
      var sub = document.createElement(element);
      if (adaptFn) {
        adaptFn(sub, getItem(i));
      }
      container.appendChild(sub);
    }
    return container;
  }

  function init(headers, newRowCount) {
    var thead = createElementArray('THEAD', 'TR', 1, function (tr) {
      createElementArray(tr, 'TH', 1);
      createElementArray(tr, 'TH', headers, function (e, x) {
        e.textContent = x;
      });
    });
    var tbody = createElementArray('TBODY', 'TR', newRowCount, function (tr, i) {
      createElementArray(tr, 'TH', 1);
      createElementArray(tr, 'TD', headers.length, function (td, j) {
        if (i == 0 && j == 0) {
          td.setAttribute('class', 'anchor');
        }
      });
    });
    var oldTHeads = table.getElementsByTagName('THEAD');
    if (oldTHeads.length == 0) {
      table.appendChild(thead);
    } else {
      table.replaceChild(thead, oldTHeads[0]);
    }
    var oldTBodies = table.getElementsByTagName('TBODY');
    if (oldTBodies.length == 0) {
      table.appendChild(tbody);
    } else {
      table.replaceChild(tbody, oldTBodies[0]);
    }
    anchorRow = 0;
    selectionRow = 0;
    anchorColumn = 0;
    selectionColumn = 0;
    rowCount = newRowCount;
    columnCount = headers.length;
    undo.clearUndo();
    setCellMouseHandlers(0);
  }

  function removeContextMenu() {
    if (contextMenu) {
      table.removeChild(contextMenu);
      contextMenu = null;
    }
  }

  function getMouseCoordinates(ev) {
    // polyfill
    if (ev.pageX || ev.pageY) {
      return { x: ev.pageX, y: ev.pageY };
    }
    return {
      x: ev.clientX + document.body.scrollLeft + document.documentElement.scrollLeft,
      y: ev.clientY + document.body.scrollTop + document.documentElement.scrollTop
    }
  }

  function preventDefault(ev) {
    // Firefox polyfill
    if (ev.preventDefault) {
      ev.preventDefault();
    }
    // standard?
    if (ev.stopPropagation) {
      ev.stopPropagation();
    }
    // IE polyfill
    ev.cancelBubble = true;
    // IE7/8 polyfill
    return false;
  }

  function getEvent(ev) {
    // polyfill
    return ev ? ev : window.event;
  }

  function handleInputKey(ev) {
    ev = getEvent(ev);
    if (ev.keyCode === 9) {
      if (ev.shiftKey) {
        goToPreviousCell();
      } else {
        goToNextCell();
      }
      return preventDefault(ev);
    } else if (ev.keyCode === 13) {
      goToNextRow();
      return preventDefault(ev);
    }
    return true;
  }

  function beginEdit() {
    const box = document.createElement('INPUT');
    const r = anchorRow;
    const c = anchorColumn;
    let maxLength = 3;
    forEachRow(0, rowCount, function (row) {
      forEachColumn(row, c, c + 1, function (cell) {
        const len = cell.textContent.length;
        if (maxLength < len) {
          maxLength = len;
        }
      });
    });
    box.setAttribute('size', maxLength - 2);
    const cell = getCell(r, c);
    const text = cell.textContent;
    box.value = text;
    cell.textContent = '';
    cell.appendChild(box);
    commitEdit = function () { return doCommitEdit(r, c, box, text); }
    box.onkeydown = handleInputKey;
    box.onblur = function () {
      undo.undoable(doCommitEdit(r, c, box, text));
      table.focus();
    }
    box.setSelectionRange(0, box.value.length);
    box.focus();
    inputBox = box;
  }

  function doCommitEdit(row, column, box, oldValue) {
    inputBox = null;
    commitEdit = noop;
    var newValue = box.value;
    if (box.parentNode === null) {
      return null;
    }
    putCells(row, row + 1, column, column + 1, [[newValue]]);
    if (oldValue === newValue) {
      return null;
    }
    return function () { return putCellsAction(row, row + 1, column, column + 1, [[oldValue]]) };
  }

  function getTbody() {
    const tbodies = table.getElementsByTagName('TBODY');
    if (tbodies.length < 1) {
      throw 'No tbodies in table!';
    }
    return tbodies[0];
  }

  function insertRows(r, count) {
    undo.undoable(commitEdit());
    const tbody = getTbody();
    const insertFunction = r < rowCount ?
      function (child) { tbody.insertBefore(child, getRow(r)); }
      : function (child) { tbody.appendChild(child); };
    for (var i = 0; i !== count; ++i) {
      const row = createElementArray('TR', 'TH', 1);
      createElementArray(row, 'TD', columnCount);
      insertFunction(row);
    }
    rowCount += count;
    let selectionEndsMoved = 0;
    if (r <= anchorRow) {
      selectionEndsMoved += 1;
      anchorRow += count;
    }
    if (r <= selectionRow) {
      selectionEndsMoved += 1;
      selectionRow += count;
    }
    setCellMouseHandlers(r);
    if (selectionEndsMoved === 1) {
      forEachRow(r, r + count, markSelectedColumns);
    }
    return function () {
      return deleteRows(r, count);
    };
  }

  function deleteRows(r, count) {
    undo.undoable(commitEdit());
    const values = getCells(r, r + count, 0, columnCount);
    const tbody = getTbody();
    for (let i = 0; i !== count; ++i) {
      tbody.removeChild(tbody.children[r]);
    }
    rowCount -= count;
    if (r < anchorRow) {
      if (r + count < anchorRow) {
        anchorRow -= count;
      } else {
        anchorRow = r;
      }
    }
    if (rowCount <= anchorRow) {
      anchorRow = rowCount - 1;
    }
    if (r < selectionRow) {
      if (r + count < selectionRow) {
        selectionRow -= count;
      } else {
        selectionRow = r;
      }
    }
    if (rowCount <= selectionRow) {
      selectionRow = rowCount - 1;
    }
    setCellMouseHandlers(r);
    return function () {
      const inverse = insertRows(r, count);
      putCells(r, r + count, 0, columnCount, values);
      return inverse;
    };
  }

  function markSelectedColumns(row) {
    forEachSelectedColumn(row, function (cell) {
      cell.classList.add('selected');
    });
  }

  function setSelection(aRow, aColumn, sRow, sColumn) {
    getAnchor().classList.remove('anchor');
    forEachSelectedRow(function (row) {
      forEachSelectedColumn(row, function (cell) {
        cell.classList.remove('selected');
      });
    });
    anchorRow = aRow;
    anchorColumn = aColumn;
    selectionRow = sRow;
    selectionColumn = sColumn;
    forEachSelectedRow(function (row) {
      markSelectedColumns(row);
    });
    getAnchor().classList.add('anchor');
  }

  function doGoToCell(r, c) {
    undo.undoable(commitEdit());
    getAnchor().classList.remove('anchor');
    if (r < 0 || rowCount <= r
      || c < 0 || columnCount <= c) {
      return;
    }
    setSelection(r, c, r, c);
    getAnchor().classList.add('anchor');
    beginEdit();
  }

  function goToNextRow() {
    if (rowCount <= anchorRow + 1) {
      undo.undoable(insertRows(rowCount, 1));
    }
    doGoToCell(anchorRow + 1, returnColumn);
  }

  function goToPreviousCell() {
    doGoToCell(anchorRow, anchorColumn - 1);
  }
  function goToNextCell() {
    if (anchorColumn + 1 < columnCount) {
      doGoToCell(anchorRow, anchorColumn + 1);
    } else {
      goToNextRow();
    }
  }

  function goToCell(r, c) {
    returnColumn = c;
    doGoToCell(r, c);
  }

  function deleteRowsOption(count) {
    const el = document.createElement('OPTION');
    el.setAttribute('value', 'delete');
    el.textContent = localizedText.deleteRow;
    return el;
  }

  function addRowsBeforeOption(count) {
    const el = document.createElement('OPTION');
    el.setAttribute('value', 'add-before');
    el.textContent = localizedText.addRowBefore;
    return el;
  }

  function addRowsAfterOption(count) {
    const el = document.createElement('OPTION');
    el.setAttribute('value', 'add-after');
    el.textContent = localizedText.addRowAfter;
    return el;
  }

  function rowHeaderMenu(ev, r) {
    let firstRow = r;
    let count = 1;
    if ((r < anchorRow && r < selectionRow)
      || (anchorRow < r && selectionRow < r)) {
      setSelection(r, 0, r, columnCount - 1);
    } else {
      if (anchorRow < selectionRow) {
        firstRow = anchorRow;
        count = selectionRow - anchorRow + 1;
      } else {
        firstRow = selectionRow;
        count = anchorRow - selectionRow + 1;
      }
    }
    contextMenu = document.createElement('SELECT');
    const id = table.getAttribute('id').concat('-row-menu');
    contextMenu.setAttribute('id', id);
    contextMenu.setAttribute('size', 3);
    const deleteOption = deleteRowsOption();
    deleteOption.onclick = function () {
      undo.undoable(deleteRows(firstRow, count));
      table.focus();
    }
    contextMenu.appendChild(deleteOption);
    const addBeforeOption = addRowsBeforeOption();
    addBeforeOption.onclick = function () {
      undo.undoable(insertRows(firstRow, count));
      table.focus();
    }
    contextMenu.appendChild(addBeforeOption);
    const addAfterOption = addRowsAfterOption();
    addAfterOption.onclick = function () {
      undo.undoable(insertRows(firstRow + count, count));
      table.focus();
    }
    contextMenu.appendChild(addAfterOption);
    const mousePosition = getMouseCoordinates(ev);
    contextMenu.style.position = 'fixed';
    contextMenu.style.left = mousePosition.x + 'px';
    contextMenu.style.top = mousePosition.y + 'px';
    contextMenu.tabIndex = -1;
    contextMenu.zIndex = 10;
    contextMenu.onblur = removeContextMenu;
    contextMenu.contentEditable = false;
    table.appendChild(contextMenu);
    return contextMenu;
  }

  function forEachRow(rowStart, rowEnd, callback) {
    const rows = getTbody().getElementsByTagName('TR');
    const rEnd = (rows.length < rowEnd ? rows.length : rowEnd) - rowStart;
    for (var i = 0; i < rEnd; ++i) {
      callback(rows[rowStart + i], i, rowStart + i);
    }
  }

  function forEachColumn(row, columnStart, columnEnd, callback) {
    const cs = row.getElementsByTagName('TD');
    let cEnd = (cs.length < columnEnd ? cs.length : columnEnd) - columnStart;
    for (var i = 0; i < cEnd; ++i) {
      callback(cs[columnStart + i], i, columnStart + i);
    }
  }

  function forEachSelectedRow(callback) {
    forEachRow(Math.min(anchorRow, selectionRow),
      Math.max(anchorRow, selectionRow) + 1, callback);
  }

  function forEachSelectedColumn(row, callback) {
    forEachColumn(row, Math.min(anchorColumn, selectionColumn),
      Math.max(anchorColumn, selectionColumn) + 1, callback);
  }

  function setCellMouseHandlers(firstRow) {
    forEachRow(firstRow, rowCount, function (row, i, thisRow) {
      const rowHeaders = row.getElementsByTagName('TH');
      if (0 < rowHeaders.length) {
        const rh = rowHeaders[0];
        rh.textContent = thisRow + 1;
        rh.oncontextmenu = function (ev) {
          ev = getEvent(ev);
          const select = rowHeaderMenu(ev, thisRow);
          select.focus();
          return preventDefault(ev);
        }
        forEachColumn(row, 0, columnCount, function (cell, j, thisColumn) {
          cell.onclick = function () {
            goToCell(thisRow, thisColumn);
          };
          cell.onmouseenter = function (ev) {
            ev = getEvent(ev);
            // stretch selection over this cell
            if (ev.buttons & 1) {
              setSelection(anchorRow, anchorColumn, thisRow, thisColumn);
              table.focus();
              return preventDefault(ev);
            }
          };
          cell.onmousedown = function (ev) {
            ev = getEvent(ev);
            // set anchor and selection to this cell
            if (ev.button === 0) {
              undo.undoable(commitEdit());
              setSelection(thisRow, thisColumn, thisRow, thisColumn);
              table.focus();
              return preventDefault(ev);
            }
          }
        });
      }
    });
  }

  function getCells(rowStart, rowEnd, columnStart, columnEnd) {
    let vss = [];
    forEachRow(rowStart, rowEnd, function (row) {
      let vs = [];
      forEachColumn(row, columnStart, columnEnd, function (cell) {
        const inputs = cell.getElementsByTagName('INPUT');
        if (0 < inputs.length) {
          vs.push(inputs[0].value)
        } else {
          vs.push(cell.textContent);
        }
      });
      vss.push(vs);
    });
    return vss;
  }

  function putCells(rowStart, rowEnd, columnStart, columnEnd, values) {
    forEachRow(rowStart, rowEnd, function (row, i) {
      var vr = values[i];
      forEachColumn(row, columnStart, columnEnd, function (cell, j) {
        cell.textContent = typeof (vr) === 'undefined' ? '' : vr[j];
      });
    });
  }

  // an 'action' is a function that returns its inverse (which is also an action
  // and so returns a function that is the equivalent of the original action)
  function putCellsAction(rowStart, rowEnd, columnStart, columnEnd, values) {
    const oldValues = getCells(rowStart, rowEnd, columnStart, columnEnd);
    putCells(rowStart, rowEnd, columnStart, columnEnd, values);
    return function () { return putCellsAction(rowStart, rowEnd, columnStart, columnEnd, oldValues) };
  }

  function doUndo() {
    undo.undoable(commitEdit());
    undo.undo();
    table.focus();
  }

  function doRedo() {
    commitEdit();
    undo.redo();
    table.focus();
  }

  function clearSelection() {
    const firstRow = Math.min(anchorRow, selectionRow);
    const lastRow = Math.max(anchorRow, selectionRow) + 1;
    const firstColumn = Math.min(anchorColumn, selectionColumn);
    const lastColumn = Math.max(anchorColumn, selectionColumn) + 1;
    let row = [];
    for (let i = firstColumn; i !== lastColumn; ++i) {
      row.push('');
    }
    let empties = [];
    for (let j = firstRow; j !== lastRow; ++j) {
      empties.push(row);
    }
    undo.undoable(putCellsAction(firstRow, lastRow, firstColumn, lastColumn, empties));
  }

  function copySelection() {
    let texts = [];
    forEachSelectedRow(function (row) {
      let rowTexts = [];
      forEachSelectedColumn(row, function (cell) {
        const inputs = cell.getElementsByTagName('INPUT');
        if (0 < inputs.length) {
          rowTexts.push(inputs[0].value)
        } else {
          rowTexts.push(cell.textContent);
        }
      });
      texts.push(rowTexts.join('\t'));
    });
    return texts.join('\n');
  }

  function paste(clip) {
    if (clip.length === 0) {
      return;
    }
    let values = [];
    let maxRowLength = 0;
    const lines = clip.split('\n');
    if (lines[lines.length - 1].length === 0) {
      lines.pop();
    }
    for (let i = 0; i !== lines.length; ++i) {
      const row = lines[i].split('\t');
      values.push(row);
      if (maxRowLength < row.length) {
        maxRowLength = row.length;
      }
    }
    const firstRow = Math.min(anchorRow, selectionRow);
    let lastRow = Math.max(anchorRow, selectionRow) + 1;
    const firstColumn = Math.min(anchorColumn, selectionColumn);
    let lastColumn = Math.max(anchorColumn, selectionColumn) + 1;
    if (lastColumn < firstColumn + maxRowLength) {
      lastColumn = firstColumn + maxRowLength;
    }
    if (lastRow < firstRow + values.length) {
      lastRow = firstRow + values.length;
      if (rowCount < lastRow) {
        undo.undoable(insertRows(rowCount, lastRow - rowCount));
      }
    }
    // fill out extra columns if more are wanted
    for (let c = firstColumn + maxRowLength; c < lastColumn; ++c) {
      const source = c % maxRowLength;
      for (let r = 0; r !== values.length; ++r) {
        values[r][c - firstColumn] = values[r][source];
      }
    }
    // fill out extra rows if more are wanted
    const valueRowCount = values.length;
    const wantedRowCount = lastRow - firstRow;
    for (let r = valueRowCount; r < wantedRowCount; ++r) {
      values[r] = values[r % valueRowCount];
    }
    undo.undoable(putCellsAction(firstRow, lastRow, firstColumn, lastColumn, values));
  }

  function tableKeyPressHandler(ev) {
    ev = getEvent(ev);
    if (contextMenu) {
      return;
    }
    if (!inputBox) {
      beginEdit();
      const cc = ev.charCode || ev.keyCode; // IE8 polyfill
      inputBox.value = String.fromCharCode(cc);
      return preventDefault(ev);
    }
  }

  function tableCutHandler(ev) {
    ev = getEvent(ev);
    const text = copySelection();
    ev.clipboardData.setData('text/plain', text);
    clearSelection();
    table.focus(); // seems necessary on Firefox
    return preventDefault(ev);
  }

  function tableCopyHandler(ev) {
    ev = getEvent(ev);
    const text = copySelection();
    ev.clipboardData.setData('text/plain', text);
    return preventDefault(ev);
  }

  function tablePasteHandler(ev) {
    ev = getEvent(ev);
    if (0 <= ev.clipboardData.types.indexOf('text/plain')) {
      try {
        paste(ev.clipboardData.getData('text/plain'));
      } catch (err) {
        // catch and discard the error because otherwise
        // the data will get pasted into the table!
        console.log(err);
      }
    }
    table.focus(); // seems necessary on Firefox
    return preventDefault(ev);
  }

  function tableKeyDownHandler(ev) {
    ev = getEvent(ev);
    if (contextMenu) {
      if (ev.key === 'Escape') {
        table.focus();
      }
      // Select context menu option if enter or space pressed.
      // Surely there must be a better way to do this?
      if (ev.key === 'Enter' || ev.key === ' ') {
        const index = contextMenu.selectedIndex;
        if (0 <= index) {
          const options = contextMenu.getElementsByTagName('option');
          options[index].onclick();
          return preventDefault(ev);
        }
      }
      return;
    }
    // meta key so that Apple users can press meta-Z for undo.
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey) {
      if (ev.keyCode === 90) {
        if (ev.shiftKey) {
          doRedo();
        } else {
          doUndo();
        }
        return preventDefault(ev);
      }
    }
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      clearSelection();
      return preventDefault(ev);
    }
    if (moveSelection(ev) === false) {
      return preventDefault(ev);
    }
    if (moveAnchor(ev) === false) {
      return preventDefault(ev);
    }
  }

  function moveAnchor(ev) {
    if (ev.shiftKey || ev.altKey || ev.ctrlKey || ev.metaKey) {
      return;
    }
    if (ev.key === 'ArrowUp' && 0 < anchorRow) {
      undo.undoable(commitEdit());
      setSelection(anchorRow - 1, anchorColumn, anchorRow - 1, anchorColumn);
      beginEdit();
      return false;
    }
    if (ev.key === 'ArrowDown' && anchorRow + 1 < rowCount) {
      undo.undoable(commitEdit());
      setSelection(anchorRow + 1, anchorColumn, anchorRow + 1, anchorColumn);
      beginEdit();
      return false;
    }
    const inputNotSelected = inputBox &&
      inputBox.selectionStart === inputBox.selectionEnd;
    const inputAtStart = inputNotSelected && inputBox.selectionStart === 0;
    const inputAtEnd = inputNotSelected && inputBox.selectionStart === inputBox.value.length;
    if (ev.key === 'ArrowLeft' && 0 < anchorColumn
      && (!inputBox || inputAtStart)) {
      undo.undoable(commitEdit());
      setSelection(anchorRow, anchorColumn - 1, anchorRow, anchorColumn - 1);
      returnColumn = anchorColumn;
      beginEdit();
      return false;
    }
    if (ev.key === 'ArrowRight' && anchorColumn + 1 < columnCount
      && (!inputBox || inputAtEnd)) {
      undo.undoable(commitEdit());
      setSelection(anchorRow, anchorColumn + 1, anchorRow, anchorColumn + 1);
      returnColumn = anchorColumn;
      beginEdit();
      return false;
    }
  }

  function moveSelection(ev) {
    if (!ev.shiftKey || ev.altKey || ev.ctrlKey || ev.metaKey) {
      return;
    }
    if (ev.key === 'ArrowUp') {
      if (0 < selectionRow) {
        setSelection(anchorRow, anchorColumn, selectionRow - 1, selectionColumn);
      }
      return false;
    }
    if (ev.key === 'ArrowDown') {
      if (selectionRow + 1 < rowCount) {
        setSelection(anchorRow, anchorColumn, selectionRow + 1, selectionColumn);
      }
      return false;
    }
    if (ev.key === 'ArrowLeft') {
      if (0 < selectionColumn) {
        setSelection(anchorRow, anchorColumn, selectionRow, selectionColumn - 1);
      }
      return false;
    }
    if (ev.key === 'ArrowRight') {
      if (selectionColumn + 1 < columnCount) {
        setSelection(anchorRow, anchorColumn, selectionRow, selectionColumn + 1);
      }
      return false;
    }
  }
  setCellMouseHandlers(0);
  table.onkeydown = tableKeyDownHandler;
  table.onkeypress = tableKeyPressHandler;
  table.contentEditable = true;
  table.oncut = tableCutHandler;
  table.oncopy = tableCopyHandler;
  table.onpaste = tablePasteHandler;
  table.onmousemove = function (ev) {
    ev = getEvent(ev);
    // prevent default drag-select
    if (ev.buttons & 1) {
      return preventDefault(ev);
    }
  };
  table.onmousedown = function (ev) {
    ev = getEvent(ev);
    // prevent default drag-select
    if (ev.button === 0) {
      return preventDefault(ev);
    }
  };
  table.tabIndex = 0;
  table.focus();
  return {
    /**
     * Re-initialize the table.
     * @param {Object} Array of strings to become the new column headers
     * @param {number} Number of rows the table should now have
     */
    init: init,
    /**
     * Sets localized text for the row header context table.
     * @param {Object} newText Text of table ids to strings. The ids currently
     * recognized are `deleteRow`, `addRowBefore` and `addRowAfter`.
     */
    setText: function (newText) {
      for (const k in localizedText) {
        if (k in newText) {
          localizedText[k] = newText[k];
        }
      }
    },
    /**
     * Sets existing buttons on the page to be functional undo and redo
     * buttons, including becoming disabled when the appropriate stack
     * is exhausted.
     * @param {HTMLButtonElement} undoButton Button to set as undo
     * button (or null)
     * @param {HTMLButtonElement} redoButton Button to set as redo
     * button (or null)
     */
    setButtons: (undoButton, redoButton) => undo.setButtons(undoButton, redoButton),
    /**
     * Gets the position and size of the selection.
     * @returns {Object} the position of the selection given by the
     * following keys: `anchorRow`, `anchorColumn`, `selectionRow`,
     * `selectionColumn`.
     */
    getSelection: function () {
      return {
        anchorRow: anchorRow,
        anchorColumn: anchorColumn,
        selectionRow: selectionRow,
        selectionColumn: selectionColumn
      };
    },
    /**
     * Returns the number of rows.
     * @returns {number} of rows in the table
     */
    rowCount: function () { return rowCount },
    /**
     * Returns the number of columns.
     * @returns {number} of columns in the table
     */
    columnCount: function () { return columnCount },
    /**
     * Returns the column headers.
     * @returns {Object} array of strings.
     */
    getColumnHeaders: getColumnHeaders,
    /**
     * Moves the anchor (and selection to the same place)
     * @params {number} row to go to
     * @params {number} column to go to
     */
    goToCell: goToCell,
    /**
     * Gets the text of the cells requested.
     * @param {number} rowStart first row (zero-based)
     * @param {number} rowEnd one past the last row
     * @param {number} columnStart first column
     * @param {number} columnEnd one past the last column
     * @return {Object} Array of rows, each of which is an array
     * of strings, the contents of each cell.
     */
    getCells: getCells,
    /**
     * Gets the text of the cells requested.
     * @param {number} rowStart first row (zero-based)
     * @param {number} rowEnd one past the last row
     * @param {number} columnStart first column
     * @param {number} columnEnd one past the last column
     * @param {Object} values Array of rows, each of which is an array
     * of strings, the contents of each cell.
     */
    putCells: function (rowStart, rowEnd, columnStart, columnEnd, values) {
      undo.undoable(putCellsAction(rowStart, rowEnd, columnStart, columnEnd, values));
    },
    /**
     * Clear the undo and redo stacks.
     */
    clearUndo: () => undo.clearUndo(),
    /**
     * Undoes the last action done or redone.
     */
    undo: () => doUndo(),
    /**
     * Redoes the last undone action.
     */
    redo: () => doRedo()
  };
};
