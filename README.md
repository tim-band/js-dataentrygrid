# js-dataentrygrid

Featherweight Excel-like grid for data entry

Build with `npm install .` then `npm run build`.

At the moment, just an HTML proof-of-concept with the following features:

-   Click to edit
-   Navigate with Tab and Return
-   Auto-insert rows at the end
-   Right-click menu with:
    -   delete rows
    -   insert rows
-   Undo and Redo
-   Multiple row and column selections
-   Copy and paste
-   Clearing cells with Delete or Backspace
-   Arrow key (plus Home, End and Page keys) navigation
-   Starting to type forces the input box to open
-   Copy and paste to and from Excel/LibreOffice
-   Shift-arrows to extend selection
-   Multiple row add/delete
-   Localization
-   Useful API
-   Provide undo and redo buttons

but lacking:

-   'Cut' and 'Copy' sometimes grayed out on Chrome's context menu,
    because nothing is selected.
-   Check which browsers it works on
-   Touch screen support

# API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

### Table of Contents

-   [createDataEntryGrid](#createdataentrygrid)
    -   [Parameters](#parameters)
-   [init](#init)
    -   [Parameters](#parameters-1)
-   [setText](#settext)
    -   [Parameters](#parameters-2)
-   [setButtons](#setbuttons)
    -   [Parameters](#parameters-3)
-   [getSelection](#getselection)
-   [rowCount](#rowcount)
-   [columnCount](#columncount)
-   [getColumnHeaders](#getcolumnheaders)
-   [goToCell](#gotocell)
-   [getCells](#getcells)
    -   [Parameters](#parameters-4)
-   [putCells](#putcells)
    -   [Parameters](#parameters-5)
-   [clearUndo](#clearundo)
-   [undo](#undo)
-   [redo](#redo)

## createDataEntryGrid

Initialize an HTML table to be a data entry grid.

### Parameters

-   `containerId` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** id of the `table` element you want to make interactive
-   `headers` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** array of strings to become the new column headers
-   `newRowCount` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** number of rows the table should now have

Returns **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** The table object.

## init

Re-initialize the table.

### Parameters

-   `headers` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Array of strings to become the new column headers
-   `newRowCount` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** Number of rows the table should now have

## setText

Sets localized text for the row header context table.

### Parameters

-   `newText` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Text of table ids to strings. The ids currently
    recognized are `deleteRow`, `addRowBefore` and `addRowAfter`.

## setButtons

Sets existing buttons on the page to be functional undo and redo
buttons, including becoming disabled when the appropriate stack
is exhausted.

### Parameters

-   `undoButton` **[HTMLButtonElement](https://developer.mozilla.org/docs/Web/API/HTMLButtonElement)** Button to set as undo
    button (or null)
-   `redoButton` **[HTMLButtonElement](https://developer.mozilla.org/docs/Web/API/HTMLButtonElement)** Button to set as redo
    button (or null)

## getSelection

Gets the position and size of the selection.

Returns **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** the position of the selection given by the
following keys: `anchorRow`, `anchorColumn`, `selectionRow`,
`selectionColumn`.

## rowCount

Returns the number of rows.

Returns **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** of rows in the table

## columnCount

Returns the number of columns.

Returns **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** of columns in the table

## getColumnHeaders

Returns the column headers.

Returns **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** array of strings.

## goToCell

Moves the anchor (and selection to the same place)

## getCells

Gets the text of the cells requested.

### Parameters

-   `rowStart` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** first row (zero-based)
-   `rowEnd` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** one past the last row
-   `columnStart` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** first column
-   `columnEnd` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** one past the last column

Returns **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Array of rows, each of which is an array
of strings, the contents of each cell.

## putCells

Gets the text of the cells requested.

### Parameters

-   `rowStart` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** first row (zero-based)
-   `rowEnd` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** one past the last row
-   `columnStart` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** first column
-   `columnEnd` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** one past the last column
-   `values` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Array of rows, each of which is an array
    of strings, the contents of each cell.

## clearUndo

Clear the undo and redo stacks.

## undo

Undoes the last action done or redone.

## redo

Redoes the last undone action.
