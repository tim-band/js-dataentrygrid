"use strict";

const { describe, before, beforeEach, after, it } = require('mocha');
const assert = require('assert');
const { Builder, By, Key, until } = require('selenium-webdriver');
const http = require('http');
const fs = require('fs');
const clipboardy = require("clipboardy");

describe('dataentrygrid', function () {
  let server = null;
  let driver = null;

  async function doGet() {
    await driver.get("http://localhost:3004/test/dataentrygrid.html");
  }

  before(async function () {
    server = await http.createServer(function(req, resp) {
      fs.readFile("." + req.url, function(error, content) {
        let code = 200;
        if (error) {
          if (error.code === "ENOENT") {
            code = 404;
            content = "404";
          } else {
            code = 500;
            content = "500";
          }
        }
        resp.writeHead(code, {"Content-Type": "text/html"});
        resp.end(content, "utf-8");
      });
    });
    server.listen(3004);
    driver = new Builder().forBrowser('firefox').build();
  });

  after(function(done) {
    this.timeout(9000);
    server.close(function() {
      driver.quit().then(function() { done() });
    });
  });

  describe('highlight (visual and API)', function () {
    let table = null;
    this.timeout(8000);

    beforeEach(async function() {
      await doGet();
      table = await getTable(driver);
    });

    it('can be set with a mouse click', async function() {
      const row = 0;
      const column = 1;
      await clickCell(driver, row, column);
      await checkSelection(driver, row, row, column, column);
    });

    it('can be set with a mouse drag', async function() {
      const startRow = 1;
      const startColumn = 1;
      const endRow = 0;
      const endColumn = 2;
      await mouseDragCells(driver,
        [[startRow,startColumn], [0,1], [endRow,endColumn]]);
      await checkSelection(driver, startRow, endRow, startColumn, endColumn);
    });

    it('moves with the cursor keys', async function() {
      await clickCell(driver, 1, 1);
      await table.sendKeys(Key.ARROW_UP);
      await checkSelection(driver, 0, 0, 1, 1);
      await table.sendKeys(Key.ARROW_LEFT, Key.ARROW_LEFT);
      await checkSelection(driver, 0, 0, 0, 0);
      await table.sendKeys(Key.ARROW_DOWN);
      await checkSelection(driver, 1, 1, 0, 0);
      await table.sendKeys(Key.ARROW_RIGHT, Key.ARROW_RIGHT);
      await checkSelection(driver, 1, 1, 1, 1);
    });

    it('moves with the home/end keys', async function() {
      const rc = await getRowCount(driver);
      const cc = await getColumnCount(driver);
      await clickCell(driver, 1, 1);
      await table.sendKeys(Key.HOME);
      await checkSelection(driver, 1, 1, 0, 0);
      await table.sendKeys(Key.END);
      await checkSelection(driver, 1, 1, cc-1, cc-1);
      await table.sendKeys(Key.CONTROL, Key.HOME);
      await checkSelection(driver, 0, 0, 0, 0);
      await table.sendKeys(Key.CONTROL, Key.END);
      await checkSelection(driver, rc-1, rc-1, cc-1, cc-1);
    });

    it ('moves with the page up/down keys', async function() {
      await driver.get("http://localhost:3004/test/deg-iframe.html");
      const frame = await driver.findElement(By.id('deg-frame'));
      const rect = await frame.getRect();
      await driver.switchTo().frame(frame);
      await init(driver, ['one', 'two'], 50);
      const cell = await getCell(driver, 0, 0).then(c => c.getRect());
      const visibleRows = Math.ceil(rect.height / cell.height);
      await clickCell(driver, 0, 0);
      const tab = await driver.findElement(By.css('table'));
      await tab.sendKeys(Key.PAGE_DOWN);
      let sel = await getSelection(driver);
      assert(Math.abs(sel.anchorRow - visibleRows) < 3);
      await tab.sendKeys(Key.PAGE_DOWN);
      sel = await getSelection(driver);
      assert(Math.abs(sel.anchorRow - visibleRows*2) < 3);
      await tab.sendKeys(Key.PAGE_UP);
      sel = await getSelection(driver);
      assert(Math.abs(sel.anchorRow - visibleRows) < 3);
    });

    it('does not move off the ends', async function() {
      await clickCell(driver, 1, 1);
      await repeatKey(table, 3, Key.ARROW_UP);
      await checkSelection(driver, 0, 0, 1, 1);
      await repeatKey(table, 5, Key.ARROW_LEFT);
      await checkSelection(driver, 0, 0, 0, 0);
      const rc = await getRowCount(driver);
      await repeatKey(table, 2 + rc, Key.ARROW_DOWN);
      await checkSelection(driver, rc-1, rc-1, 0, 0);
      const cc = await getColumnCount(driver);
      await repeatKey(table, 2 + 2 * cc, Key.ARROW_RIGHT);
      await checkSelection(driver, rc-1, rc-1, cc-1, cc-1);
    });

    it('gets extended with shift-arrows', async function() {
      await clickCell(driver, 1, 1);
      await table.sendKeys(Key.SHIFT, Key.ARROW_UP);
      await checkSelection(driver, 1, 0, 1, 1, 'first stretch');
      await table.sendKeys(Key.SHIFT, Key.ARROW_LEFT);
      await checkSelection(driver, 1, 0, 1, 0, 'second stretch');
      await table.sendKeys(Key.SHIFT, Key.ARROW_DOWN);
      await checkSelection(driver, 1, 1, 1, 0, 'first squeeze');
      await table.sendKeys(Key.SHIFT, Key.ARROW_RIGHT);
      await checkSelection(driver, 1, 1, 1, 1, 'second squeeze');
    });

    it('gets extended with the home/end keys', async function() {
      const rc = 3, headers = ['one', 'two', 'three'], cc = headers.length;
      await init(driver, headers, rc);
      await clickCell(driver, 1, 1);
      await table.sendKeys(Key.SHIFT, Key.HOME);
      await checkSelection(driver, 1, 1, 1, 0);
      await table.sendKeys(Key.SHIFT, Key.END);
      await checkSelection(driver, 1, 1, 1, cc-1);
      await table.sendKeys(Key.SHIFT, Key.CONTROL, Key.HOME);
      await checkSelection(driver, 1, 0, 1, 0);
      await table.sendKeys(Key.SHIFT, Key.CONTROL, Key.END);
      await checkSelection(driver, 1, rc-1, 1, cc-1);
    });

    it ('gets extended with the page up/down keys', async function() {
      await driver.get("http://localhost:3004/test/deg-iframe.html");
      const frame = await driver.findElement(By.id('deg-frame'));
      const rect = await frame.getRect();
      await driver.switchTo().frame(frame);
      await init(driver, ['one', 'two'], 50);
      const cell = await getCell(driver, 0, 0).then(c => c.getRect());
      const visibleRows = Math.ceil(rect.height / cell.height);
      await clickCell(driver, 0, 0);
      const tab = await driver.findElement(By.css('table'));
      await tab.sendKeys(Key.PAGE_DOWN);
      let sel = await getSelection(driver);
      const anchor = sel.anchorRow;
      await tab.sendKeys(Key.SHIFT, Key.PAGE_DOWN);
      sel = await getSelection(driver);
      assert.strictEqual(sel.anchorRow, anchor);
      assert(Math.abs(sel.selectionRow - visibleRows*2) < 3);
      await tab.sendKeys(Key.SHIFT, Key.PAGE_UP, Key.PAGE_UP);
      sel = await getSelection(driver);
      assert.strictEqual(sel.anchorRow, anchor);
      assert(sel.selectionRow < 2);
    });

    it('does not extend past the ends', async function() {
      await clickCell(driver, 1, 1);
      await table.sendKeys(Key.SHIFT, Key.ARROW_UP, Key.ARROW_UP);
      await checkSelection(driver, 1, 0, 1, 1, 'first stretch');
      await table.sendKeys(Key.SHIFT, Key.ARROW_LEFT, Key.ARROW_LEFT);
      await checkSelection(driver, 1, 0, 1, 0, 'second stretch');
      const rc = await getRowCount(driver);
      await repeatKey(table, 2 + rc, Key.ARROW_DOWN, Key.SHIFT);
      await checkSelection(driver, 1, rc-1, 1, 0, 'first squeeze');
      const cc = await getColumnCount(driver);
      await repeatKey(table, 2 + 2 * cc, Key.ARROW_RIGHT, Key.SHIFT);
      await checkSelection(driver, 1, rc-1, 1, cc-1, 'second squeeze');
    });
  });

  describe('cell content text', function() {
    let table = null;

    before(async function () {
      await doGet();
      table = await getTable(driver);
    });

    it('is set with typing', async function() {
      // finish typing with return, highlight moves down
      await clickCell(driver, 0, 0);
      const c1 = '6123.4';
      await table.sendKeys(c1, Key.RETURN);
      await checkSelection(driver, 1, 1, 0, 0, 'return (down)');
      await assertCellContents(driver, 0, 0, c1);
      const c2 = '45.6';
      // finish typing with tab, highlight moves right
      await table.sendKeys(c2, Key.TAB);
      await checkSelection(driver, 1, 1, 1, 1, 'tab (right)');
      await assertCellContents(driver, 1, 0, c2);
      const c3 = '7.8';
      // finish typing with return again, highlight moves down and left
      await table.sendKeys(c3, Key.RETURN);
      await checkSelection(driver, 2, 2, 0, 0, 'return (down to start of line)');
      await assertCellContents(driver, 1, 1, c3);
    });

    it('is still there when typing is initiated', async function() {
      const values = ['432', '4.5', '7.9'];
      await clickCell(driver, 0, 0);
      await table.sendKeys(values[0], Key.TAB, values[1], Key.TAB, values[2], Key.RETURN);
      await clickCell(driver, 0, 2);
      await clickCell(driver, 0, 1);
      await clickCell(driver, 0, 0);
      await assertCellContents(driver, 0, 0, values[0]);
      await assertCellContents(driver, 0, 1, values[1]);
      await assertCellContents(driver, 0, 2, values[2]);
    });

    it('is still there when typing is initiated after drag', async function() {
      const values = [15.5, 98.3];
      await putCells(driver, 0, 1, 0, 2, [values]);
      await mouseDragCells(driver, [[0,1], [0,0]]);
      await table.sendKeys(Key.RETURN);
      await table.sendKeys(Key.RETURN);
      await assertCellContents(driver, 0, 0, values[0]);
      await assertCellContents(driver, 0, 1, values[1]);
    });

    it('is set via the API', async function() {
      const rows = [[23.4, 43.1], [0.123, 55]];
      await putCells(driver, 0, 2, 0, 2, rows);
      for (const r in rows) {
        const row = rows[r];
        for (const c in row) {
          await assertCellContents(driver, r, c, row[c]);
        }
      }
    });

    it('can be copied to the clipboard', async function() {
      const rows = [['23.4', '43.1'], ['0.123', '55']];
      await putCells(driver, 0, 2, 0, 2, rows);
      await clickCell(driver, 0, 0);
      await table.sendKeys(Key.SHIFT, Key.RIGHT, Key.DOWN);
      await table.sendKeys(Key.CONTROL, 'c');
      const copied = clipboardy.readSync();
      const expected = cellsToText(rows);
      assert.strictEqual(copied, expected, 'clipboard text did not match entered text after copy');
    });

    it('can be cut', async function() {
      const rows = [['5.6', '12.8'], ['23', '99.01']];
      await putCells(driver, 0, 2, 0, 2, rows);
      await clickCell(driver, 0, 0);
      await table.sendKeys(Key.SHIFT, Key.RIGHT, Key.DOWN);
      await table.sendKeys(Key.CONTROL, 'x');
      const copied = clipboardy.readSync();
      const expected = cellsToText(rows);
      assert.strictEqual(copied, expected, 'clipboard text did not match entered text after cut');
      await assertCellContents(driver, 0, 0, '');
      await assertCellContents(driver, 0, 1, '');
      await assertCellContents(driver, 1, 0, '');
      await assertCellContents(driver, 1, 1, '');
    });

    it('can be pasted', async function() {
      const rows = [['6', '48.3'], ['30', '12.1']];
      clipboardy.writeSync(cellsToText(rows));
      await clickCell(driver, 0, 0);
      await table.sendKeys(Key.CONTROL, 'v');
      const actual = await getCells(driver, 0, 2, 0, 2);
      assert.deepStrictEqual(actual, rows, 'cell text did not match pasted text');
    });

    it('can be restored with undo and redo', async function() {
      const rows = [['23.4', '43.1'], ['0.123', '55']];
      await putCells(driver, 0, 2, 0, 2, rows);
      await clickCell(driver, 0, 0);
      const c0 = '654';
      await table.sendKeys(c0);
      const c1 = '876';
      await clickCell(driver, 1, 1);
      await table.sendKeys(c1, Key.TAB);
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, c1);
      await table.sendKeys(Key.CONTROL, 'z');
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, rows[1][1]);
      await table.sendKeys(Key.CONTROL, 'z');
      await assertCellContents(driver, 0, 0, rows[0][0]);
      await assertCellContents(driver, 1, 1, rows[1][1]);
      await table.sendKeys(Key.CONTROL, Key.SHIFT, 'z');
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, rows[1][1]);
      await table.sendKeys(Key.CONTROL, Key.SHIFT, 'z');
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, c1);
    });

    it('can undo input box typing', async function() {
      const rows = [['5.06']];
      await putCells(driver, 0, 1, 0, 1, rows);
      await clickCell(driver, 0, 0);
      const c0 = '654';
      await table.sendKeys(c0);
      await table.sendKeys(Key.CONTROL, 'z');
      await assertCellContents(driver, 0, 0, rows[0][0]);
      await table.sendKeys(Key.CONTROL, Key.SHIFT, 'z');
      await assertCellContents(driver, 0, 0, c0);
      await table.sendKeys(Key.CONTROL, 'z');
      await assertCellContents(driver, 0, 0, rows[0][0]);
    });

    it('withstands undo and redo off the end of the stacks', async function() {
      const rows = [['23.4', '43.1'], ['0.123', '55']];
      await putCells(driver, 0, 2, 0, 2, rows);
      await clearUndo(driver);
      await clickCell(driver, 0, 0);
      const c0 = '654';
      await table.sendKeys(c0);
      const c1 = '876';
      await clickCell(driver, 1, 1);
      await table.sendKeys(c1, Key.TAB);
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, c1);
      await table.sendKeys(Key.CONTROL, 'z');
      await table.sendKeys(Key.CONTROL, 'z');
      await table.sendKeys(Key.CONTROL, 'z');
      await table.sendKeys(Key.CONTROL, 'z');
      await table.sendKeys(Key.CONTROL, 'z');
      await assertCellContents(driver, 0, 0, rows[0][0]);
      await assertCellContents(driver, 1, 1, rows[1][1]);
      await table.sendKeys(Key.CONTROL, Key.SHIFT, 'z');
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, rows[1][1]);
      await table.sendKeys(Key.CONTROL, Key.SHIFT, 'z');
      await table.sendKeys(Key.CONTROL, Key.SHIFT, 'z');
      await table.sendKeys(Key.CONTROL, Key.SHIFT, 'z');
      await table.sendKeys(Key.CONTROL, Key.SHIFT, 'z');
      await table.sendKeys(Key.CONTROL, Key.SHIFT, 'z');
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, c1);
      await table.sendKeys(Key.CONTROL, 'z');
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, rows[1][1]);
    });
  });

  describe('column headers', function() {
    let table = null;

    before(async function () {
      await doGet();
      table = await getTable(driver);
    });

    it('can be set via the API', async function() {
      const newRows = 5;
      const newHeaders = ['proton', 'neutral', 'electron', 'positron'];
      await init(driver, newHeaders, newRows);
      const rc = await getRowCount(driver);
      assert.strictEqual(rc, newRows);
      const cc = await getColumnCount(driver);
      assert.strictEqual(cc, newHeaders.length);
      const heads = await getColumnHeaders(driver);
      assert.deepStrictEqual(heads, newHeaders);
      // and check that the DOM reflects this
      const rs = await driver.findElements(By.css('table#input tbody tr'));
      assert.strictEqual(rs.length, newRows,
        'did not initialize with the correct number of rows');
      const ths = await driver.findElements(By.css('table#input thead th'));
      assert.strictEqual(ths.length, newHeaders.length + 1,
        'did not initialize with the correct number of column headers');
      for (let i = 0; i != rc; ++i) {
        const tds = await driver.findElements(By.css(`table#input tbody tr:nth-child(${i+1}) td`));
        assert.strictEqual(tds.length, newHeaders.length,
          `did not initialize row ${i} with the correct number cells`);
          await assertCellContents(driver, i, cc-1, '');
        }
    });

    it('can be read via the API', async function() {
      const headerss = [['one', 'two'], ['whiskey', 'x-ray', 'yankee', 'zulu']];
      for (let h = 0; h != headerss.length; ++h) {
        const headers = headerss[h];
        await init(driver, headers, 5);
        const ths = await driver.findElements(By.css('table#input thead th'));
        let actualHeaders = [];
        for (let i = 1; i < ths.length; ++i) {
          const e = await ths[i].getText();
          actualHeaders.push(e);
        }
        assert.deepStrictEqual(actualHeaders, headers);
        const apiHeaders = await getColumnHeaders(driver);
        assert.deepStrictEqual(apiHeaders, headers);
      }
    });
  });

  describe('rows', function() {
    let table = null;

    before(async function () {
      await doGet();
      table = await getTable(driver);
    });

    it('can be added', async function() {
      const rc = await getRowCount(driver);
      await clickCell(driver, 0, 0);
      const contents = '32.1';
      table.sendKeys(contents);
      await rowHeaderMenuSelect(driver, 0, 'add-before');
      const rc2 = await getRowCount(driver);
      assert.strictEqual(rc2, rc + 1,
        'row count (from API) does not increase when adding a row before');
      await assertCellContents(driver, 1, 0, contents);
      await assertCellContents(driver, 0, 0, '');
      await clickCell(driver, 0, 0);
      table.sendKeys(Key.SHIFT, Key.ARROW_DOWN);
      await rowHeaderMenuSelect(driver, 1, 'add-after');
      const rc3 = await getRowCount(driver);
      assert.strictEqual(rc3, rc2 + 2,
        'row count (from API) does not increase by 2 when adding a row after');
      await assertCellContents(driver, 1, 0, contents);
      await assertCellContents(driver, 2, 0, '');
      await assertCellContents(driver, 3, 0, '');
    });

    it('can be deleted', async function() {
      // ensure we have at least four rows
      await clickCell(driver, 0, 0);
      await repeatKey(table, 4, Key.RETURN);
      const rows = [['43'], ['509'], ['15'], ['88']];
      await putCells(driver, 0, 4, 0, 1, rows);
      const rc = await getRowCount(driver);
      await clickCell(driver, 1, 1);
      table.sendKeys(Key.SHIFT, Key.ARROW_DOWN);
      await rowHeaderMenuSelect(driver, 1, 'delete');
      const rc2 = await getRowCount(driver);
      assert.strictEqual(rc2, rc - 2,
        'row count (from API) does not decrease by 2 when deleting a row');
      await assertCellContents(driver, 0, 0, rows[0][0]);
      await assertCellContents(driver, 1, 0, rows[3][0]);
    });

    it('are automatically added as required', async function() {
      const rc = await getRowCount(driver);
      await clickCell(driver, rc - 1, 0);
      const firstContents = '123';
      const secondContents = '456';
      await table.sendKeys(firstContents, Key.RETURN, secondContents);
      const rc2 = await getRowCount(driver);
      assert.strictEqual(rc2, rc+1,
        'row count (from API) does not increase when typing off the bottom row');
      await assertCellContents(driver, rc - 1, 0, firstContents);
      await assertCellContents(driver, rc, 0, secondContents);
    });
  });

  describe('row header context menu', function() {
    let table = null;

    before(async function () {
      await doGet();
      table = await getTable(driver);
    });

    it('can have its option text set', async function() {
      const text = [{
        deleteRow: 'Bye',
        addRowBefore: 'New up',
        addRowAfter: 'New down'
      },{
        deleteRow: 'Delete row',
        addRowBefore: 'Add row before',
        addRowAfter: 'Add row after'
      }];
      for (const i in text) {
        await setText(driver, text[i]);
        await rowHeaderClick(driver, 1);
        const deleteText = await driver.findElement(rowHeaderMenuLocator('delete')).getText();
        assert.strictEqual(deleteText, text[i].deleteRow);
        const beforeText = await driver.findElement(rowHeaderMenuLocator('add-before')).getText();
        assert.strictEqual(beforeText, text[i].addRowBefore);
        const afterText = await driver.findElement(rowHeaderMenuLocator('add-after')).getText();
        assert.strictEqual(afterText, text[i].addRowAfter);
        await clickCell(driver, 0, 0);
      }
    });
  });

  describe('control buttons', function() {
    let table = null;

    beforeEach(async function () {
      await doGet();
      table = await getTable(driver);
    });

    it('can be set', async function() {
      const undoButton = await driver.findElement(By.id('undo'));
      const redoButton = await driver.findElement(By.id('redo'));
      setButtons(driver, undoButton, redoButton);
      const rows = [['55.5', '66.6'], ['77.7', '88.8']];
      await putCells(driver, 0, 2, 0, 2, rows);
      const c1 = '672';
      await clickCell(driver, 1, 1);
      await table.sendKeys(c1, Key.TAB);
      await assertCellContents(driver, 0, 0, rows[0][0]);
      await assertCellContents(driver, 1, 1, c1);
      await undoButton.click();
      await assertCellContents(driver, 0, 0, rows[0][0]);
      await assertCellContents(driver, 1, 1, rows[1][1]);
      await redoButton.click();
      await assertCellContents(driver, 0, 0, rows[0][0]);
      await assertCellContents(driver, 1, 1, c1);
    });

    it('get disabled appropriately', async function() {
      const undoButton = await driver.findElement(By.id('undo'));
      const redoButton = await driver.findElement(By.id('redo'));
      setButtons(driver, undoButton, redoButton);
      await assertDisabled(driver, 'undo');
      await assertDisabled(driver, 'redo');
      const rows = [['55.5', '66.6'], ['77.7', '88.8']];
      await putCells(driver, 0, 2, 0, 2, rows);
      await clearUndo(driver);
      await assertDisabled(driver, 'undo');
      await assertDisabled(driver, 'redo');
      await clickCell(driver, 0, 0);
      const c0 = '143';
      await table.sendKeys(c0, Key.RETURN);
      await assertEnabled(driver, 'undo');
      await assertDisabled(driver, 'redo');
      const c1 = '672';
      await clickCell(driver, 1, 1);
      await table.sendKeys(c1, Key.TAB);
      await assertEnabled(driver, 'undo');
      await assertDisabled(driver, 'redo');
      await undoButton.click();
      await assertEnabled(driver, 'undo');
      await assertEnabled(driver, 'redo');
      await undoButton.click();
      await assertDisabled(driver, 'undo');
      await assertEnabled(driver, 'redo');
      await redoButton.click();
      await assertEnabled(driver, 'undo');
      await assertEnabled(driver, 'redo');
      await redoButton.click();
      await assertEnabled(driver, 'undo');
      await assertDisabled(driver, 'redo');
    });
  });
});

async function assertEnabled(driver, buttonId) {
  // for some reason we need to fetch it every time,
  // we can't just use the same one or updates to
  // the attributes don't show
  const button = driver.findElement(By.id(buttonId));
  const disabled = await button.getAttribute('disabled');
  assert(!disabled, buttonId + ' should be enabled');
}

async function assertDisabled(driver, buttonId) {
  const button = driver.findElement(By.id(buttonId));
  const disabled = await button.getAttribute('disabled');
  assert(disabled, buttonId + ' should be disabled');
}

async function rowHeaderMenuSelect(driver, row, option) {
  await rowHeaderClick(driver, row);
  const optionElement = await driver.findElement(
    rowHeaderMenuLocator(option));
  await driver.actions({bridge: true})
      .move({origin: optionElement})
      .click()
      .perform();
}

function rowHeaderMenuLocator(option) {
  return By.css(`#input #input-row-menu option[value='${option}']`);
}

async function rowHeaderClick(driver, row) {
  const rowHeader = await driver.findElement(
    By.css(`#input tbody tr:nth-child(${row + 1}) th:nth-child(1)`));
  await driver.actions({ bridge: true }).contextClick(rowHeader).perform();
}

function cellsToText(rows) {
  return rows.map(row => row.join('\t')).join('\n');
}

async function assertCellContents(driver, row, column, expectedContents) {
  const r = Number(row);
  const c = Number(column);
  // assert that the cell is reported as expected
  const rows = await getCells(driver, r, r + 1, c, c + 1);
  assert.strictEqual(rows[0][0], ''+expectedContents, 'reported text not as expected');
  // assert that the cell looks as expected
  const cell = await getCell(driver, r, c);
  const text = await getText(cell);
  assert.strictEqual(text, ''+expectedContents, 'visible text not as expected');
}

async function getText(cell) {
  const inputs = await cell.findElements(By.css('input'));
  if (inputs.length === 0) {
    return await cell.getText();
  }
  return await inputs[0].getAttribute('value');
}

async function repeatKey(element, times, key, modifier) {
  modifier = modifier? [modifier] : [];
  await element.sendKeys.apply(element, modifier.concat(repeat(times, key)));
}

function repeat(times, x) {
  return Array(times).fill(x);
}

function getTable(driver) {
  return driver.findElement(By.id('input'));
}

async function checkSelection(driver, startRow, endRow, startColumn, endColumn, name) {
  // API selection
  const sel = await getSelection(driver);
  const expected = {
    anchorRow: startRow,
    anchorColumn: startColumn,
    selectionRow: endRow,
    selectionColumn: endColumn
  };
  assert.deepStrictEqual(sel, expected, `${name} failed`);
  // visual selection
  const minR = Math.min(startRow, endRow);
  const maxR = Math.max(startRow, endRow);
  const minC = Math.min(startColumn, endColumn);
  const maxC = Math.max(startColumn, endColumn);
  const rowCount = await getRowCount(driver);
  const columnCount = await getColumnCount(driver);
  for (let r = 0; r !== rowCount; ++r) {
    for (let c = 0; c !== columnCount; ++c) {
      const cell = await getCell(driver, r, c);
      if (minR <= r && r <= maxR && minC <= c && c <= maxC) {
        assertHasClass(cell, 'selected',
          '('+r+','+c+') should have been selected');
      }
      else {
        assertHasNoClass(cell, 'selected',
          '('+r+','+c+') should not have been selected');
      }
      if (r === startRow && c === startColumn) {
        assertHasClass(cell, 'anchor',
          '('+r+','+c+') should have been the anchor');
      }
      else {
        assertHasNoClass(cell, 'anchor',
          '('+r+','+c+') should not have been the anchor');
      }
    }
  }
}

async function clickCell(driver, row, column) {
  const cell = await getCell(driver, row, column);
  await cell.click();
}

async function init(driver, headers, rowCount) {
  return await driver.executeScript(
      `window.dataEntryGrid.init(arguments[0], ${rowCount});`,
      headers);
}

async function setText(driver, textObject) {
  return await driver.executeScript(
      `window.dataEntryGrid.setText(arguments[0]);`,
      textObject);
}

async function setButtons(driver, undoButton, redoButton) {
  return await driver.executeScript(
      `window.dataEntryGrid.setButtons(arguments[0], arguments[1]);`,
      undoButton, redoButton);
}

async function clearUndo(driver) {
  return await driver.executeScript('return window.dataEntryGrid.clearUndo();');
}

async function getSelection(driver) {
  return await driver.executeScript('return window.dataEntryGrid.getSelection();');
}

async function getRowCount(driver) {
  return await driver.executeScript('return window.dataEntryGrid.rowCount();');
}

async function getColumnCount(driver) {
  return await driver.executeScript('return window.dataEntryGrid.columnCount();');
}

async function getCells(driver, startRow, endRow, startColumn, endColumn) {
  return await driver.executeScript(
    `return window.dataEntryGrid.getCells(${startRow}, ${endRow},
      ${startColumn}, ${endColumn});`);
}

async function putCells(driver, startRow, endRow, startColumn, endColumn, rows) {
  await driver.executeScript(
    `window.dataEntryGrid.putCells(${startRow}, ${endRow},
      ${startColumn}, ${endColumn}, ${JSON.stringify(rows)});`);
}

async function getColumnHeaders(driver) {
  return await driver.executeScript('return window.dataEntryGrid.getColumnHeaders();');
}

async function mouseDragCells(driver, coords) {
  let [r,c] = coords[0];
  let sel = cellSelector(r,c);
  const element = getCell(driver, r, c);
  let actions = driver.actions({bridge: true}).move({origin:element}).press();
  for (let i = 1; i != coords.length; ++i) {
    [r,c] = coords[i];
    const el = getCell(driver, r, c);
    actions = actions.move({origin: el});
  }
  await actions.release().perform();
}

async function getCell(driver, row, column) {
  return driver.findElement(cellSelector(row, column));
}

function cellSelector(row, column) {
  return By.css(`#input tbody tr:nth-child(${row + 1}) td:nth-child(${column + 2})`);
}

async function assertHasClass(element, c, message) {
  const cs = await element.getAttribute('class');
  if (cs && (' '+cs+' ').includes(c)) {
    return;
  }
  if (!message) {
    const tag = await element.getTagName();
    const id = await element.getId();
    const name = id? `${tag} element ${id}` : `${tag} element`;
    message = `${name} does not have the class ${c} (rather, it has ${cs})`;
  }
  assert.fail(message);
}

async function assertHasNoClass(element, c, message) {
  const cs = await element.getAttribute('class');
  if (!cs || !(' '+cs+' ').includes(c)) {
    return;
  }
  if (!message) {
    const tag = await element.getTagName();
    const id = await element.getId();
    const name = id? `${tag} element ${id}` : `${tag} element`;
    message = `${name} should not have the class ${c} (it has ${cs})`;
  }
  assert.fail(message);
}
