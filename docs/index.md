## DataEntryGrid

**DataEntryGrid** is a lightweight Excel-like interface to allow users to enter
data on your web page.

It was inspired by the amazing [Handsontable](https://handsontable.com/), and
the fact that its minified source costs more than a gigabyte.

Many users do not need all the functionality of Handsontable. In fact, it might
make the user experience worse as users might be able to use features that your
backend does not understand.

The aim of DataEntryGrid, therefore, is to provide only features that help
users to enter data. They can cut, copy and paste both within DataEntryGrid
and between it and programs such as Microsoft Excel. They can type data and
navigate using arrow keys, Home/End/Page Up/Page Down, Return and Tab in ways
that more or less correspond with Excel. They can use an unlimited Undo stack.

The API is limited but should provide what is needed for most cases.
