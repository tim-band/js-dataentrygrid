# js-dataentrygrid

Featherweight Excel-like grid for data entry

Build with `npm install .` then `npm run build`, and `npm run docs` if
you want to build the documentation. Run tests with `npm run test`
or `npm run test-firefox`. You can run just one test by adding
`-- --fgrep "test title"`. Update the `README.md` documentation
with `npm run docs`.

Has the following features:

*   Click to edit
*   Navigate with Tab and Return
*   Auto-insert rows at the end
*   Right-click menu with:
    *   delete rows
    *   insert rows
*   Undo and Redo
*   Multiple row and column selections
*   Copy and paste
*   Clearing cells with Delete or Backspace
*   Arrow key (plus Home, End and Page keys) navigation
*   Starting to type forces the input box to open
*   Copy and paste to and from Excel/LibreOffice
*   Shift-arrows to extend selection
*   Multiple row add/delete
*   Localization
*   Useful API
*   Provide undo and redo buttons
*   Row/Column/Table header click to select
*   Unfixed headers (so columns can be added and deleted, headers
    are A,B,C...)
*   Unit switchers in subheaders

but lacking:

*   Accessibility testing
*   Touch screen support?

## Changes

### v2.3

New computed formatting function `setFormattingFunction`.

### v2.2

*   New subheader tooltip functions:
    *   `setSubheaderTooltip`
    *   `setSubheaderOptionTooltip`
*   `getRowHeaders` function

### v2.1

*   New data-by-column functions:
    *   `getColumnArray`
    *   `getColumns`
    *   `setColumnArray`
    *   `setColumns`
*   New 'Rigid Rows' functionality: pass an array of strings as the `rows`
    argument to `init` to make the row headers names after the strings
    passed and to prevent the user from adding or deleting rows.

### v2.0

*   Removal of function `getColumnSubheader`. You should no longer
    fill in subheader cells yourself.
*   `init` gains two new arguments: `subheaderSpecs` and `subheaderDefaults`.
*   Addition of function `getSubheaders`.
*   Addition of function `setReunittingFunction`.

## API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

#### Table of Contents

*   [createDataEntryGrid](#createdataentrygrid)
    *   [Parameters](#parameters)
*   [init](#init)
    *   [Parameters](#parameters-1)
*   [setSubheaderTooltip](#setsubheadertooltip)
    *   [Parameters](#parameters-2)
*   [setSubheaderOptionTooltip](#setsubheaderoptiontooltip)
    *   [Parameters](#parameters-3)
*   [extendRows](#extendrows)
    *   [Parameters](#parameters-4)
*   [setText](#settext)
    *   [Parameters](#parameters-5)
*   [setButtons](#setbuttons)
    *   [Parameters](#parameters-6)
*   [getSelection](#getselection)
*   [setSelection](#setselection)
    *   [Parameters](#parameters-7)
*   [selectAll](#selectall)
*   [rowCount](#rowcount)
*   [columnCount](#columncount)
*   [getColumnHeaders](#getcolumnheaders)
*   [getRowHeaders](#getrowheaders)
*   [getSubheaders](#getsubheaders)
*   [setReunittingFunction](#setreunittingfunction)
    *   [Parameters](#parameters-8)
*   [setFormattingFunction](#setformattingfunction)
    *   [Parameters](#parameters-9)
*   [goToCell](#gotocell)
    *   [Parameters](#parameters-10)
*   [getCells](#getcells)
    *   [Parameters](#parameters-11)
*   [putCells](#putcells)
    *   [Parameters](#parameters-12)
*   [clearData](#cleardata)
*   [getColumn](#getcolumn)
    *   [Parameters](#parameters-13)
*   [getColumnArray](#getcolumnarray)
*   [getColumns](#getcolumns)
    *   [Parameters](#parameters-14)
*   [setColumns](#setcolumns)
    *   [Parameters](#parameters-15)
*   [setColumnArray](#setcolumnarray)
    *   [Parameters](#parameters-16)
*   [clearUndo](#clearundo)
*   [undo](#undo)
*   [redo](#redo)
*   [addWatcher](#addwatcher)
    *   [Parameters](#parameters-17)
*   [getTable](#gettable)
*   [reunitter](#reunitter)
    *   [Parameters](#parameters-18)
*   [formatter](#formatter)
    *   [Parameters](#parameters-19)
*   [nullary](#nullary)

### createDataEntryGrid

Initialize an HTML table to be a data entry grid.

The HTML table made interactive will gain a `dataEntryGrid`
member referring to the table object returned.

#### Parameters

*   `containerId` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** id of the `table` element you want to make interactive
*   `headers` **([Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)> | [number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number))** array of strings to become the new column headers
    or the number of columns to be created. If a number is given, the columns will be
    named 'A', 'B', 'C' and so on, and the set of columns will be able to be added and
    deleted. If an array of strings is given, the columns will be fixed.
*   `newRowCount` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** number of rows the table should now have

Returns **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** The table object.

### init

Re-initializes the table.

Any reunitting function is removed.

#### Parameters

*   `headers` **([Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)> | [number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number))** Array of strings to become the new
    column headers, or the number of columns to create for 'flexible columns'
    (if column addition and deletion is required).
*   `rows` **([Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)> | [number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) | [Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>>)** Array of strings
    to become row headers, number of rows the table should now
    have, or array of rows, each of which is an array of the cells in that row.
    Any row longer than the headers array is truncated.
    Rows will be 'flexible' (can be added and deleted) if rows is specified
    as a number or array of rows.
*   `subheaderSpecs` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)>?** List of option specifications (one
    per column). Each is a map of names to display strings of the options.
    Not permitted with flexible columns.
*   `subheaderDefaults` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>?** List of names that are the initial
    settings of the subheader selects. Not permitted with flexible columns.

### setSubheaderTooltip

Sets the tooltip for a subheader (if it exists)

#### Parameters

*   `index` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The index of the column to change
*   `text` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** The tooltip text

### setSubheaderOptionTooltip

Sets the tooltip for an option on a subheader

#### Parameters

*   `index` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The index of the column to change
*   `optionName` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** The name of the option to change
*   `text` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** The tooltip text

### extendRows

Adds empty rows to the bottom of the table if necessary, and
if the rows do not have specified row headers.

#### Parameters

*   `rows` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The total number of rows the table should
    have after the call. If the table already had this many no more will
    be added and none will be taken away.

Returns **any** Count of rows added.

### setText

Sets localized text for the row header context table.

#### Parameters

*   `newText` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Text of table ids to strings. The ids currently
    recognized are `cut`, `copy`, `deleteRow`, `addRowBefore`, `addRowAfter`,
    `deleteColumn`, `addColumnBefore` and `addColumnAfter`.

### setButtons

Sets existing buttons on the page to be functional undo and redo
buttons, including becoming disabled when the appropriate stack
is exhausted.

#### Parameters

*   `undoButton` **[HTMLButtonElement](https://developer.mozilla.org/docs/Web/API/HTMLButtonElement)** Button to set as undo
    button (or null)
*   `redoButton` **[HTMLButtonElement](https://developer.mozilla.org/docs/Web/API/HTMLButtonElement)** Button to set as redo
    button (or null)

### getSelection

Gets the position and size of the selection.

Returns **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** the position of the selection given by the
following keys: `anchorRow`, `anchorColumn`, `selectionRow`,
`selectionColumn`.

### setSelection

Sets the position and size of the selection.

#### Parameters

*   `anchorRow` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The row the anchor is in
*   `anchorColumn` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The column the anchor is in
*   `selectionRow` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The other end of the
    selected rows (optional, default `anchorRow`)
*   `selectionColumn` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The other end
    of the selected columns (optional, default `anchorColumn`)

### selectAll

Sets the selection to be all cells, with the anchor at the
top left.

### rowCount

Returns the number of rows.

Returns **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** of rows in the table

### columnCount

Returns the number of columns.

Returns **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** of columns in the table

### getColumnHeaders

Returns the column headers.

Returns **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>** array of strings.

### getRowHeaders

Returns the row headers.

Returns **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>** array of strings

### getSubheaders

Returns selected options in subheaders

Returns **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>** array of strings

### setReunittingFunction

Sets a function to be called whenever a subheader is changed.
This function can change the values in the column.

#### Parameters

*   `fn` **[reunitter](#reunitter)** The function to set.

### setFormattingFunction

Sets a function to be called whenever a cell value is changed.
This function sets the formatting of the cell based on its
position and new value. If multiple cells are being set at once,
the function will be called for each cell in turn. Reunitting
a column will call this for all values in the column with the new
values.

#### Parameters

*   `fn` **(null | [formatter](#formatter))** The function to set, or null to remove
    any formatting function.

### goToCell

Moves the anchor (and selection to the same place)

#### Parameters

*   `r` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** row to go to
*   `c` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** column to go to

### getCells

Gets the text of the cells requested.

#### Parameters

*   `rowStart` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** first row (zero-based) (optional, default `0`)
*   `rowEnd` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)?** one past the last row, defaults to
    (one past) the last row
*   `columnStart` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** first column (optional, default `0`)
*   `columnEnd` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)?** one past the last column, defaults
    to (one past) the last column

Returns **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>>** The cell contents

### putCells

Gets the text of the cells requested.

#### Parameters

*   `rowStart` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** first row (zero-based)
*   `rowEnd` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** one past the last row
*   `columnStart` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** first column
*   `columnEnd` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** one past the last column
*   `values` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>>** an array of arrays of new cell values.

### clearData

Clears all the data, leaving the headers and number of rows
untouched. This clearing goes on the undo stack.

### getColumn

Gets the text of the cells of one column.

#### Parameters

*   `column` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** index of the column to return

Returns **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>** data from that column

### getColumnArray

Returns an array of all columns.

Returns **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)\<any>>** All the columns as an array of
arrays of cell contents.

### getColumns

Returns a map of column headers or indices to columns.

#### Parameters

*   `columns` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)\<any>?** Which columns to return, either
    by index or by header (or a mixture). If not supplied, the entire set
    of cell column headers is used. Any element that is not a column
    header is ignored.

### setColumns

Sets the contents of the table by column.

You need not set all the columns. If any column in the input array
is longer than the number of already existing number of rows,
the table will be expanded to fit, unless the table has defined
row headers. If any column is shorter, the remaining
cells will be cleared. Cleared rows will not be deleted.

#### Parameters

*   `columns` **[Map](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map)\<any, [Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>>** The columns to set. The keys are strings referring to the headers
    you want to set and each value is an array of column contents to
    set into that column. Any key that does not refer to any existing
    header will be ignored: this function cannot be used to add
    columns to the table!

### setColumnArray

Sets the contents of the table by column.

On return, the table will contain the number of rows
equal to the length of the longest column passed.
Unset cells are cleared.

#### Parameters

*   `columns` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)\<any>>** The columns to set, in order.

### clearUndo

Clear the undo and redo stacks.

### undo

Undoes the last action done or redone.

### redo

Redoes the last undone action.

### addWatcher

Adds a watcher function that is called every time the content of the
table changes (excluding the subheader cells).

#### Parameters

*   `watcher` **[nullary](#nullary)** The new watcher to add.

### getTable

Returns the table element.

Returns **[HTMLTableElement](https://developer.mozilla.org/docs/Web/API/HTMLTableElement)**&#x20;

### reunitter

A function for changing a column in response to a subheader's
value changing.

Type: [Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)

#### Parameters

*   `columnIndex` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** Which column is being changed
*   `oldValue` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** The value that the subheader is being changed from
*   `newValue` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** The value that the subheader is being changed from
*   `columnValues` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>** The current values in the column

Returns **(null | [Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>)** The new values the column should have, or null
if they should be unchanged.

### formatter

A function for changing a cell's formatting in response to the value
changing.

Type: [Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)

#### Parameters

*   `row` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The index of the row being set
*   `column` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The index of the column being set.
*   `value` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** The new value.

Returns **[object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** An object with two optional keys: a key `error`
with a boolean value sets or resets 'error' in the element's class
attribute; a key 'tooltip' sets a tooltip for the cell if a string, removes
any tooltip if null.

### nullary

Nullary function as a callback

Type: [Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)

## createDataEntryGrid

Initialize an HTML table to be a data entry grid.

### Parameters

*   `containerId` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** id of the `table` element you want to make interactive
*   `headers` **([Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)> | [number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number))** array of strings to become the new column headers
    or the number of columns to be created. If a number is given, the columns will be
    named 'A', 'B', 'C' and so on, and the set of columns will be able to be added and
    deleted. If an array of strings is given, the columns will be fixed.
*   `newRowCount` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** number of rows the table should now have

Returns **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** The table object.

## init

Re-initializes the table.

### Parameters

*   `headers` **([Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)> | [number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number))** Array of strings to become the new
    column headers, or the number of columns to create if column addition
    and deletion is required.
*   `rows` **([number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) | [Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>>)** Number of rows the table should now
    have, or array of rows, each of which is an array of the cells in that row.
    Any row longer than the headers array is truncated.
*   `subheaderSpecs` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)>?** List of option specifications (one
    per column). Each is a map of names to display strings of the options.
*   `subheaderDefaults` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>?** List of names that are the initial
    settings of the subheader selects.

## extendRows

Adds empty rows to the bottom of the table if necessary.

### Parameters

*   `rows` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The total number of rows the table should
    have after the call. If the table already had this many no more will
    be added and none will be taken away.

## setText

Sets localized text for the row header context table.

### Parameters

*   `newText` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** Text of table ids to strings. The ids currently
    recognized are 'cut', 'copy', `deleteRow`, `addRowBefore`, `addRowAfter`,
    `deleteColumn`, `addColumnBefore` and `addColumnAfter`.

## setButtons

Sets existing buttons on the page to be functional undo and redo
buttons, including becoming disabled when the appropriate stack
is exhausted.

### Parameters

*   `undoButton` **[HTMLButtonElement](https://developer.mozilla.org/docs/Web/API/HTMLButtonElement)** Button to set as undo
    button (or null)
*   `redoButton` **[HTMLButtonElement](https://developer.mozilla.org/docs/Web/API/HTMLButtonElement)** Button to set as redo
    button (or null)

## getSelection

Gets the position and size of the selection.

Returns **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** the position of the selection given by the
following keys: `anchorRow`, `anchorColumn`, `selectionRow`,
`selectionColumn`.

## setSelection

Sets the position and size of the selection.

### Parameters

*   `anchorRow` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The row the anchor is in
*   `anchorColumn` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The column the anchor is in
*   `selectionRow` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The other end of the
    selected rows (optional, default `anchorRow`)
*   `selectionColumn` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The other end
    of the selected columns (optional, default `anchorColumn`)

## rowCount

Returns the number of rows.

Returns **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** of rows in the table

## columnCount

Returns the number of columns.

Returns **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** of columns in the table

## getColumnHeaders

Returns the column headers.

Returns **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>** array of strings.

## getSubheaders

Returns selected options in subheaders

Returns **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>** array of strings

## goToCell

Moves the anchor (and selection to the same place)

### Parameters

*   `r` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** row to go to
*   `c` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** column to go to

## getCells

Gets the text of the cells requested.

### Parameters

*   `rowStart` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** first row (zero-based) (optional, default `0`)
*   `rowEnd` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)?** one past the last row, defaults to
    (one past) the last row
*   `columnStart` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** first column (optional, default `0`)
*   `columnEnd` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)?** one past the last column, defaults
    to (one past) the last column

Returns **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>>** The cell contents

## putCells

Gets the text of the cells requested.

### Parameters

*   `rowStart` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** first row (zero-based)
*   `rowEnd` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** one past the last row
*   `columnStart` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** first column
*   `columnEnd` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** one past the last column
*   `values` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>>** an array of arrays of new cell values.

## clearData

Clears all the data, leaving the headers and number of rows
untouched. This clearing goes on the undo stack.

## getColumn

Gets the text of the cells of one column.

### Parameters

*   `column` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** index of the column to return

Returns **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)<[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>** data from that column

## clearUndo

Clear the undo and redo stacks.

## undo

Undoes the last action done or redone.

## redo

Redoes the last undone action.

## nullary

Nullary function as a callback

Type: [Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)

## addWatcher

Adds a watcher function that is called every time the content of the
table changes (excluding the subheader cells).

### Parameters

*   `watcher` **[nullary](#nullary)** The new watcher to add.

## getTable

Returns the table element.

Returns **[HTMLTableElement](https://developer.mozilla.org/docs/Web/API/HTMLTableElement)**
