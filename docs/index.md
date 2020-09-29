<style>
table.data-entry-grid {
  border: 1px solid black;
  background-color: white;
  border-collapse: collapse;
  padding-left: 5px;
  padding-right: 5px;
  padding-top: 0px;
  padding-bottom: 0px;
}

table.data-entry-grid th, table.data-entry-grid td {
  border: 1px solid black;
  background-color: white;
  border-collapse: collapse;
  padding-left: 5px;
  padding-right: 5px;
  padding-top: 0px;
  padding-bottom: 0px;
}

table.data-entry-grid input {
  border: 0;
}

table.data-entry-grid td.selected {
  border: 1px solid blue;
  background-color: lightskyblue;
  border-collapse: collapse;
  padding-left: 5px;
  padding-right: 5px;
  padding-top: 0px;
  padding-bottom: 0px;
}

table.data-entry-grid td.anchor {
  border: 3px solid blue;
  background-color: lightskyblue;
  border-collapse: collapse;
  padding-left: 5px;
  padding-right: 5px;
  padding-top: 0px;
  padding-bottom: 0px;
}
</style>
<script src="https://github.com/tim-band/js-dataentrygrid/releases/download/v1.1/dataentrygrid.min.js">
</script>

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

## Try it yourself!

<table id='input' class='data-entry-grid'>
</table>

<script>
  createDataEntryGrid('input', ['alpha', 'beta', 'gamma', 'delta'], 10);
</script>
