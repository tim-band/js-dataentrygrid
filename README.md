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

but lacking:

* Clearing cells with Delete or Backspace
* Arrow key navigation
* Multiple row add/delete
* Localization
  * The only text is in the right-click menu; could use icons?
* Callbacks to grey your own undo/redo buttons
* Check which browsers it works on
* Touch screen support
* Make it suitable for other projects to embed
  * npm build
  * minification
  * test code!
