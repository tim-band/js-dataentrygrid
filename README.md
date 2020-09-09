# js-dataentrygrid
Featherweight Excel-like grid for data entry

At the moment, just an HTML proof-of-concept with the following features:

* Click to edit
* Navigate with Tab and Return
* Auto-insert rows at the end
* Right-click menu with:
  * delete rows
  * insert rows
* Undo and Redo
* Multiple row and column selections
* Copy and paste
* Clearing cells with Delete or Backspace
* Arrow key navigation
* Starting to type forces the input box to open
* Copy and paste to and from Excel/LibreOffice
* Shift-arrows to extend selection
* Multiple row add/delete
* Localization
* Useful API
* Provide undo and redo buttons

but lacking:

* Hiding the blinking text cursor
  * perhaps we can have a hidden SELECT or something else
    focussable within the table to get focus and pass events
    up to the table?
* 'Cut' and 'Copy' sometimes grayed out on Chrome's context menu,
  because nothing is selected.
* Home/End/Page up/Page down
* Check which browsers it works on
* Touch screen support
* Make it suitable for other projects to embed
  * npm build
  * minification
  * test code!
