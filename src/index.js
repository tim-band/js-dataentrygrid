/**
 * Initialize an HTML table to be a data entry grid.
 * 
 * The HTML table made interactive will gain a `dataEntryGrid`
 * member referring to the table object returned.
 * @param {string}  containerId id of the `table` element you want to make interactive
 * @param {string[]|number} headers array of strings to become the new column headers
 * or the number of columns to be created. If a number is given, the columns will be
 * named 'A', 'B', 'C' and so on, and the set of columns will be able to be added and
 * deleted. If an array of strings is given, the columns will be fixed.
 * @param {number} newRowCount number of rows the table should now have
 * @returns {Object} The table object.
 */
function createDataEntryGrid(containerId, headers, newRowCount) {
  var rowCount = 0;
  var columnCount = 0;
  var anchorRow = 0;
  var anchorColumn = 0;
  var selectionRow = 0;
  var selectionColumn = 0;
  var returnColumn = 0;
  var inputBox = null;
  var contextMenu = null;
  var hiddenTextarea = null;
  var selecting = false;
  var localizedText = {
    cut: 'Cut',
    copy: 'Copy',
    deleteRow: 'Delete row',
    addRowBefore: 'Add row before',
    addRowAfter: 'Add row after',
    deleteColumn: 'Delete column',
    addColumnBefore: 'Add column before',
    addColumnAfter: 'Add column after'
  };
  let rowHeaders = null;
  let columnsAreFlexible = false;
  const undo = undoSystem();
  function noop() { return null; }
  var commitEdit = noop;
  var reunittingFunction = null;
  var formattingFunction = null;

  const table = function() {
    if (typeof(containerId) === 'string') {
      const t = document.getElementById(containerId);
      if (t) {
        return t;
      }
      const n = document.createElement('TABLE');
      n.id = containerId;
    }
    const n = document.createElement('TABLE');
    for (;;) {
      const id = 'table-' + Math.floor(Math.random() * 9000 + 1000);
      if (!document.getElementById(id)) {
        n.id = id;
        return n;
      }
    }
  }();

  if (!table) {
    console.error(`no such table #${containerId}`);
    return null;
  }

  table.classList.add('data-entry-grid');

  function getRow(r) {
    return getTbody().getElementsByTagName('TR')[r];
  }

  function getCell(r, c) {
    return getRow(r).getElementsByTagName('TD')[c];
  }

  function getRowHeader(r) {
    return getRow(r).getElementsByTagName('TH')[0];
  }

  function getAnchor() {
    return getCell(anchorRow, anchorColumn);
  }

  function getColumnHeaderRow() {
    const thead = table.getElementsByTagName('THEAD');
    if (thead.length === 0) {
      return [];
    }
    const tr = thead[0].getElementsByTagName('TR');
    if (tr.length === 0) {
      return [];
    }
    return tr[0].getElementsByTagName('TH');
  }

  function getTextContents(array, startFrom) {
    const r = [];
    for (let i = startFrom; i < array.length; ++i) {
      r.push(array[i].textContent);
    }
    return r;
  }

  function getColumnHeaders() {
    const ths = getColumnHeaderRow();
    return getTextContents(ths, 1);
  }

  function columnHeaderToIndexMap() {
    const ths = getColumnHeaderRow();
    const mapping = {};
    for (let i = 1; i !== ths.length; ++i) {
      mapping[ths[i].textContent] = i - 1;
    }
    return mapping;
  }

  function getRowHeaders() {
    const tbody = table.getElementsByTagName('TBODY');
    if (tbody.length === 0) {
      return [];
    }
    const ths = tbody[0].getElementsByTagName('TH');
    return getTextContents(ths, 0);
  }

  // f is passed the select element and index (0-based) (only if the select element exists)
  // fTd is passed the td element and index (only if the select element does not exist)
  function forEachSubheader(f, fTd) {
    const tds = getSubheaderTr().getElementsByTagName('TD');
    for (let i = 0; i !== tds.length; ++i) {
      const td = tds[i];
      const selects = td.getElementsByTagName('SELECT');
      if (selects.length === 0) {
        if (fTd) {
          fTd(td, i);
        }
      } else if (f) {
        f(selects[0], i);
      }
    }
  }

  function getSubheaders() {
    const vs = [];
    forEachSubheader(
      function(s) { vs.push(s.value) },
      function() { vs.push(null); }
    );
    return vs;
  }

  function hideSubheaders() {
    forEachSubheader(function(s) {
      s.style.display = 'none';
    });
  }

  // optionSpecs is a list of option specifications (one per column).
  // Each option specification is an object mapping values to display names.
  // A subheader change function takes arguments oldValue, newValue,
  // column values and returns the new column values (or null for no change)
  function setSubheaders(optionSpecs, defaultOptions) {
    if (!optionSpecs) {
      return;
    }
    forEachSubheader(
      function(s, i) {
        if (!(i in optionSpecs) || !optionSpecs[i]) {
          s.style.display = 'none';
          return;
        }
        const spec = optionSpecs[i];
        const values = Object.keys(spec);
        s.style.display = 'block';
        s.textContent = ''; // clear out existing options
        createElementArray(s, 'OPTION', values, function(opt, value) {
          opt.textContent = spec[value];
          opt.value = value;
        });
        reunittingFunction = null;
        if (defaultOptions && i in defaultOptions && defaultOptions[i]) {
          s.value = defaultOptions[i];
        } else {
          s.value = values[0];
        }
        s.oldValue = s.value;
        s.onchange = function() {
          if (s.value === s.oldValue) {
            return;
          }
          let oldColumn = null;
          let newColumn = null;
          if (reunittingFunction) {
            oldColumn = getColumn(i);
            newColumn = reunittingFunction(i, s.oldValue, s.value, oldColumn);
          }
          undo.undoable(
            setColumnAndSubheaderAction(
              i, s.oldValue, s.value, oldColumn, newColumn
            )
          );
        };
      }
    );
  }

  function refocus() {
    hiddenTextarea.focus();
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

  function createElement(tag, attributes) {
    const e = document.createElement(tag);
    for(let k in attributes) {
      e.setAttribute(k, attributes[k]);
    }
    return e;
  }

  const unicodeForA = 'A'.charCodeAt(0);
  function flexibleColumnName(c) {
    const u = String.fromCharCode(unicodeForA + c % 26);
    return c < 26? u : String.fromCharCode(c / 26 + unicodeForA - 1).concat(u);
  }

  function init(headers, rows, subheaderSpecs, subheaderDefaults) {
    if (typeof(headers) === 'number') {
      columnsAreFlexible = true;
      const n = headers;
      headers = [];
      for(let i = 0; i < n; ++i) {
        headers.push(flexibleColumnName(i));
      }
      subheaderSpecs = null;
      subheaderDefaults = null;
    } else {
      columnsAreFlexible = false;
    }
    let data = [];
    if (typeof(rows) === 'object') {
      if (0 in rows && typeof(rows[0]) === 'object') {
        data = rows;
        rows = data.length;
        rowHeaders = null;
      } else {
        rowHeaders = rows;
        rows = rowHeaders.length;
      }
    } else {
      rowHeaders = null;
    }
    const thead = createElementArray('THEAD', 'TR', 1, function (tr) {
      tr.setAttribute('class', 'header');
      createElementArray(tr, 'TH', 1, function(th) {
        const div = createElement('DIV', {
          style: 'width:0;height:0;overflow:hidden;position:fixed;top:-99px;left:-99px;'
        });
        hiddenTextarea = createElement('TEXTAREA', { tabindex: '-1' });
        div.appendChild(hiddenTextarea);
        th.onclick = refocus;
        th.appendChild(div);
      });
      createElementArray(tr, 'TH', headers, function (e, x) {
        e.textContent = x;
        e.onclick = refocus;
      });
    });
    createElementArray(thead, 'TR', 1, function(tr) {
      tr.setAttribute('class', 'subheader');
      createElementArray(tr, 'TH', 1);
      createElementArray(tr, 'TD', headers.length, function(td) {
        createElementArray(td, 'SELECT', 1);
      });
    });
    const tbody = createElementArray('TBODY', 'TR', rows, function (tr, i) {
      const rowData = data[i];
      const row = rowData? rowData : [];
      createElementArray(tr, 'TH', 1);
      createElementArray(tr, 'TD', headers.length, function (td, j) {
        if (j < row.length) {
          setCellContent(td, i, j, row[j]);
        }
        if (i === 0 && j === 0) {
          td.setAttribute('class', 'anchor');
        }
      });
    });
    const oldTHeads = table.getElementsByTagName('THEAD');
    if (oldTHeads.length === 0) {
      table.appendChild(thead);
    } else {
      table.replaceChild(thead, oldTHeads[0]);
    }
    const oldTBodies = table.getElementsByTagName('TBODY');
    if (oldTBodies.length === 0) {
      table.appendChild(tbody);
    } else {
      table.replaceChild(tbody, oldTBodies[0]);
    }
    if (typeof(subheaderSpecs) === 'undefined' || !subheaderSpecs) {
      hideSubheaders();
    } else {
      setSubheaders(subheaderSpecs, subheaderDefaults);
    }
    anchorRow = 0;
    selectionRow = 0;
    anchorColumn = 0;
    selectionColumn = 0;
    rowCount = rows;
    columnCount = headers.length;
    undo.clearUndo();
    setCellMouseHandlers(0);
    refocus();
  }

  function removeContextMenu(menu) {
    if (menu.parentNode) {
      try {
        menu.parentNode.removeChild(menu);
      } catch(e) {
      }
    }
    contextMenu = null;
    refocus();
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
    const box = createElement('INPUT', { size: maxLength - 2 });
    const cell = getCell(r, c);
    const text = cell.textContent;
    box.value = text;
    cell.textContent = '';
    cell.appendChild(box);
    commitEdit = function () { return doCommitEdit(r, c, box, text); }
    box.onkeydown = handleInputKey;
    box.onblur = function () {
      undo.undoable(commitEdit(r, c, box, text));
      refocus();
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

  function extendRows(rows) {
    if (rowHeaders) {
      return 0;
    }
    const nr = rows - rowCount;
    if (nr <= 0) {
      return 0;
    }
    insertRows(rowCount, nr);
    return nr;
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
    if (rowCount <= anchorRow) {
      anchorRow = rowCount - 1;
      setSelection(anchorRow, anchorColumn, selectionRow, selectionColumn);
    }
    setCellMouseHandlers(r);
    return function () {
      const inverse = insertRows(r, count);
      putCells(r, r + count, 0, columnCount, values);
      return inverse;
    };
  }

  function insertColumns(c, count) {
    undo.undoable(commitEdit());
    const hrow = getHeaderTr();
    const shrow = getSubheaderTr();
    let thFn;
    let thFnS;
    if (c < columnCount) {
      const b = hrow.childNodes[c + 1];
      const bs = shrow.childNodes[c + 1];
      thFn = function(child) { hrow.insertBefore(child, b); };
      thFnS = function(child) { shrow.insertBefore(child, bs); };
    } else {
      thFn = function (child) { hrow.appendChild(child); };
      thFnS = function (child) { shrow.appendChild(child); };
    }
    for (let i = 0; i < count; ++i) {
      thFn(document.createElement('TH'));
      thFnS(document.createElement('TD'));
    }
    for (let r = 0; r !== rowCount; ++r) {
      const row = getRow(r);
      if (c === columnCount) {
        for (let i = 0; i < count; ++i) {
          row.appendChild(document.createElement('TD'));
        }
      } else {
        const b = row.childNodes[c+1];
        for (let i = 0; i < count; ++i) {
          row.insertBefore(document.createElement('TD'), b);
        }
      }
    }
    columnCount += count;
    let selectionEndsMoved = 0;
    if (c <= anchorColumn) {
      selectionEndsMoved += 1;
      anchorColumn += count;
    }
    if (c <= selectionColumn) {
      selectionEndsMoved += 1;
      selectionColumn += count;
    }
    setCellMouseHandlers(0);
    if (selectionEndsMoved === 1) {
      const r0 = Math.min(selectionRow, anchorRow);
      const r1 = Math.max(selectionRow, anchorRow) + 1;
      forEachRow(r0, r1, row => {
        forEachColumn(row, c, c + count, cell => {
          cell.classList.add('selected');
        });
      });
    }
    setFlexibleHeaderNames(c);
    return function () {
      return deleteColumns(c, count);
    };
  }

  function deleteColumns(c, count) {
    undo.undoable(commitEdit());
    const values = getCells(0, rowCount, c, c + count);
    const hrow = getHeaderTr();
    const shrow = getSubheaderTr();
    for (let i = 0; i !== count; ++i) {
      hrow.removeChild(hrow.childNodes[c + 1]);
      shrow.removeChild(shrow.childNodes[c + 1]);
    }
    for (let r = 0; r !== rowCount; ++r) {
      const row = getRow(r);
      for (let i = 0; i < count; ++i) {
        row.removeChild(row.childNodes[c + 1]);
      }
    }
    columnCount -= count;
    if (c < anchorColumn) {
      if (c + count < anchorColumn) {
        anchorColumn -= count;
      } else {
        anchorColumn = c;
      }
    }
    if (c < selectionColumn) {
      if (c + count < selectionColumn) {
        selectionColumn -= count;
      } else {
        selectionColumn = c;
      }
    }
    if (columnCount <= selectionColumn) {
      selectionColumn = columnCount - 1;
    }
    if (columnCount <= anchorColumn) {
      anchorColumn = columnCount - 1;
      setSelection(anchorRow, anchorColumn, selectionRow, selectionColumn);
    }
    setCellMouseHandlers(0);
    setFlexibleHeaderNames(c);
    return function () {
      const inverse = insertColumns(c, count);
      putCells(0, rowCount, c, c + count, values);
      return inverse;
    };
  }

  function setFlexibleHeaderNames(c) {
    const hrow = getHeaderTr();
    for (let i = c; i < columnCount; ++i) {
      hrow.childNodes[i + 1].textContent = flexibleColumnName(i);
    }
  }

  function getHeaderTr() {
    const thead = table.getElementsByTagName('THEAD')[0];
    return thead.getElementsByTagName('TR')[0];
  }

  function getSubheaderTr() {
    const thead = table.getElementsByTagName('THEAD')[0];
    return thead.getElementsByTagName('TR')[1];
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

  function selectAll() {
    setSelection(0, 0, rowCount - 1, columnCount - 1);
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
      if (rowHeaders) {
        doGoToCell(anchorRow, returnColumn);
        return;
      }
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

  function addOption(menu, id, callback, text, disabled) {
    const attrs = { value: id };
    if (disabled) {
      attrs.disabled = true;
    }
    const e = createElement('OPTION', attrs);
    e.textContent = text;
    e.onclick = callback;
    menu.appendChild(e);
  }

  function addRowsOptions(menu, firstRow, count) {
    addOption(menu, 'delete', function() {
      undo.undoable(deleteRows(firstRow, count));
      removeContextMenu(menu);
    }, localizedText.deleteRow, count === rowCount);
    addOption(menu, 'add-before', function() {
      undo.undoable(insertRows(firstRow, count));
      removeContextMenu(menu);
    }, localizedText.addRowBefore);
    addOption(menu, 'add-after', function() {
      undo.undoable(insertRows(firstRow + count, count));
      removeContextMenu(menu);
    }, localizedText.addRowAfter);
  }

  function addColumnsOptions(menu, firstColumn, count) {
    addOption(menu, 'column-delete', function() {
      undo.undoable(deleteColumns(firstColumn, count));
      removeContextMenu(menu);
    }, localizedText.deleteColumn, count === columnCount);
    addOption(menu, 'column-add-before', function() {
      undo.undoable(insertColumns(firstColumn, count));
      removeContextMenu(menu);
    }, localizedText.addColumnBefore);
    addOption(menu, 'column-add-after', function() {
      undo.undoable(insertColumns(firstColumn + count, count));
      removeContextMenu(menu);
    }, localizedText.addColumnAfter);
  }

  function addClipboardOptions(menu) {
    const cb = window.navigator.clipboard;
    addOption(menu, 'cut', function() {
      if (cb && cb.writeText) {
        cb.writeText(copySelection()).then(clearSelection);
      } else {
        document.execCommand('cut');
      }
      removeContextMenu(menu);
      refocus();
    }, localizedText.cut);
    addOption(menu, 'copy', function() {
      if (cb && cb.writeText) {
        cb.writeText(copySelection());
      } else {
        document.execCommand('copy');
      }
      removeContextMenu(menu);
      refocus();
    }, localizedText.copy);
  }

  function emptyContextMenu(size) {
    return createElement('SELECT', {
      id: table.getAttribute('id').concat('-context-menu'),
      size: size
    });
  }

  function rowHeaderMenu(ev, r) {
    let r1 = Math.min(anchorRow, selectionRow);
    let rc = Math.abs(selectionRow - anchorRow) + 1;
    if (r < r1 || r1 + rc <= r) {
      r1 = r;
      rc = 1;
      setSelection(r, 0, r, columnCount - 1);
    }
    const menu = emptyContextMenu(rowHeaders? 2 : 5);
    if (!rowHeaders) {
      addRowsOptions(menu, r1, rc);
    }
    addClipboardOptions(menu);
    attachContextMenu(ev, menu);
    return menu;
  }

  function columnHeaderMenu(ev, c) {
    const menu = emptyContextMenu(columnsAreFlexible? 5 : 2);
    if (columnsAreFlexible) {
      let c1 = Math.min(anchorColumn, selectionColumn);
      let cc = Math.abs(selectionColumn - anchorColumn) + 1;
      if (c < c1 || c1 + cc <= c) {
        c1 = c;
        cc = 1;
        setSelection(0, c, rowCount - 1, c);
      }
      addColumnsOptions(menu, c1, cc);
    }
    addClipboardOptions(menu);
    attachContextMenu(ev, menu);
    return menu;
  }

  function cellContextMenu(ev, r, c) {
    let r1 = Math.min(anchorRow, selectionRow);
    let rc = Math.abs(selectionRow - anchorRow) + 1;
    let c1 = Math.min(anchorColumn, selectionColumn);
    let cc = Math.abs(selectionColumn - anchorColumn) + 1;
    if (r < r1 || r1 + rc <= r || c < c1 || c1 + cc <= c) {
      r1 = r;
      rc = 1;
      c1 = c;
      cc = 1;
      setSelection(r, c, r, c);
    }
    let menuItemsCount = 2;
    if (columnsAreFlexible) {
      menuItemsCount += 3
    }
    if (!rowHeaders) {
      menuItemsCount += 3;
    }
    const menu = emptyContextMenu(menuItemsCount);
    if (!rowHeaders) {
      addRowsOptions(menu, r1, rc);
    }
    if (columnsAreFlexible) {
      addColumnsOptions(menu, c1, cc);
    }
    addClipboardOptions(menu);
    attachContextMenu(ev, menu);
    return menu;
  }

  function tableHeaderMenu(ev) {
    const menu = emptyContextMenu(2);
    addClipboardOptions(menu);
    attachContextMenu(ev, menu);
    return menu;
  }

  // get mouse co-ordinates relative to the table's nearest non-static ancestor
  function getMouseCoordinates(ev) {
    for(let e = table; e; e = e.parentElement) {
      const s = window.getComputedStyle(e).getPropertyValue('position');
      if (s !== 'static') {
        const r = e.getBoundingClientRect(e);
        return {
          x: ev.clientX - r.left + e.scrollLeft,
          y: ev.clientY - r.top + e.scrollTop
        };
      }
    }
    return { x: ev.pageX, y: ev.pageY };
  }

  function attachContextMenu(ev, menu) {
    const mousePosition = getMouseCoordinates(ev);
    menu.style.position = 'absolute';
    menu.style.left = mousePosition.x + 'px';
    menu.style.top = mousePosition.y + 'px';
    menu.tabIndex = -1;
    menu.zIndex = 10;
    menu.onblur = function () { removeContextMenu(menu); };
    menu.contentEditable = false;
    if (contextMenu) {
      removeContextMenu(contextMenu);
    }
    contextMenu = menu;
    table.appendChild(menu);
    menu.focus();
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
    for (let i = 0; i < cEnd; ++i) {
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
    const chr = getColumnHeaderRow();
    if (chr.length) {
      const h = chr[0];
      h.onmousedown = function() {
        setSelection(0, 0, rowCount - 1, columnCount - 1);
        refocus();
      };
      h.oncontextmenu = function(ev) {
        ev = getEvent(ev);
        tableHeaderMenu(ev).focus();
        return preventDefault(ev);
      };
    }
    for (let i = 1; i < chr.length; ++i) {
      const thisColumn = i - 1;
      const h = chr[i];
      const c = i - 1;
      h.onmousedown = function(ev) {
        if (ev.button === 0) {
          undo.undoable(commitEdit());
          setSelection(0, c, rowCount - 1, c);
          refocus();
          ev.preventDefault();
        }
      };
      h.onmouseenter = function(ev) {
        ev = getEvent(ev);
        // stretch selection over this row
        if (selecting && (ev.buttons & 1)) {
          const r = anchorRow === 0 ? rowCount - 1 : 0;
          setSelection(anchorRow, anchorColumn, r, thisColumn);
          scrollToCell(r, thisColumn, anchorRow, anchorColumn);
          refocus();
          return preventDefault(ev);
        }
      };
      h.oncontextmenu = function(ev) {
        ev = getEvent(ev);
        columnHeaderMenu(ev, thisColumn).focus();
        return preventDefault(ev);
      };
    }
    forEachRow(firstRow, rowCount, function (row, i, thisRow) {
      const headers = row.getElementsByTagName('TH');
      if (0 < headers.length) {
        const rh = headers[0];
        rh.textContent = rowHeaders? rowHeaders[thisRow] : thisRow + 1;
        rh.onmousedown = function(ev) {
          ev = getEvent(ev);
          if (ev.button === 0) {
            setSelection(thisRow, 0, thisRow, columnCount - 1);
            refocus();
            ev.preventDefault();
          }
        };
        rh.onmouseenter = function (ev) {
          ev = getEvent(ev);
          // stretch selection over this row
          if (selecting && (ev.buttons & 1)) {
            const c = anchorColumn === 0 ? columnCount - 1 : 0;
            setSelection(anchorRow, anchorColumn, thisRow, c);
            scrollToCell(thisRow, c, anchorRow, anchorColumn);
            refocus();
            return preventDefault(ev);
          }
        };
        rh.oncontextmenu = function (ev) {
          ev = getEvent(ev);
          rowHeaderMenu(ev, thisRow).focus();
          return preventDefault(ev);
        };
        forEachColumn(row, 0, columnCount, function (cell, j, thisColumn) {
          cell.onclick = function () {
            goToCell(thisRow, thisColumn);
          };
          cell.onmouseenter = function (ev) {
            ev = getEvent(ev);
            // stretch selection over this cell
            if (selecting && (ev.buttons & 1)) {
              setSelection(anchorRow, anchorColumn, thisRow, thisColumn);
              scrollToCell(thisRow, thisColumn, anchorRow, anchorColumn);
              refocus();
              return preventDefault(ev);
            }
          };
          cell.onmousedown = function (ev) {
            ev = getEvent(ev);
            // set anchor and selection to this cell
            if (ev.button === 0) {
              undo.undoable(commitEdit());
              setSelection(thisRow, thisColumn, thisRow, thisColumn);
              refocus();
              ev.preventDefault();
            }
          };
          cell.oncontextmenu = function (ev) {
            ev = getEvent(ev);
            cellContextMenu(ev, thisRow, thisColumn).focus();
            return preventDefault(ev);
          };
        });
      }
    });
  }

  function getCellContents(cell) {
    const inputs = cell.getElementsByTagName('INPUT');
    if (0 < inputs.length) {
      return inputs[0].value;
    }
    return cell.textContent;
  }

  function withDefault(a, def) {
    return typeof (a) === 'undefined' ? def : a;
  }

  function getCells(rowStart, rowEnd, columnStart, columnEnd) {
    let vss = [];
    forEachRow(withDefault(rowStart, 0),
      withDefault(rowEnd, rowCount), function (row) {
      let vs = [];
          forEachColumn(row, withDefault(columnStart, 0),
            withDefault(columnEnd, columnCount), function (cell) {
        vs.push(getCellContents(cell));
      });
      vss.push(vs);
    });
    return vss;
  }

  function setCellContent(cell, row, column, value) {
    cell.textContent = value;
    if (!formattingFunction) {
      return;
    }
    var r = formattingFunction(row, column, value);
    if (!r) {
      return ;
    }
    if ('error' in r) {
      if (r.error) {
        cell.classList.add('error');
      } else {
        cell.classList.remove('error');
      }
    }
    if ('tooltip' in r) {
      if (r.tooltip) {
        cell.setAttribute('title', r.tooltip);
      } else {
        cell.removeAttribute('title');
      }
    }
  }

  function putCells(rowStart, rowEnd, columnStart, columnEnd, values) {
    forEachRow(rowStart, rowEnd, function (row, i) {
      var vr = values[i];
      forEachColumn(row, columnStart, columnEnd, function (cell, j) {
        var t = typeof (vr) === 'undefined' ? '' : vr[j];
        setCellContent(cell, rowStart + i, columnStart + j, t);
      });
    });
  }

  // an 'action' is a function that returns its inverse (which is also an action
  // and so returns a function that is the equivalent of the original action)
  function putCellsAction(rowStart, rowEnd, columnStart, columnEnd, values) {
    const oldValues = getCells(rowStart, rowEnd, columnStart, columnEnd);
    putCells(rowStart, rowEnd, columnStart, columnEnd, values);
    setSelection(rowStart, columnStart, rowEnd - 1, columnEnd - 1);
    return function () { return putCellsAction(rowStart, rowEnd, columnStart, columnEnd, oldValues); };
  }

  function setColumnAndSubheaderAction(columnIndex, oldValue, newValue, oldColumn, newColumn) {
    if (newColumn) {
      forEachRow(0, rowCount, function(row, i) {
        forEachColumn(row, columnIndex, columnIndex+1, function(cell) {
          setCellContent(cell, i, columnIndex, newColumn[i]);
        });
      });
    }
    const tds = getSubheaderTr().getElementsByTagName('TD');
    if (columnIndex < tds.length) {
      const selects = tds[columnIndex].getElementsByTagName('SELECT');
      if (selects.length !== 0) {
        selects[0].value = newValue;
        selects[0].oldValue = newValue; // not oldValue!
      }
    }
    return function() {
      return setColumnAndSubheaderAction(
        columnIndex, newValue, oldValue, newColumn, oldColumn
      );
    };
  }

  function doUndo() {
    undo.undoable(commitEdit());
    undo.undo();
    refocus();
  }

  function doRedo() {
    commitEdit();
    undo.redo();
    refocus();
  }

  function clearCells(startRow, endRow, startColumn, endColumn) {
    let row = [];
    for (let i = startColumn; i !== endColumn; ++i) {
      row.push('');
    }
    let empties = [];
    for (let j = startRow; j !== endRow; ++j) {
      empties.push(row);
    }
    undo.undoable(putCellsAction(startRow, endRow, startColumn, endColumn, empties));
  }

  function clearSelection() {
    const firstRow = Math.min(anchorRow, selectionRow);
    const lastRow = Math.max(anchorRow, selectionRow) + 1;
    const firstColumn = Math.min(anchorColumn, selectionColumn);
    const lastColumn = Math.max(anchorColumn, selectionColumn) + 1;
    clearCells(firstRow, lastRow, firstColumn, lastColumn);
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
      if (columnCount < lastColumn && columnsAreFlexible) {
        undo.undoable(insertColumns(columnCount, lastColumn - columnCount));
      }
    }
    if (lastRow < firstRow + values.length) {
      lastRow = firstRow + values.length;
      if (rowCount < lastRow && !rowHeaders) {
        undo.undoable(insertRows(rowCount, lastRow - rowCount));
      }
    }
    // fill out extra columns if more are needed to fill the selection
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
      if (31 < cc) {
        inputBox.value = String.fromCharCode(cc);
      }
      return preventDefault(ev);
    }
  }

  function tableCutHandler(ev) {
    ev = getEvent(ev);
    const text = copySelection();
    ev.clipboardData.setData('text/plain', text);
    clearSelection();
    refocus(); // seems necessary on Firefox
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
        console.warn(err);
      }
    }
    refocus(); // seems necessary on Firefox
    return preventDefault(ev);
  }

  function tableKeyDownHandler(ev) {
    ev = getEvent(ev);
    if (contextMenu) {
      if (ev.key === 'Escape') {
        refocus();
      }
      // Select context menu option if enter or space pressed.
      // Surely there must be a better way to do this?
      if (ev.key === 'Enter' || ev.key === ' ') {
        const index = contextMenu.selectedIndex;
        if (0 <= index) {
          const options = contextMenu.getElementsByTagName('OPTION');
          options[index].onclick();
          return preventDefault(ev);
        }
      }
      return;
    }
    // meta key so that Apple users can press meta
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey) {
      // Ctrl-Z for undo
      if (ev.keyCode === 90) {
        if (ev.shiftKey) {
          doRedo();
        } else {
          doUndo();
        }
        return preventDefault(ev);
      }
      // Ctrl-A for select all
      if (ev.keyCode === 65 && !ev.shiftKey) {
        selectAll();
      }
    }
    if (!inputBox && (ev.key === 'Delete' || ev.key === 'Backspace')) {
      clearSelection();
      return preventDefault(ev);
    }
    if (moveSelection(ev) === false) {
      undo.undoable(commitEdit());
      refocus();
      return preventDefault(ev);
    }
    if (moveAnchor(ev) === false) {
      return preventDefault(ev);
    }
  }

  function moveAnchor(ev) {
    if (ev.shiftKey || ev.altKey || ev.metaKey) {
      return;
    }
    const inputNotSelected = inputBox &&
      inputBox.selectionStart === inputBox.selectionEnd;
    const inputAtStart = inputNotSelected && inputBox.selectionStart === 0;
    const inputAtEnd = inputNotSelected && inputBox.selectionStart === inputBox.value.length;
    let dest = null;
    if (ev.key === 'ArrowLeft') {
      if ((!inputBox || inputAtStart) && 0 < anchorColumn) {
        dest = { row: anchorRow, column: anchorColumn - 1 };
      }
    } else if (ev.key === 'ArrowRight') {
      if ((!inputBox || inputAtEnd) && anchorColumn + 1 < columnCount) {
        dest = { row: anchorRow, column: anchorColumn + 1 };
      }
    } else {
      dest = move(ev, anchorRow, anchorColumn);
    }
    if (dest) {
      const change = undo.undoable(commitEdit());
      scrollToCell(dest.row, dest.column, anchorRow, anchorColumn);
      setSelection(dest.row, dest.column, dest.row, dest.column);
      returnColumn = anchorColumn;
      beginEdit();
      return false;
    }
  }

  // returns {row, column} or null if no change
  function move(ev, row, column) {
    const here = {row, column};
    if (ev.key === 'ArrowUp') {
      if (0 < row) {
        return { row: ev.ctrlKey? 0 : row - 1, column };
      }
      return here;
    }
    if (ev.key === 'ArrowDown') {
      if (row + 1 < rowCount) {
        return { row: ev.ctrlKey? rowCount - 1 : row + 1, column };
      }
      return here;
    }
    if (ev.key === 'ArrowLeft') {
      if (0 < column) {
        return { row, column: ev.ctrlKey? 0 : column - 1 };
      }
      return here;
    }
    if (ev.key === 'ArrowRight') {
      if (column + 1 < columnCount) {
        return { row, column: ev.ctrlKey? columnCount - 1 : column + 1 };
      }
      return here;
    }
    if (ev.key === 'Home') {
      return ev.ctrlKey? { row: 0, column: 0 } : { row, column: 0 };
    }
    if (ev.key === 'End') {
      column = columnCount - 1;
      return ev.ctrlKey? { row: rowCount - 1, column } : { row, column };
    }
    if (ev.key === 'PageUp') {
      return { row: Math.max(0, row - rowsVisibleCount()), column };
    }
    if (ev.key === 'PageDown') {
      return { row: Math.min(rowCount - 1, row + rowsVisibleCount()), column };
    }
    return null;
  }

  function rowsVisibleCount() {
    let frameHeight = Math.max(1, window.innerHeight);
    const rowPixels = Math.max(getAnchor().offsetHeight, 1);
    forEachScrollableAncestor(table, noop,
      function(el, rect) {
        frameHeight = Math.min(frameHeight, rect.bottom - rect.top);
      }
    );
    return Math.max(Math.floor(frameHeight  / rowPixels - 1), 2);
  }

  function compare(value, against) {
    return value === against? 0 : value < against? -1 : 1;
  }

  // direction should be 'x' or 'y'
  function isScrollable(element, direction) {
    const style = window.getComputedStyle(element);
    let overflow = style.getPropertyValue('overflow-'.concat(direction));
    if (!overflow) {
      overflow = style.getPropertyValue('overflow');
    }
    return overflow === 'auto' || overflow === 'scroll';
  }

  function getBoundingRect(element) {
    const r = element.getBoundingClientRect();
    const left = r.left + element.clientLeft;
    const top = r.top + element.clientTop;
    return {
      left: left,
      right: left + element.clientWidth,
      top: top,
      bottom: top + element.clientHeight
    };
  }

  function forEachScrollableAncestor(el, xScrollFn, yScrollFn) {
    el = el.parentNode;
    while (el) {
      if (el instanceof HTMLElement) {
        let rect = null;
        if (isScrollable(el, 'x')) {
          if (!rect) {
            rect = getBoundingRect(el);
          }
          xScrollFn(el, rect);
        }
        if (isScrollable(el, 'y')) {
          if (!rect) {
            rect = getBoundingRect(el);
          }
          yScrollFn(el, rect);
        }
      }
      el = el.parentNode;
    }
  }

  function scrollIntoView(el) {
    const eltRect = getBoundingRect(el);
    forEachScrollableAncestor(el,
      function(el, rect) {
        let xScroll = 0;
        if (eltRect.left < rect.left) {
          xScroll = eltRect.left - rect.left;
        } else if (rect.right < eltRect.right) {
          xScroll = eltRect.right - rect.right;
        }
        if (xScroll) {
          el.scrollLeft += xScroll;
          eltRect.left -= xScroll;
          eltRect.right -= xScroll;
        }
      }, function(el, rect) {
        let yScroll = 0;
        if (eltRect.top < rect.top) {
          yScroll = eltRect.top - rect.top;
        } else if (rect.bottom < eltRect.bottom) {
          yScroll = eltRect.bottom - rect.bottom;
        }
        if (yScroll) {
          el.scrollTop += yScroll;
          eltRect.top -= yScroll;
          eltRect.bottom -= yScroll;
        }
      }
    );
  }

  function scrollToCell(toRow, toColumn, fromRow, fromColumn) {
    const cell = getCell(toRow, toColumn);
    const br0 = toRow + compare(toRow, fromRow);
    const br = clampRow(br0);
    const bc0 = toColumn === 0? -1
      : toColumn + compare(toColumn, fromColumn);
    const bc = clampColumn(bc0);
    const cell2 = br0 === -1? getColumnHeaderRow()[bc0 + 1]
      : (bc0 === -1? getRowHeader(br) : getCell(br, bc));
    scrollIntoView(cell2);
    scrollIntoView(cell);
  }

  function moveSelection(ev) {
    if (!ev.shiftKey || ev.altKey || ev.metaKey) {
      return;
    }
    const dest = move(ev, selectionRow, selectionColumn);
    if (dest) {
      setSelection(anchorRow, anchorColumn, dest.row, dest.column);
      scrollToCell(dest.row, dest.column, anchorRow, anchorColumn);
      return false;
    }
  }

  function getColumn(column) {
    let vs = [];
    forEachRow(0, rowCount, function (row) {
      forEachColumn(row, column, column + 1, function (cell) {
        vs.push(getCellContents(cell));
      });
    });
    return vs;
  }

  function clampRow(r) {
    return r < 0 ? 0 : rowCount <= r ? rowCount - 1 : r;
  }

  function clampColumn(c) {
    return c < 0 ? 0 : columnCount <= c ? columnCount - 1 : c;
  }

  function rowsRequiredForColumns(columns) {
    let rowsRequired = 0;
    if (rowHeaders) {
      return rowCount;
    }
    for (let k in columns) {
      rowsRequired = Math.max(rowsRequired, columns[k].length);
    }
    return rowsRequired;
  }

  table.onkeydown = tableKeyDownHandler;
  table.onkeypress = tableKeyPressHandler;
  table.oncut = tableCutHandler;
  table.oncopy = tableCopyHandler;
  table.onpaste = tablePasteHandler;
  table.onmousemove = function (ev) {
    ev = getEvent(ev);
    // prevent default drag-select (but not all propagation)
    if (selecting && (ev.buttons & 1)) {
      ev.preventDefault();
    }
  };
  table.onmousedown = function (ev) {
    ev = getEvent(ev);
    // prevent default drag-select (but not all propagation)
    if (ev.button === 0) {
      selecting = true;
    }
  };
  table.onmouseup = function (ev) {
    selecting = false;
  };
  init(headers, newRowCount);
  refocus();
  table.dataEntryGrid = {
    /**
     * Re-initializes the table.
     * 
     * Any reunitting function is removed.
     * @param {string[]|number} headers Array of strings to become the new
     * column headers, or the number of columns to create for 'flexible columns'
     * (if column addition and deletion is required).
     * @param {string[]|number|Array<Array<string>>} rows Array of strings
     * to become row headers, number of rows the table should now
     * have, or array of rows, each of which is an array of the cells in that row.
     * Any row longer than the headers array is truncated.
     * Rows will be 'flexible' (can be added and deleted) if rows is specified
     * as a number or array of rows.
     * @param {Object[]=} subheaderSpecs List of option specifications (one
     * per column). Each is a map of names to display strings of the options.
     * Not permitted with flexible columns.
     * @param {string[]=} subheaderDefaults List of names that are the initial
     * settings of the subheader selects. Not permitted with flexible columns.
     */
    init: init,
    /**
     * Sets the tooltip for a subheader (if it exists)
     * @param {number} index The index of the column to change
     * @param {string} text The tooltip text
     */
    setSubheaderTooltip: function(index, text) {
      forEachSubheader(function(elt, i) {
        if (i == index) {
          elt.setAttribute('title', text);
        }
      });
    },
    /**
     * Sets the tooltip for an option on a subheader
     * @param {number} index The index of the column to change
     * @param {string} optionName The name of the option to change
     * @param {string} text The tooltip text
     */
    setSubheaderOptionTooltip: function(index, optionName, text) {
      forEachSubheader(function(elt, i) {
        if (i == index) {
          var options = elt.getElementsByTagName('OPTION');
          for (var j in options) {
            var option = options[j];
            if (option.value == optionName) {
              option.setAttribute('title', text);
            }
          }
        }
      });
    },
    /**
     * Adds empty rows to the bottom of the table if necessary, and
     * if the rows do not have specified row headers.
     * @param {number} rows The total number of rows the table should
     * have after the call. If the table already had this many no more will
     * be added and none will be taken away.
     * @returns Count of rows added.
     */
    extendRows: extendRows,
    /**
     * Sets localized text for the row header context table.
     * @param {Object} newText Text of table ids to strings. The ids currently
     * recognized are `cut`, `copy`, `deleteRow`, `addRowBefore`, `addRowAfter`,
     * `deleteColumn`, `addColumnBefore` and `addColumnAfter`.
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
    setButtons: function (undoButton, redoButton) {
      undo.setButtons(undoButton, redoButton, refocus)
    },
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
     * Sets the position and size of the selection.
     * @param {number} anchorRow The row the anchor is in
     * @param {number} anchorColumn The column the anchor is in
     * @param {number} [selectionRow=anchorRow] The other end of the
     * selected rows
     * @param {number} [selectionColumn=anchorColumn] The other end
     * of the selected columns
     */
    setSelection: function (anchorRow, anchorColumn, selectionRow, selectionColumn) {
      setSelection(clampRow(anchorRow), clampColumn(anchorColumn),
        clampRow(withDefault(selectionRow, anchorRow)),
        clampColumn(withDefault(selectionColumn, anchorColumn)));
    },
    /**
     * Sets the selection to be all cells, with the anchor at the
     * top left.
     */
    selectAll: selectAll,
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
     * @returns {string[]} array of strings.
     */
    getColumnHeaders: getColumnHeaders,
    /**
     * Returns the row headers.
     * @returns {string[]} array of strings
     */
    getRowHeaders: getRowHeaders,
    /**
     * Returns selected options in subheaders
     * @returns  {string[]} array of strings
     */
    getSubheaders: getSubheaders,
    /**
     * A function for changing a column in response to a subheader's
     * value changing.
     * @callback reunitter
     * @param {number} columnIndex Which column is being changed
     * @param {string} oldValue The value that the subheader is being changed from
     * @param {string} newValue The value that the subheader is being changed from
     * @param {string[]} columnValues The current values in the column
     * @returns {null|string[]} The new values the column should have, or null
     * if they should be unchanged.
     */
    /**
     * Sets a function to be called whenever a subheader is changed.
     * This function can change the values in the column.
     * @param {reunitter} fn The function to set.
     */
    setReunittingFunction: function (fn) {
      reunittingFunction = fn;
    },
    /**
     * A function for changing a cell's formatting in response to the value
     * changing.
     * @callback formatter
     * @param {number} row The index of the row being set
     * @param {number} column The index of the column being set.
     * @param {string} value The new value.
     * @return {object} An object with two optional keys: a key `error`
     * with a boolean value sets or resets 'error' in the element's class
     * attribute; a key 'tooltip' sets a tooltip for the cell if a string, removes
     * any tooltip if null.
     */
    /**
     * Sets a function to be called whenever a cell value is changed.
     * This function sets the formatting of the cell based on its
     * position and new value. If multiple cells are being set at once,
     * the function will be called for each cell in turn. Reunitting
     * a column will call this for all values in the column with the new
     * values.
     * @param {null|formatter} fn The function to set, or null to remove
     * any formatting function.
     */
    setFormattingFunction: function(fn) {
      formattingFunction = fn;
    },
    /**
     * Moves the anchor (and selection to the same place)
     * @param {number} r row to go to
     * @param {number} c column to go to
     */
    goToCell: goToCell,
    /**
     * Gets the text of the cells requested.
     * @param {number} [rowStart=0] first row (zero-based)
     * @param {number} [rowEnd] one past the last row, defaults to
     * (one past) the last row
     * @param {number} [columnStart=0] first column
     * @param {number} [columnEnd] one past the last column, defaults
     * to (one past) the last column
     * @returns {Array<Array<string>>} The cell contents
     */
    getCells: getCells,
    /**
     * Gets the text of the cells requested.
     * @param {number} rowStart first row (zero-based)
     * @param {number} rowEnd one past the last row
     * @param {number} columnStart first column
     * @param {number} columnEnd one past the last column
     * @param {Array<Array<string>>} values an array of arrays of new cell values.
     */
    putCells: function (rowStart, rowEnd, columnStart, columnEnd, values) {
      undo.undoable(putCellsAction(rowStart, rowEnd, columnStart, columnEnd, values));
    },
    /**
     * Clears all the data, leaving the headers and number of rows
     * untouched. This clearing goes on the undo stack.
     */
    clearData: function () {
      clearCells(0, rowCount, 0, columnCount);
    },
    /**
     * Gets the text of the cells of one column.
     * @param {number} column index of the column to return
     * @returns {string[]} data from that column
     */
    getColumn: getColumn,
    /**
     * Returns an array of all columns.
     * @returns {Array<Array<any>>} All the columns as an array of
     * arrays of cell contents.
     */
    getColumnArray: function() {
      const out = new Array(columnCount);
      for (let i = 0; i !== columnCount; ++i) {
        out[i] = new Array();
      }
      forEachRow(0, rowCount, row => {
        forEachColumn(row, 0, columnCount, (cell, c) => {
          out[c].push(cell.textContent);
        });
      });
      return out;
    },
    /**
     * Returns a map of column headers or indices to columns.
     * @param {Array<any>} [columns=] Which columns to return, either
     * by index or by header (or a mixture). If not supplied, the entire set
     * of cell column headers is used. Any element that is not a column
     * header is ignored.
     * @returns {Map<any, Array<any>} A map of column headers
     * to the column (as an array of cell contents).
     */
    getColumns: function(columns) {
      if (typeof(columns) !== 'object') {
        columns = getColumnHeaders();
      }
      const h2i = columnHeaderToIndexMap();
      const out = {};
      for(let i in columns) {
        const c = columns[i];
        if (typeof(c) === 'number' || c in h2i) {
          out[c] = [];
        }
      }
      forEachRow(0, rowCount, row => {
        const cells = row.getElementsByTagName('TD');
        for(let i in columns) {
          const c = columns[i];
          const index = typeof(c) === 'number'? c : h2i[c];
          const cell = cells[index];
          if (typeof(cell) !== 'undefined') {
            out[c].push(cell.textContent);
          }
        }
      });
      return out;
    },
    /**
     * Sets the contents of the table by column.
     * 
     * You need not set all the columns. If any column in the input array
     * is longer than the number of already existing number of rows,
     * the table will be expanded to fit, unless the table has defined
     * row headers. If any column is shorter, the remaining
     * cells will be cleared. Cleared rows will not be deleted.
     * @param {Map<any, Array<string>>} columns
     * The columns to set. The keys are strings referring to the headers
     * you want to set and each value is an array of column contents to
     * set into that column. Any key that does not refer to any existing
     * header will be ignored: this function cannot be used to add
     * columns to the table!
     */
    setColumns: function(columns) {
      const rowsRequired = rowsRequiredForColumns(columns);
      extendRows(rowsRequired);
      const h2i = columnHeaderToIndexMap();
      forEachRow(0, rowCount, (row, r) => {
        const cells = row.getElementsByTagName('TD');
        for(let k in columns) {
          if (k in h2i) {
            const c = h2i[k];
            const cell = cells[c];
            const column = columns[k];
            const v = column[r];
            const t = typeof(v) === 'undefined'? '' : v;
            setCellContent(cell, r, c, t);
          }
        }
      });
    },
    /**
     * Sets the contents of the table by column.
     * 
     * On return, the table will contain the number of rows
     * equal to the length of the longest column passed.
     * Unset cells are cleared.
     * @param {Array<Array<any>>} columns The columns to set, in order.
     */
     setColumnArray: function(columns) {
      const rowsRequired = rowsRequiredForColumns(columns);
      extendRows(rowsRequired);
      if (rowsRequired < rowCount) {
        deleteRows(rowsRequired, rowCount - rowsRequired);
      }
      forEachRow(0, rowCount, (row, r) => {
        const cells = row.getElementsByTagName('TD');
        for(let k in columns) {
          const column = columns[k];
          const cell = cells[k];
          const v = column[r];
          const t = typeof(v) === 'undefined'? '' : v;
          setCellContent(cell, r, k, t);
        }
      });
      undo.clearUndo();
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
    redo: () => doRedo(),
    /**
     * Nullary function as a callback
     * 
     * @callback nullary
     */
    /**
     * Adds a watcher function that is called every time the content of the
     * table changes (excluding the subheader cells).
     * @param {nullary} watcher The new watcher to add.
     */
    addWatcher: (watcher) => undo.addWatcher(watcher),
    /**
     * Returns the table element.
     * @return {HTMLTableElement}
     */
    getTable: () => table
  };
  return table.dataEntryGrid;
};
