"use strict";

const { describe, before, beforeEach, after, afterEach, it } = require('mocha');
const assert = require('assert');
const { Builder, By, Key, until, Capabilities } = require('selenium-webdriver');
const http = require('http');
const fs = require('fs');
const clipboardy = require("clipboardy");
// Maybe one day these tests will work on IE
const { Options } = require('selenium-webdriver/ie');
const { Preferences, Type, Level } = require('selenium-webdriver/lib/logging');
const they = it;

function findArg(a) {
  for (let i = 1; i < process.argv.length; ++i) {
    const ar = process.argv[i];
    const equals = ar.search("=");
    if (equals < 0) {
      if (ar === a) {
        ++i;
        return process.argv[i];
      }
    } else {
      if (ar.slice(0,equals) === a) {
        return ar.slice(equals+1);
      }
    }
  }
  return null;
}

const browserArg = findArg('--browser');
const browser = browserArg? browserArg : 'chrome';

describe('dataentrygrid', async function () {
  let server = null;
  let driver = null;
  let serverPort = 3004;

  async function doGet(path) {
    if (!path) {
      path = '/test/dataentrygrid.html';
    }
    await driver.get(`http://localhost:${serverPort}${path}`);
  }

  before(function () {
    this.timeout(15000);
    return new Promise(function (resolve, reject) {
      server = http.createServer(function(req, resp) {
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
      server.listen(serverPort, function() {
        new Builder()
            .forBrowser(browser)
            .setIeOptions(new Options().requireWindowFocus(true))
            .build().then(d => {
          driver = d;
          resolve();
        });
      });
    });
  });

  after(function(done) {
    this.timeout(9000);
    driver.quit().then(() =>
      server.close(() =>
        done()));
  });

  it('contains mutual links between itself and its HTML representation', async function() {
    await doGet();
    const eq = await driver.executeScript('var d=window.dataEntryGrid;return d===d.getTable().dataEntryGrid;');
    assert.ok(eq, 'grid.getTable().dataEntryGrid !== grid');
  });

  describe('highlight (visual and API)', function () {
    this.timeout(8000);

    beforeEach(async function() {
      await doGet();
      await init(driver, ['one', 'two', 'three'], [[10.1, 20.2, 30.3], [1, 2, 3]]);
    });

    it('can be set with a mouse click', async function() {
      const row = 0;
      const column = 1;
      await clickCell(driver, row, column);
      await checkSelection(driver, row, row, column, column);
    });

    it('can be set with a mouse click on the row header', async function() {
      const row = 1;
      await rowHeaderClick(driver, row);
      await checkSelection(driver, row, row, 0, 2, 'row header clicked');
    });

    it('can be set with a mouse drag on the row headers', async function() {
      const startRow = 1;
      const endRow = 0;
      const startHeader = await rowHeaderElement(driver, startRow);
      const endHeader = await rowHeaderElement(driver, endRow);
      await driver.actions({bridge: true})
        .move({origin: startHeader}).press()
        .move({origin: endHeader}).release().perform();
      await checkSelection(driver, startRow, endRow, 0, 2, 'row header dragged');
    });

    it('can be set with a mouse click on the column header', async function() {
      const column = 1;
      await columnHeaderClick(driver, column);
      await checkSelection(driver, 0, 1, column, column, 'column header clicked');
    });

    it('can be set with a mouse drag on the column headers', async function() {
      const startColumn = 1;
      const endColumn = 0;
      await dragColumnHeaders(driver, startColumn, endColumn);
      await checkSelection(driver, 0, 1, startColumn, endColumn, 'column header dragged');
    });

    it('can be set with a mouse click on the table header', async function() {
      await columnHeaderClick(driver, -1);
      await checkSelection(driver, 0, 1, 0, 2, 'table header clicked');
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

    it('can be set with the API', async function () {
      await clickCell(driver, 0, 1);
      const startRow = 0, endRow = 1, startColumn = 2, endColumn = 1;
      await setSelection(driver, startRow, startColumn, endRow, endColumn);
      await checkSelection(driver, startRow, endRow, startColumn, endColumn);
      await setSelection(driver, startRow, startColumn);
      await checkSelection(driver, startRow, startRow, startColumn, startColumn);
    });

    it('moves with the cursor keys', async function() {
      await clickCell(driver, 1, 1);
      await sendKeys(driver, Key.ARROW_UP);
      await checkSelection(driver, 0, 0, 1, 1);
      await sendKeys(driver, Key.ARROW_LEFT, Key.ARROW_LEFT);
      await checkSelection(driver, 0, 0, 0, 0);
      await sendKeys(driver, Key.ARROW_DOWN);
      await checkSelection(driver, 1, 1, 0, 0);
      await sendKeys(driver, Key.ARROW_RIGHT, Key.ARROW_RIGHT);
      await checkSelection(driver, 1, 1, 1, 1);
    });

    it('moves with the home/end keys', async function() {
      const rc = await getRowCount(driver);
      const cc = await getColumnCount(driver);
      await clickCell(driver, 1, 1);
      await sendKeys(driver, Key.HOME);
      await checkSelection(driver, 1, 1, 0, 0);
      await sendKeys(driver, Key.END);
      await checkSelection(driver, 1, 1, cc-1, cc-1);
      await sendKeys(driver, Key.CONTROL, Key.HOME);
      await checkSelection(driver, 0, 0, 0, 0);
      await sendKeys(driver, Key.CONTROL, Key.END);
      await checkSelection(driver, rc-1, rc-1, cc-1, cc-1);
    });

    it ('moves with the page up/down keys', async function() {
      await doGet("/test/deg-iframe.html");
      const frame = await driver.findElement(By.id('deg-frame'));
      const rect = await getBoundingRect(driver, frame);
      const height = rect.bottom - rect.top;
      await init(driver, ['one', 'two'], 50);
      const cell = await getCell(driver, 0, 0).then(c => c.getRect());
      const visibleRows = Math.ceil(height / cell.height) - 1;
      await clickCell(driver, 0, 0);
      await sendKeys(driver, Key.PAGE_DOWN);
      let sel = await getSelection(driver);
      assert(Math.abs(sel.anchorRow - visibleRows) < 3);
      await sendKeys(driver, Key.PAGE_DOWN);
      sel = await getSelection(driver);
      assert(Math.abs(sel.anchorRow - visibleRows*2) < 3);
      await sendKeys(driver, Key.PAGE_UP);
      sel = await getSelection(driver);
      assert(Math.abs(sel.anchorRow - visibleRows) < 3);
    });

    it('does not move off the ends', async function() {
      await clickCell(driver, 1, 1);
      await repeatKey(driver, 3, Key.ARROW_UP);
      await checkSelection(driver, 0, 0, 1, 1);
      await repeatKey(driver, 5, Key.ARROW_LEFT);
      await checkSelection(driver, 0, 0, 0, 0);
      const rc = await getRowCount(driver);
      await repeatKey(driver, 2 + rc, Key.ARROW_DOWN);
      await checkSelection(driver, rc-1, rc-1, 0, 0);
      const cc = await getColumnCount(driver);
      await repeatKey(driver, 2 + 2 * cc, Key.ARROW_RIGHT);
      await checkSelection(driver, rc-1, rc-1, cc-1, cc-1);
    });

    it('gets extended with shift-arrows', async function() {
      await clickCell(driver, 1, 1);
      await sendKeys(driver, Key.SHIFT, Key.ARROW_UP);
      await checkSelection(driver, 1, 0, 1, 1, 'first stretch');
      await sendKeys(driver, Key.SHIFT, Key.ARROW_LEFT);
      await checkSelection(driver, 1, 0, 1, 0, 'second stretch');
      await sendKeys(driver, Key.SHIFT, Key.ARROW_DOWN);
      await checkSelection(driver, 1, 1, 1, 0, 'first squeeze');
      await sendKeys(driver, Key.SHIFT, Key.ARROW_RIGHT);
      await checkSelection(driver, 1, 1, 1, 1, 'second squeeze');
    });

    it('gets extended with shift-ctrl-arrows', async function() {
      let rows = [];
      const row_count = 9;
      const row_start = 5;
      for (var r = 1; r <= row_count; ++r) {
        rows.push([r, r*2, r*3, r*4, r*5]);
      }
      await init(driver, ['one', 'two', 'three', 'four', 'five'], rows);
      await clickCell(driver, row_start, 2);
      await sendKeys(driver, Key.SHIFT, Key.CONTROL, Key.ARROW_UP);
      await checkSelection(driver, row_start, 0, 2, 2, 'first stretch');
      await sendKeys(driver, Key.SHIFT, Key.CONTROL, Key.ARROW_LEFT);
      await checkSelection(driver, row_start, 0, 2, 0, 'second stretch');
      await sendKeys(driver, Key.SHIFT, Key.CONTROL, Key.ARROW_DOWN);
      await checkSelection(driver, row_start, row_count - 1, 2, 0, 'third stretch');
      await sendKeys(driver, Key.SHIFT, Key.CONTROL, Key.ARROW_RIGHT);
      await checkSelection(driver, row_start, row_count - 1, 2, 4, 'fourth stretch');
    });

    it('control-A selects everything', async function() {
      await clickCell(driver, 1, 1);
      await sendKeys(driver, Key.CONTROL, 'a');
      await checkSelection(driver, 0, 1, 0, 2, 'select all');
    });

    it('gets extended with the home/end keys', async function() {
      const rc = 3, headers = ['one', 'two', 'three'], cc = headers.length;
      await init(driver, headers, rc);
      await clickCell(driver, 1, 1);
      await sendKeys(driver, Key.SHIFT, Key.HOME);
      await checkSelection(driver, 1, 1, 1, 0);
      await sendKeys(driver, Key.SHIFT, Key.END);
      await checkSelection(driver, 1, 1, 1, cc-1);
      await sendKeys(driver, Key.SHIFT, Key.CONTROL, Key.HOME);
      await checkSelection(driver, 1, 0, 1, 0);
      await sendKeys(driver, Key.SHIFT, Key.CONTROL, Key.END);
      await checkSelection(driver, 1, rc-1, 1, cc-1);
    });

    it ('gets extended with the page up/down keys', async function() {
      await doGet("/test/deg-iframe.html");
      const frame = await driver.findElement(By.id('deg-frame'));
      const rect = await getBoundingRect(driver, frame);
      const height = rect.bottom - rect.top;
      await init(driver, ['one', 'two'], 50);
      const cell = await getCell(driver, 0, 0).then(c => c.getRect());
      const visibleRows = Math.ceil(height / cell.height) - 1;
      await clickCell(driver, 0, 0);
      await sendKeys(driver, Key.PAGE_DOWN);
      let sel = await getSelection(driver);
      const anchor = sel.anchorRow;
      await sendKeys(driver, Key.SHIFT, Key.PAGE_DOWN);
      sel = await getSelection(driver);
      assert.strictEqual(sel.anchorRow, anchor);
      assert(Math.abs(sel.selectionRow - visibleRows*2) < 3);
      await sendKeys(driver, Key.SHIFT, Key.PAGE_UP, Key.PAGE_UP);
      sel = await getSelection(driver);
      assert.strictEqual(sel.anchorRow, anchor);
      assert(sel.selectionRow < 2);
    });

    it('does not extend past the ends', async function() {
      await clickCell(driver, 1, 1);
      await sendKeys(driver, Key.SHIFT, Key.ARROW_UP, Key.ARROW_UP);
      await checkSelection(driver, 1, 0, 1, 1, 'first stretch');
      await sendKeys(driver, Key.SHIFT, Key.ARROW_LEFT, Key.ARROW_LEFT);
      await checkSelection(driver, 1, 0, 1, 0, 'second stretch');
      const rc = await getRowCount(driver);
      await repeatKey(driver, 2 + rc, Key.ARROW_DOWN, Key.SHIFT);
      await checkSelection(driver, 1, rc-1, 1, 0, 'first squeeze');
      const cc = await getColumnCount(driver);
      await repeatKey(driver, 2 + 2 * cc, Key.ARROW_RIGHT, Key.SHIFT);
      await checkSelection(driver, 1, rc-1, 1, cc-1, 'second squeeze');
    });

    describe('returns to the column set', function() {
      afterEach(async function() {
        await sendKeys(driver, Key.RETURN);
        const sel = await getSelection(driver);
        assert.deepStrictEqual(sel, {
          anchorRow: 1,
          anchorColumn: 1,
          selectionRow: 1,
          selectionColumn: 1
        });

        it('with click', async function() {
          await clickCell(driver, 0, 1);
        });

        it('with cursor keys', async function() {
          await clickCell(driver, 0, 0);
          await sendKeys(driver, Key.ARROW_RIGHT);
        });

        it('after tabs', async function() {
          await clickCell(driver, 0, 1);
          await sendKeys(driver, Key.TAB, Key.TAB);
        });
      });
    });
  });

  describe('cell content text', function() {
    this.timeout(8000);

    beforeEach(async function () {
      await doGet();
    });

    it('is set with typing', async function() {
      // finish typing with return, highlight moves down
      await clickCell(driver, 0, 0);
      const c1 = '6123.4';
      await sendKeys(driver, c1, Key.RETURN);
      await checkSelection(driver, 1, 1, 0, 0, 'return (down)');
      await assertCellContents(driver, 0, 0, c1);
      const c2 = '45.6';
      // finish typing with tab, highlight moves right
      await sendKeys(driver, c2, Key.TAB);
      await checkSelection(driver, 1, 1, 1, 1, 'tab (right)');
      await assertCellContents(driver, 1, 0, c2);
      const c3 = '7.8';
      // finish typing with return again, highlight moves down and left
      await sendKeys(driver, c3, Key.RETURN);
      await checkSelection(driver, 2, 2, 0, 0, 'return (down to start of line)');
      await assertCellContents(driver, 1, 1, c3);
      // typing including arrow keys, backspace, and delete
      await clickCell(driver, 0, 0);
      await sendKeys(driver,
        '1234',
        Key.ARROW_LEFT,
        Key.BACK_SPACE,
        '5678',
        Key.ARROW_LEFT, Key.ARROW_LEFT,
        Key.DELETE,
        '9',
        Key.ARROW_RIGHT,
        '0',
        Key.TAB);
      await assertCellContents(driver, 0, 0, '12569804');
      // ...and we can change the start
      await clickCell(driver, 0, 0);
      await sendKeys(driver, Key.ARROW_LEFT, '4', Key.RETURN);
      await assertCellContents(driver, 0, 0, '412569804');
      // ...and the end
      await clickCell(driver, 0, 0);
      await sendKeys(driver, Key.ARROW_RIGHT, '2', Key.TAB);
      await assertCellContents(driver, 0, 0, '4125698042');
    });

    it('is still there when typing is initiated', async function() {
      const values = ['432', '4.5', '7.9'];
      await clickCell(driver, 0, 0);
      await sendKeys(driver, values[0], Key.TAB, values[1], Key.TAB, values[2], Key.RETURN);
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
      await sendKeys(driver, Key.RETURN);
      await sendKeys(driver, Key.RETURN);
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

    it('can be got in a column', async function() {
      const values = [[3,4.3,6], [1,0.1,2], [9,9.4,7]];
      await init(driver, ['alpha', 'beta', 'gamma'], values);
      const col = 1;
      const column = await getColumn(driver, col);
      const expected = values.map(r => String(r[col]));
      assert.deepStrictEqual(column, expected);
    });

    it('can be got as a whole', async function () {
      const values = [[3, 4.3, 6], [1, 0.1, 2], [9, 9.4, 7]];
      await init(driver, ['alpha', 'beta', 'gamma'], values);
      const actual = await getCells(driver);
      const expected = values.map(r => r.map(c => String(c)));
      assert.deepStrictEqual(actual, expected);
    });

    it('can be cleared', async function () {
      const values = [[3, 4.3, 6], [1, 0.1, 2], [9, 9.4, 7]];
      const headers = ['alpha', 'beta', 'gamma'];
      await init(driver, headers, values);
      await clearData(driver);
      const actual = await getCells(driver);
      const expected = values.map(r => r.map(c => ''));
      assert.deepStrictEqual(actual, expected);
      const rc = await getRowCount(driver);
      assert.strictEqual(rc, values.length);
      const cc = await getColumnCount(driver);
      assert.strictEqual(cc, headers.length);
    });

    it('can have selection cleared', async function() {
      for (const key of [Key.DELETE, Key.BACK_SPACE]) {
        const values = [[3, 4.3, 6], [1, 0.1, 2], [9, 9.4, 7]];
        const headers = ['alpha', 'beta', 'gamma'];
        await init(driver, headers, values);
        await clickCell(driver, 0, 0);
        await sendKeys(driver, Key.SHIFT, Key.ARROW_RIGHT, Key.ARROW_DOWN, key);
        for (const r of [0,1]) {
          for (const c of [0,1]) {
            await assertCellContents(driver, r, c, '');
          }
        }
        for (const r of [0,1]) {
          await assertCellContents(driver, r, 2, values[r][2]);
        };
        for (const c of [0,2]) {
          await assertCellContents(driver, 2, c, values[2][c]);
        }
        }
    });

    describe('can be copied to the clipboard', function() {
      const rows = [['23.4', '43.1'], ['0.123', '55']];

      beforeEach(async function() {
        await putCells(driver, 0, 2, 0, 2, rows);
      });

      it('with keys', async function() {
        await clickCell(driver, 0, 0);
        await sendKeys(driver, Key.SHIFT, Key.RIGHT, Key.DOWN);
        await sendKeys(driver, Key.CONTROL, 'c');
      });

      it('with the mouse', async function() {
        await mouseDragCells(driver, [[0,0],[1,1]]);
        await cellMenuSelect(driver, 0, 1, 'copy');
      });

      afterEach(async function() {
        const copied = clipboardy.readSync();
        const expected = cellsToText(rows);
        assert.strictEqual(copied, expected, 'clipboard text did not match entered text after copy');
      });
    });

    describe('can be cut', function() {
      const rows = [['5.6', '12.8'], ['23', '99.01']];

      beforeEach(async function() {
        await putCells(driver, 0, 2, 0, 2, rows);
      });

      it('with keys', async function() {
        await clickCell(driver, 0, 0);
        await sendKeys(driver, Key.SHIFT, Key.RIGHT, Key.DOWN);
        await sendKeys(driver, Key.CONTROL, 'x');
      });

      it('with the mouse', async function() {
        await mouseDragCells(driver, [[1,1],[0,0]]);
        await cellMenuSelect(driver, 1, 0, 'cut');
      });

      afterEach(async function() {
        const copied = clipboardy.readSync();
        const expected = cellsToText(rows);
        assert.strictEqual(copied, expected, 'clipboard text did not match entered text after cut');
        await assertCellContents(driver, 0, 0, '');
        await assertCellContents(driver, 0, 1, '');
        await assertCellContents(driver, 1, 0, '');
        await assertCellContents(driver, 1, 1, '');
      });
    });

    describe('can be pasted', async function() {
      const rows = [['6', '48.3'], ['30', '12.1']];

      beforeEach(async function() {
        clipboardy.writeSync(cellsToText(rows));
      });

      it('with keys', async function() {
        await clickCell(driver, 0, 0);
        await sendKeys(driver, Key.CONTROL, 'v');
      });

      afterEach(async function() {
        const actual = await getCells(driver, 0, 2, 0, 2);
        assert.deepStrictEqual(actual, rows, 'cell text did not match pasted text');
      });
    });

    it('paste does not extend columns', async function() {
      const values = [[3,4.3,6], [1,0.1,2], [9,9.4,7]];
      const headers = ['alpha', 'beta', 'gamma'];
      await init(driver, headers, values);
      const cc = await getColumnCount(driver);
      const toPaste = [['1','2', '3']];
      clipboardy.writeSync(cellsToText(toPaste));
      const rowStart = 1;
      const columnStart = 2;
      await clickCell(driver, rowStart, columnStart);
      await sendKeys(driver, Key.CONTROL, 'v');
      const actual = await getCells(
        driver, rowStart, rowStart + toPaste.length, columnStart, headers.length
      );
      assert.deepStrictEqual(
        actual,
        toPaste.map(row => row.slice(0, toPaste[0].length - columnStart)),
        'cell text did not match pasted text'
      );
      const cc2 = await getColumnCount(driver);
      assert.strictEqual(cc2, cc, 'column count changes when pasting');
    });

    it('can be restored with undo and redo', async function() {
      const rows = [['23.4', '43.1'], ['0.123', '55']];
      await putCells(driver, 0, 2, 0, 2, rows);
      await clickCell(driver, 0, 0);
      const c0 = '654';
      await sendKeys(driver, c0);
      const c1 = '876';
      await clickCell(driver, 1, 1);
      await sendKeys(driver, c1, Key.TAB);
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, c1);
      await sendKeys(driver, Key.CONTROL, 'z');
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, rows[1][1]);
      await sendKeys(driver, Key.CONTROL, 'z');
      await assertCellContents(driver, 0, 0, rows[0][0]);
      await assertCellContents(driver, 1, 1, rows[1][1]);
      await sendKeys(driver, Key.CONTROL, Key.SHIFT, 'z');
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, rows[1][1]);
      await sendKeys(driver, Key.CONTROL, Key.SHIFT, 'z');
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, c1);
    });

    it('can undo input box typing', async function() {
      const rows = [['5.06']];
      await putCells(driver, 0, 1, 0, 1, rows);
      await clickCell(driver, 0, 0);
      const c0 = '654';
      await sendKeys(driver, c0);
      await sendKeys(driver, Key.CONTROL, 'z');
      await assertCellContents(driver, 0, 0, rows[0][0]);
      await sendKeys(driver, Key.CONTROL, Key.SHIFT, 'z');
      await assertCellContents(driver, 0, 0, c0);
      await sendKeys(driver, Key.CONTROL, 'z');
      await assertCellContents(driver, 0, 0, rows[0][0]);
    });

    it('withstands undo and redo off the end of the stacks', async function() {
      const rows = [['23.4', '43.1'], ['0.123', '55']];
      await putCells(driver, 0, 2, 0, 2, rows);
      await clearUndo(driver);
      await clickCell(driver, 0, 0);
      const c0 = '654';
      await sendKeys(driver, c0);
      const c1 = '876';
      await clickCell(driver, 1, 1);
      await sendKeys(driver, c1, Key.TAB);
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, c1);
      await sendKeys(driver, Key.CONTROL, 'z');
      await sendKeys(driver, Key.CONTROL, 'z');
      await sendKeys(driver, Key.CONTROL, 'z');
      await sendKeys(driver, Key.CONTROL, 'z');
      await sendKeys(driver, Key.CONTROL, 'z');
      await assertCellContents(driver, 0, 0, rows[0][0]);
      await assertCellContents(driver, 1, 1, rows[1][1]);
      await sendKeys(driver, Key.CONTROL, Key.SHIFT, 'z');
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, rows[1][1]);
      await sendKeys(driver, Key.CONTROL, Key.SHIFT, 'z');
      await sendKeys(driver, Key.CONTROL, Key.SHIFT, 'z');
      await sendKeys(driver, Key.CONTROL, Key.SHIFT, 'z');
      await sendKeys(driver, Key.CONTROL, Key.SHIFT, 'z');
      await sendKeys(driver, Key.CONTROL, Key.SHIFT, 'z');
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, c1);
      await sendKeys(driver, Key.CONTROL, 'z');
      await assertCellContents(driver, 0, 0, c0);
      await assertCellContents(driver, 1, 1, rows[1][1]);
    });
  });

  describe('column headers', function() {

    beforeEach(async function () {
      await doGet();
    });

    they('can be set via the API', async function() {
      const newRows = 5;
      const newHeaders = ['proton', 'neutron', 'electron', 'positron'];
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
      const ths = await driver.findElements(By.css('table#input thead tr.header th'));
      assert.strictEqual(ths.length, newHeaders.length + 1,
        'did not initialize with the correct number of column headers');
      for (let i = 0; i != rc; ++i) {
        const tds = await driver.findElements(By.css(`table#input tbody tr:nth-child(${i+1}) td`));
        assert.strictEqual(tds.length, newHeaders.length,
          `did not initialize row ${i} with the correct number cells`);
          await assertCellContents(driver, i, cc-1, '');
        }
    });

    they('can be read via the API', async function() {
      const headerss = [['one', 'two'], ['whiskey', 'x-ray', 'yankee', 'zulu']];
      for (let h = 0; h != headerss.length; ++h) {
        const headers = headerss[h];
        await init(driver, headers, 5);
        let actualHeaders = await readHeaders(driver);
        assert.deepStrictEqual(actualHeaders, headers);
        const apiHeaders = await getColumnHeaders(driver);
        assert.deepStrictEqual(apiHeaders, headers);
      }
    });

    they('can be set automatically when requesting flexible columns', async function() {
      this.timeout(3000);
      const columnCount = 60;
      await init(driver, columnCount, 3);
      const actualHeaders = await readHeaders(driver);
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const headers = [];
      for(let i = 0; i != columnCount; ++i) {
        const a = i < 26? '' : alphabet[Math.floor(i / 26) - 1];
        const b = alphabet[i % 26];
        headers.push(a.concat(b));
      }
      assert.deepStrictEqual(actualHeaders, headers);
    });

    they('do not permit column addition or deletion if inflexible', async function() {
      await asyncForEach([
        {headers: ['in', 'flexy', 'ball'], expectedElements: 0},
        {headers: 3, expectedElements: 1}
      ], async function({headers, expectedElements}) {
        await init(driver, headers, 3);
        await cellRightClick(driver, 1, 1);
        await asyncForEach([
          'column-delete', 'column-add-before', 'column-add-after'
        ], async function(option) {
          const optionElements = await driver.findElements(
            contextMenuLocator(option));
          assert.strictEqual(optionElements.length, expectedElements);
        });
      });
    });

    they('keep the same when columns deleted', async function() {
      await init(driver, 5, 3);
      await dragColumnHeaders(driver, 2, 3);
      await columnHeaderRightClick(driver, 3);
      await contextMenuSelect(driver, 'column-delete');
      const headers = await getColumnHeaders(driver);
      assert.deepStrictEqual(headers, ['A', 'B', 'C']);
    });

    they('are correct when columns are added in the middle', async function() {
      await init(driver, 5, 3);
      await dragColumnHeaders(driver, 2, 3);
      await columnHeaderRightClick(driver, 3);
      await contextMenuSelect(driver, 'column-add-before');
      const headers = await getColumnHeaders(driver);
      assert.deepStrictEqual(headers, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    });
  });

  describe('subheaders', function() {

    beforeEach(async function () {
      await doGet();
    });

    they('default to the first option', async function() {
      // unfortunately executeScript scrambles object argument's key orders
      // so we have to set the object as part of the script.
      await driver.executeScript(
        'window.dataEntryGrid.init(["a","b","c"], 5, ['
        +'{"salpha": "alpha", "sbeta": "beta"},'
        +'{"sgamma": "gamma", "sdelta": "delta"},'
        +'{"sepsilon": "epsilon", "szeta": "zeta"}]);');
      assert.deepStrictEqual(await getSubheaders(driver), [
        'salpha', 'sgamma', 'sepsilon'
      ]);
    });

    they('honour defaults', async function() {
      const defaults = ['salpha', 'sdelta', 'szeta'];
      await init(driver, ['one', 'two', 'three'], 5, [
        {'salpha': 'alpha', 'sbeta': 'beta'},
        {'sgamma': 'gamma', 'sdelta': 'delta'},
        {'sepsilon': 'epsilon', 'szeta': 'zeta'},
      ], defaults);
      assert.deepStrictEqual(await getSubheaders(driver), defaults);
    });

    they('allow clicks', async function() {
      await init(driver, ['one', 'two', 'three'], 5, [
        { 'subheader-alpha': 'alpha', 'subheader-beta': 'beta' },
        null, null
      ]);
      await driver.findElement(By.css('.subheader select')).click();
      await driver.findElement(By.css('option[value="subheader-beta"]')).click();
    });

    they('allow tooltips to be set', async function() {
      await init(driver, ['one', 'two', 'three'], 5, [
        { 'subheader-alpha': 'alpha', 'subheader-beta': 'beta' },
        null, null
      ]);
      const expected = 'Tooltip one';
      await driver.executeScript(
        `window.dataEntryGrid.setSubheaderTooltip(0, "${expected}");`);
      const actual = await driver.findElement(By.css('.subheader select')).getAttribute('title');
      assert.strictEqual(actual, expected);
    });

    they('allow option tooltips to be set', async function() {
      const option = 'subheader-beta';
      await init(driver, ['one', 'two', 'three'], 5, [
        { 'subheader-alpha': 'alpha', [option]: 'beta' },
        null, null
      ]);
      const expected = 'Tooltip beta';
      await driver.executeScript(
        `window.dataEntryGrid.setSubheaderOptionTooltip(0, "${option}", "${expected}");`);
      const actual = await driver.findElement(By.css(`.subheader select option[value="${option}"]`)).getAttribute('title');
      assert.strictEqual(actual, expected);
    });

    they('allow a function to alter the column', async function() {
      this.timeout(4000);
      await driver.executeScript(
        'window.dataEntryGrid.init(["length","width"], ['
        + '[50.8, 130],'
        + '[-965.2, 508],'
        +'], ['
        +'{"mm": "millimeters", "in": "inches"},'
        +'{"mm": "millimeters", "in": "inches"}]);'
        +'window.dataEntryGrid.setReunittingFunction(function(i,ov,nv,vs){'
        + 'var f={"mm":{"mm":function(x){return x;},"in":function(x){return x/25.4;}},'
        +  '"in":{"in":function(x){return x;},"mm":function(x){return x*25.4;}}};'
        + 'return vs.map(f[ov][nv]);'
        +'});'
      );
      const values = [[50.8, 130], [-965.2, 508]];
      await assertCellsFloat(driver, 0, 0, values);
      const select = await driver.findElement(By.css('.subheader select'));
      select.click();
      await driver.findElement(By.css('option[value="in"]')).click();
      const mixedValues = [[2.0, 130], [-38.0, 508]];
      await assertCellsFloat(driver, 0, 0, mixedValues);
      const undoButton = await driver.findElement(By.id('undo'));
      await undoButton.click();
      await assertCellsFloat(driver, 0, 0, values);
      assert.strictEqual(await select.getAttribute('value'), 'mm');
      const redoButton = await driver.findElement(By.id('redo'));
      await redoButton.click();
      await assertCellsFloat(driver, 0, 0, mixedValues);
      assert.strictEqual(await select.getAttribute('value'), 'in');
      select.click();
      await driver.findElement(By.css('option[value="mm"]')).click();
      await assertCellsFloat(driver, 0, 0, values);
      select.click();
      await driver.findElement(By.css('option[value="mm"]')).click();
      await assertCellsFloat(driver, 0, 0, values);
      await undoButton.click();
      await assertCellsFloat(driver, 0, 0, mixedValues);
      assert.strictEqual(await select.getAttribute('value'), 'in');
    });
  });

  describe('rows', function() {

    beforeEach(async function () {
      await doGet();
    });

    they('can be added in bulk', async function() {
      const totalRows = 6;
      await extendRows(driver, totalRows);
      assert.strictEqual(await getRowCount(driver), totalRows);
    });

    they('can be added', async function() {
      const rc = await getRowCount(driver);
      const contents = '32.1';
      await sendKeys(driver, contents);
      await rowHeaderMenuSelect(driver, 0, 'add-before');
      const rc2 = await getRowCount(driver);
      assert.strictEqual(rc2, rc + 1,
        'row count (from API) does not increase when adding a row before');
      await assertCellContents(driver, 1, 0, contents);
      await assertCellContents(driver, 0, 0, '');
      await clickCell(driver, 0, 0);
      await sendKeys(driver, Key.SHIFT, Key.ARROW_DOWN);
      await rowHeaderMenuSelect(driver, 1, 'add-after');
      const rc3 = await getRowCount(driver);
      assert.strictEqual(rc3, rc2 + 2,
        'row count (from API) does not increase by 2 when adding a row after');
      await assertCellContents(driver, 1, 0, contents);
      await assertCellContents(driver, 2, 0, '');
      await assertCellContents(driver, 3, 0, '');
    });

    they('can be deleted', async function() {
      // ensure we have at least four rows
      await clickCell(driver, 0, 0);
      await repeatKey(driver, 4, Key.RETURN);
      const rows = [['43'], ['509'], ['15'], ['88']];
      await putCells(driver, 0, 4, 0, 1, rows);
      const rc = await getRowCount(driver);
      await clickCell(driver, 1, 1);
      await sendKeys(driver, Key.SHIFT, Key.ARROW_DOWN);
      await rowHeaderMenuSelect(driver, 1, 'delete');
      const rc2 = await getRowCount(driver);
      assert.strictEqual(rc2, rc - 2,
        'row count (from API) does not decrease by 2 when deleting a row');
      await assertCellContents(driver, 0, 0, rows[0][0]);
      await assertCellContents(driver, 1, 0, rows[3][0]);
    });

    they('are automatically added as required', async function() {
      const rc = await getRowCount(driver);
      await clickCell(driver, rc - 1, 0);
      const firstContents = '123';
      const secondContents = '456';
      await sendKeys(driver, firstContents, Key.RETURN, secondContents);
      const rc2 = await getRowCount(driver);
      assert.strictEqual(rc2, rc+1,
        'row count (from API) does not increase when typing off the bottom row');
      await assertCellContents(driver, rc - 1, 0, firstContents);
      await assertCellContents(driver, rc, 0, secondContents);
    });

    it('the last one cannot be deleted', async function() {
      const values = [[7.7, 6.6, 5.5], [9.9, 8.8, 1.1]];
      const headers = ['alpha', 'beta', 'gamma'];
      await init(driver, headers, values);
      await mouseDragCells(driver, [[0,0], [1,2]]);
      await rowHeaderRightClick(driver, 0);
      const option = await driver.findElement(By.css('option[value="delete"]'));
      const disabled = await option.getAttribute('disabled');
      assert(disabled, 'row delete option should be disabled');
    });
  });

  describe('columns', function() {

    const headers = ['red', 'green', 'blue'];
    const values = [[1.2, 2.3, 3.4], [6.1, 7.2, 8.3], [3.3, 4.3, 5.3]];

    beforeEach(async function () {
      await doGet();
      await init(driver, headers, values);
    });

    they('can be set and got by index', async function() {
      const cols = [
        [1.1, 2.2, 3.3],
        [4.4],
        [5.5, 6.6]
      ];
      await driver.executeScript(
        'var c=arguments[0];window.dataEntryGrid.setColumnArray(c);',
        cols
      );
      for (let c = 0; c !== cols.length; ++c) {
        const col = cols[c];
        for (let r = 0; r !== 3; ++r) {
          const v = r < col.length? '' + col[r] : '';
          await assertCellContents(driver, r, c, v);
        }
      }
      const actual = await driver.executeScript(
        'return window.dataEntryGrid.getColumnArray();'
      );
      // expected columns have numbers converted to strings and are
      // padded with empty strings.
      const expected = cols.map(col => {
        let r = col.map(String);
        while (r.length < 3) {
          r.push('');
        }
        return r;
      });
      assert.deepStrictEqual(actual, expected);
      const actual02 = await driver.executeScript(
        'return window.dataEntryGrid.getColumns([0,2]);'
      );
      assert.deepStrictEqual(actual02[0], expected[0]);
      assert(!(1 in actual02));
      assert.deepStrictEqual(actual02[2], expected[2]);
    });

    // Check for regression where a zero-row table could have columns added
    // to it but it would result in the selection being broken and no input being
    // able to be made.
    they('do not break selection when added to zero rows', async function() {
      const cols = [
        [1.1, 2.2],
        [4.4]
      ];
      const cell = 3.3;
      await driver.executeScript(
        'var g=window.dataEntryGrid,c=arguments[0];g.init(["a","b"],[[]]);g.setColumnArray(c);',
        cols
      );
      await clickCell(driver, 0, 0);
      await sendKeys(driver, cell, Key.RETURN);
      await assertCellContents(driver, 0, 0, cell);
    });

    they('can be set and got by header', async function() {
      const cols = {
        blue: [1.1, 2.2, 3.3],
        red: [5.5, 6.6],
        pink: [10, 20, 30]
      };
      await driver.executeScript(
        'var c=arguments[0];window.dataEntryGrid.setColumns(c);',
        cols
      );
      for (let c = 0; c !== 3; ++c) {
        const h = headers[c];
        const col = h in cols? cols[h] : null;
        for (let r = 0; r !== 3; ++r) {
          const v = col == null?
            ('' + values[r][c])
            : (r < col.length? '' + col[r] : '');
          await assertCellContents(driver, r, c, v);
        }
      }
      const actualRed = await driver.executeScript(
        'return window.dataEntryGrid.getColumns(["red", "pink"]);'
      );
      assert(!("blue" in actualRed));
      // pink should not be set because there is no "pink" column:
      // setColumns never creates new columns.
      assert(!("pink" in actualRed));
      assert.deepStrictEqual(actualRed['red'], ['5.5', '6.6', '']);
    });

    they('can be extended', async function() {
      const cols = {
        blue: [1.1, 2.2, 3.3, 4.4, 5.5],
      };
      await driver.executeScript(
        'var c=arguments[0];window.dataEntryGrid.setColumns(c);',
        cols
      );
      for (let c = 0; c !== 3; ++c) {
        const h = headers[c];
        const col = h in cols? cols[h] : null;
        for (let r = 0; r !== 5; ++r) {
          const v = col == null?
            (r < values.length? '' + values[r][c] : '')
            : (r < col.length? '' + col[r] : '');
          await assertCellContents(driver, r, c, v);
        }
      }
    });

    they('can be reduced when all set', async function() {
      const cols = [
        [1.1, 2.2],
        [4.4],
        [5.5]
      ];
      await driver.executeScript(
        'var c=arguments[0];window.dataEntryGrid.setColumnArray(c);',
        cols
      );
      const expectedRowCount = cols.reduce(
        (n, c) => { return Math.max(n, c.length); },
        0
      );
      const rc = await getRowCount(driver);
      assert.strictEqual(rc, expectedRowCount);
      for (let c = 0; c !== cols.length; ++c) {
        const col = cols[c];
        for (let r = 0; r !== 2; ++r) {
          const v = r < col.length? '' + col[r] : '';
          await assertCellContents(driver, r, c, v);
        }
      }
    });
  });

  describe('rigid rows', function() {
    const data = [
      ['12', '2', '34'],
      ['0.4', '3.2', '1.1'],
      ['50', '51', '52.2']
    ];
    const rowHeaders = ['alef', 'bet', 'gimel'];

    beforeEach(async function() {
      await doGet();
      await init(driver, ['alpha', 'beta', 'gamma'], rowHeaders);
    });

    it('Row names are as specified', async function() {
      const rhs = await getRowHeaders(driver);
      assert.deepStrictEqual(rhs, rowHeaders);
    });

    it('No new rows appear when pressing return on the last line', async function() {
      const rc = await getRowCount(driver);
      await clickCell(driver, rc - 1, 0);
      const firstContents = '123';
      const secondContents = '456';
      await sendKeys(driver, firstContents, Key.RETURN, secondContents);
      const rc2 = await getRowCount(driver);
      assert.strictEqual(rc2, rc,
        'row count changes when typing off the bottom row');
      await assertCellContents(driver, rc - 1, 0, secondContents);
    });

    it('does not allow adding rows from the row header context menu', async function() {
      await rowHeaderRightClick(driver, 1);
      const cmcs = await contextMenuContents(driver);
      cmcs.sort();
      assert.deepStrictEqual(cmcs, ['copy', 'cut']);
    });

    it('does not allow deleting rows from the context menu', async function() {
      await cellRightClick(driver, 1, 1);
      const cmcs = await contextMenuContents(driver);
      cmcs.sort();
      assert.deepStrictEqual(cmcs, ['copy', 'cut']);
    });

    it('paste does not extend rows', async function() {
      const rc = await getRowCount(driver);
      const toPaste = [['1','2'], ['3','4'], ['5','6']];
      clipboardy.writeSync(cellsToText(toPaste));
      const rowStart = 1;
      await clickCell(driver, rowStart, 0);
      await sendKeys(driver, Key.CONTROL, 'v');
      const actual = await getCells(driver, rowStart, toPaste.length, 0, 2);
      assert.deepStrictEqual(
        actual,
        toPaste.slice(0, toPaste.length - rowStart),
        'cell text did not match pasted text'
      );
      const rc2 = await getRowCount(driver);
      assert.strictEqual(rc2, rc, 'row count changes when pasting');
    });

    it('setting by header does not add rows', async function() {
      const rc = await getRowCount(driver);
      const cols = {
        beta: ['1.1', '2.2', '3.3', '4.4']
      };
      await driver.executeScript(
        'var c=arguments[0];window.dataEntryGrid.setColumns(c);',
        cols
      );
      const actualM = await getCells(driver, 0, data.length, 1, 2);
      const actual = actualM.map(a => a[0]);
      assert.deepEqual(actual, cols.beta.slice(0,data.length));
      const rc2 = await getRowCount(driver);
      assert.strictEqual(rc2, rc, 'row count changes when setting columns');
    });

    it('setting column array does not add rows', async function() {
      const rc = await getRowCount(driver);
      const cols = [
        ['1.01', '2.02', '3.03', '4.04'],
        ['1.11', '2.12', '3.13', '4.14'],
        ['1.21', '2.22', '3.23', '4.24']
      ]
      await driver.executeScript(
        'var c=arguments[0];window.dataEntryGrid.setColumnArray(c);',
        cols
      );
      const actual = await getCells(driver, 0, data.length, 0, cols.length);
      let expected = [];
      for (var r = 0; r != data.length; ++r) {
        let row = [];
        for (var c = 0; c != cols.length; ++c) {
          row.push(cols[c][r]);
        }
        expected.push(row);
      }
      assert.deepEqual(actual, expected);
      const rc2 = await getRowCount(driver);
      assert.strictEqual(rc2, rc, 'row count changes when setting columns');
    });
  });

  describe('flexible columns', function() {
    const data = [
      ['12', '2', '34', '4', '56'],
      ['0.4', '3.2', '1.1', '6.5', '4.4']
    ];

    beforeEach(async function() {
      await doGet();
      await init(driver, 5, data);
    });

    it('can be added', async function() {
      const cc = await getColumnCount(driver);
      await columnHeaderMenuSelect(driver, 3, 'column-add-before');
      const cc2 = await getColumnCount(driver);
      assert.strictEqual(cc2, cc + 1,
        'row count (from API) does not increase when adding a column before');
      await assertCellContents(driver, 1, 2, data[1][2]);
      await assertCellContents(driver, 1, 3, '');
      await assertCellContents(driver, 1, 4, data[1][3]);
      await clickCell(driver, 0, 0);
      await sendKeys(driver, Key.SHIFT, Key.ARROW_RIGHT);
      await columnHeaderMenuSelect(driver, 1, 'column-add-after');
      const cc3 = await getColumnCount(driver);
      assert.strictEqual(cc3, cc2 + 2,
        'row count (from API) does not increase by 2 when adding a column after');
      await assertCellContents(driver, 0, 1, data[0][1]);
      await assertCellContents(driver, 0, 2, '');
      await assertCellContents(driver, 0, 3, '');
      await assertCellContents(driver, 0, 4, data[0][2]);
    });

    it('can be deleted', async function() {
      const cc = await getColumnCount(driver);
      await clickCell(driver, 1, 4);
      await columnHeaderMenuSelect(driver, 3, 'column-delete');
      const cc2 = await getColumnCount(driver);
      assert.strictEqual(cc2, cc - 1,
        'row count (from API) does not decrease when deleting a column');
      await assertCellContents(driver, 1, 2, data[1][2]);
      await assertCellContents(driver, 1, 3, data[1][4]);
      await clickCell(driver, 0, 0);
      await sendKeys(driver, Key.SHIFT, Key.ARROW_RIGHT);
      await columnHeaderMenuSelect(driver, 1, 'column-delete');
      const cc3 = await getColumnCount(driver);
      assert.strictEqual(cc3, cc2 - 2,
        'row count (from API) does not decrease by 2 when deleting two columns');
      await assertCellContents(driver, 0, 0, data[0][2]);
      await assertCellContents(driver, 0, 1, data[0][4]);
    });

    it('the last one cannot be deleted', async function() {
      const values = [[11, 77], [88, 44], [33,66]];
      await init(driver, 2, values);
      await mouseDragCells(driver, [[0,0], [2,1]]);
      await columnHeaderRightClick(driver, 0);
      const option = await driver.findElement(By.css('option[value="column-delete"]'));
      const disabled = await option.getAttribute('disabled');
      assert(disabled, 'column delete option should be disabled');
    });

    they('can be extended with paste', async function() {
      const values = [[3,4.3,6], [1,0.1,2], [9,9.4,7]];
      const columnCount = 3;
      await init(driver, columnCount, values);
      const toPaste = [['1','2', '3']];
      clipboardy.writeSync(cellsToText(toPaste));
      const rowStart = 1;
      const columnStart = columnCount - 1;
      await clickCell(driver, rowStart, columnStart);
      await sendKeys(driver, Key.CONTROL, 'v');
      const actual = await getCells(
        driver,
        rowStart,
        rowStart + toPaste.length,
        columnStart,
        columnStart + toPaste[0].length
      );
      assert.deepStrictEqual(
        actual,
        toPaste,
        'cell text did not match pasted text'
      );
      const cc2 = await getColumnCount(driver);
      assert.strictEqual(
        cc2,
        columnStart + toPaste[0].length,
        'column count changes to wrong value when pasting'
      );
    });
  });

  describe('row header context menu', function() {

    beforeEach(async function () {
      await doGet();
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
        await rowHeaderRightClick(driver, 1);
        const deleteText = await driver.findElement(contextMenuLocator('delete')).getText();
        assert.strictEqual(deleteText, text[i].deleteRow);
        const beforeText = await driver.findElement(contextMenuLocator('add-before')).getText();
        assert.strictEqual(beforeText, text[i].addRowBefore);
        const afterText = await driver.findElement(contextMenuLocator('add-after')).getText();
        assert.strictEqual(afterText, text[i].addRowAfter);
        await clickCell(driver, 0, 0);
      }
    });
  });

  describe('control buttons', function() {
    this.timeout(5000);

    beforeEach(async function () {
      await doGet();
    });

    they('can be set', async function() {
      const undoButton = await driver.findElement(By.id('undo'));
      const redoButton = await driver.findElement(By.id('redo'));
      await setButtons(driver, undoButton, redoButton);
      const rows = [['55.5', '66.6'], ['77.7', '88.8']];
      await putCells(driver, 0, 2, 0, 2, rows);
      const c1 = '672';
      await clickCell(driver, 1, 1);
      await sendKeys(driver, c1, Key.TAB);
      await assertCellContents(driver, 0, 0, rows[0][0]);
      await assertCellContents(driver, 1, 1, c1);
      await undoButton.click();
      await assertCellContents(driver, 0, 0, rows[0][0]);
      await assertCellContents(driver, 1, 1, rows[1][1]);
      await redoButton.click();
      await assertCellContents(driver, 0, 0, rows[0][0]);
      await assertCellContents(driver, 1, 1, c1);
    });

    they('get disabled appropriately', async function() {
      const undoButton = await driver.findElement(By.id('undo'));
      const redoButton = await driver.findElement(By.id('redo'));
      await setButtons(driver, undoButton, redoButton);
      await assertDisabled(driver, 'undo');
      await assertDisabled(driver, 'redo');
      const rows = [['55.5', '66.6'], ['77.7', '88.8']];
      await putCells(driver, 0, 2, 0, 2, rows);
      await clearUndo(driver);
      await assertDisabled(driver, 'undo');
      await assertDisabled(driver, 'redo');
      await clickCell(driver, 0, 0);
      const c0 = '143';
      await sendKeys(driver, c0, Key.RETURN);
      await assertEnabled(driver, 'undo');
      await assertDisabled(driver, 'redo');
      const c1 = '672';
      await clickCell(driver, 1, 1);
      await sendKeys(driver, c1, Key.TAB);
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

  describe('focus', function() {

    beforeEach(async function() {
      await doGet();
      await driver.findElement(By.id('other')).click();
    });

    afterEach(async function() {
      const text = '23';
      await sendKeys(driver, text, Key.RETURN);
      await assertCellContents(driver, 0, 0, text);
    });

    it('returns with tab', async function() {
      await sendKeys(driver, Key.SHIFT, Key.TAB);
    });

    it('returns with click on table header', async function() {
      await driver.findElement(By.css('#input thead th:nth-child(1)')).click();
    });

    it('returns with click on column headers', async function() {
      await driver.findElement(By.css('#input thead th:nth-child(2)')).click();
    });

    it('returns with click on row headers', async function() {
      await driver.findElement(By.css('#input tbody th')).click();
    });
  });

  describe('scrolling', function () {
    let standardRows;
    let frame;
    let frameRect;

    before(function () {
      standardRows = [];
      for (let i = 0; i < 200; i += 5) {
        const row = [];
        for (let j = 1; j != 6; ++j) {
          row.push(i + j);
        }
        standardRows.push(row);
      }
    });

    beforeEach(async function() {
      await doGet("/test/deg-iframe.html");
      frame = await driver.findElement(By.id('deg-frame'));
      frameRect = await getBoundingRect(driver, frame);
      await init(driver, ['one', 'two', 'three', 'four', 'five', ''], standardRows);
    });

    it('is not affected by refocus', async function() {
      const scrollX = 10;
      const scrollY = 200;
      await setScroll(driver, frame, scrollX, scrollY);
      await clickCell(driver, 10, 1);
      await clickCell(driver, 11, 2);
      await assertScrollIsRoughly(driver, frame, scrollX, scrollY);
    });

    it('scrolls to follow selection', async function() {
      await setScroll(driver, frame, 10, 200);
      const startRow = 10;
      const startColumn = 1;
      await clickCell(driver, startRow, startColumn);
      const upCount = 5;
      const rightCount = 3;
      await sendKeys.apply(this, [driver, Key.SHIFT].concat(
        new Array(upCount).fill(Key.ARROW_UP), new Array(rightCount).fill(Key.ARROW_RIGHT)));
      // see if we have scrolled to one beyond where we selected to
      const cell = await getCell(driver, startRow - upCount - 1, startColumn + rightCount + 1);
      const cr = await getBoundingRect(driver, cell);
      assert(frameRect.right - 5 < cr.right && frameRect.right + 5,
        `right edge is ${cr.right}, not roughly ${frameRect.right}`);
      assert(frameRect.top - 5 < cr.top && frameRect.top + 5,
        `top edge is ${cr.top}, not roughly ${frameRect.top}`);
    });

    it('scrolls to follow mouse drag', async function() {
      this.timeout(5000);
      await setScroll(driver, frame, 10, 200);
      let element = await getCell(driver, 15, 1);
      await driver.actions({bridge: true}).move({origin: element}).press().perform();
      for (let i = 14; 0 <= i; --i) {
        element = await getCell(driver, i, 1);
        await driver.actions({bridge: true}).move({origin: element}).perform();
        const r = await getBoundingRect(driver, element);
        assert(frameRect.top <= r.top, `row ${i} should have been scrolled into view`);
      }
      await driver.actions({bridge: true}).release().perform();
    });

    it('stays scrolled after right-click', async function() {
      this.timeout(5000);
      await setScroll(driver, frame, 10, 200);
      let element1 = await getCell(driver, 19, 1);
      let element2 = await getCell(driver, 20, 3);
      await driver.actions({bridge: true})
        .move({origin: element1}).press()
        .move({origin: element2}).release()
        .contextClick(element1)
        .perform();
      const r = await getBoundingRect(driver, element2);
      assert(frameRect.top <= r.top, `row 20 should still be visible`);
    });
  });

  describe('watcher', function() {
    beforeEach(async function () {
      await doGet();
    });

    it('is called', async function() {
      await driver.executeScript(
        'window.watchCount = 0;' +
        'dataEntryGrid.addWatcher(function(){++window.watchCount;});');
      async function assertCount(n) {
        const actual = await driver.executeScript('return window.watchCount;');
        assert.strictEqual(actual, n, `watcher called ${actual} times not ${n}`);
      }
      await clickCell(driver, 0, 2);
      await assertCount(0);
      await sendKeys(driver, '456', Key.RETURN);
      await assertCount(1);
      await sendKeys(driver, Key.UP, Key.LEFT);
      await assertCount(1);
      await sendKeys(driver, Key.CONTROL, 'z');
      await assertCount(2);
      await sendKeys(driver, Key.CONTROL, Key.SHIFT, 'z');
      await assertCount(3);
      await rowHeaderMenuSelect(driver, 0, 'add-before');
      await assertCount(4);
    });
  });

  describe('computed formatting', function() {
    beforeEach(async function () {
      await doGet();
      await driver.executeScript(
        'dataEntryGrid.setFormattingFunction(function(r,c,v){return (r+c)==Number(v)?{error:false,tooltip:null}:{error:true,tooltip:"This is wrong"};});'
      );
      await init(driver, ['one', 'two', 'three'], [[0, 5, 2], [1, 2, 3]]);
    });

    it('is set on init', async function() {
      const e00 = await getCell(driver, 0, 0);
      const e01 = await getCell(driver, 0, 1);
      const e10 = await getCell(driver, 1, 0);
      const e11 = await getCell(driver, 1, 1);
      await assertHasNoClass(e00, 'error');
      await assertHasNoTitle(e00);
      await assertHasClass(e01, 'error');
      await assertHasTitle(e01, 'This is wrong');
      await assertHasNoClass(e10, 'error');
      await assertHasNoTitle(e10);
      await assertHasNoClass(e11, 'error');
      await assertHasNoTitle(e11);
    });

    it('is set on write', async function() {
      const e10 = await getCell(driver, 1, 0);
      await e10.click();
      await sendKeys(driver, '9', Key.ENTER);
      await assertHasClass(e10, 'error');
      await assertHasTitle(e10, 'This is wrong');
    });

    it('is unset on write', async function() {
      const e01 = await getCell(driver, 0, 1);
      await e01.click();
      await sendKeys(driver, '1', Key.ENTER);
      await assertHasNoClass(e01, 'error');
      await assertHasNoTitle(e01);
    });

    it('is set on column set', async function() {
      const cols = {
        two: [1, 0]
      };
      await driver.executeScript(
        'var c=arguments[0];window.dataEntryGrid.setColumns(c);',
        cols
      );
      const e10 = await getCell(driver, 1, 0);
      const e11 = await getCell(driver, 1, 1);
      await assertHasNoClass(e10);
      await assertHasClass(e11, 'error');
      await assertHasNoTitle(e10);
      await assertHasTitle(e11, 'This is wrong');
    });

    it('is set or reset on reunitting', async function() {
      this.timeout(4000);
      await driver.executeScript(
        'window.dataEntryGrid.init(["one","two"], ['
        + '[0, 1],'
        + '[0, 2],'
        +'], ['
        +'{"zero": "zero-based", "one": "one-based"},'
        +'{"zero": "zero-based", "one": "one-based"}]);'
        +'window.dataEntryGrid.setReunittingFunction(function(i,ov,nv,vs){'
        + 'if (ov=="zero" && nv == "one") {return(vs.map(v=>v+1));}'
        + 'if (ov=="one" && nv == "zero") {return(vs.map(v=>v-1));}'
        + 'return vs;'
        +'});'
      );
      const e00 = await getCell(driver, 0, 0);
      const e10 = await getCell(driver, 1, 0);
      await assertHasNoClass(e00);
      await assertHasClass(e10, 'error');
      await assertHasNoTitle(e00);
      await assertHasTitle(e10, 'This is wrong');
      const select = await driver.findElement(By.css('.subheader select'));
      select.click();
      await driver.findElement(By.css('option[value="one"]')).click();
      await assertHasClass(e00, 'error');
      await assertHasNoClass(e10);
      await assertHasTitle(e00, 'This is wrong');
      await assertHasNoTitle(e10);
    });
  });
});

async function asyncForEach(arr, fn) {
  for (let i = 0; i != arr.length; ++i) {
    await fn(arr[i]);
  }
}

async function asyncMap(arr, fn) {
  const r = [];
  for (let i = 0; i != arr.length; ++i) {
    r.push(await fn(arr[i]));
  }
  return r;
}

async function dragColumnHeaders(driver, startColumn, endColumn) {
  const startHeader = await columnHeaderElement(driver, startColumn);
  const endHeader = await columnHeaderElement(driver, endColumn);
  await driver.actions({ bridge: true })
    .move({ origin: startHeader }).press()
    .move({ origin: endHeader }).release().perform();
}

async function readHeaders(driver) {
  const ths = await driver.findElements(By.css('table#input thead tr.header th'));
  let actualHeaders = [];
  for (let i = 1; i < ths.length; ++i) {
    const e = await ths[i].getText();
    actualHeaders.push(e);
  }
  return actualHeaders;
}

async function setScroll(driver, element, x, y) {
  await driver.executeScript(`arguments[0].scrollTo(${x}, ${y});`, element);
}

async function assertScrollIsRoughly(driver, element, x, y, d=5) {
  const actualX = await getScrollX(driver, element);
  const actualY = await getScrollY(driver, element);
  assert(x-d < actualX && actualX < x+d && y-d < actualY && actualY < y+d,
    `actual scroll (${actualX},${actualY}) does not match expected (${x},${y})`);
}

async function getScrollX(driver, element) {
  return await driver.executeScript('return arguments[0].scrollLeft;', element);
}

async function getScrollY(driver, element) {
  return await driver.executeScript('return arguments[0].scrollTop;', element);
}

async function getBoundingRect(driver, element) {
  return await driver.executeScript(
    `var e = arguments[0];
    var r = e.getBoundingClientRect();
    var top = r.top + e.clientTop;
    var left = r.left + e.clientLeft;
    return {
      top: top,
      left: left,
      bottom: top + e.clientHeight,
      right: left + e.clientWidth,
    };`, element);
}

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

async function columnHeaderMenuSelect(driver, column, option) {
  await columnHeaderRightClick(driver, column);
  await contextMenuSelect(driver, option);
}

async function rowHeaderMenuSelect(driver, row, option) {
  await rowHeaderRightClick(driver, row);
  await contextMenuSelect(driver, option);
}

async function cellMenuSelect(driver, row, column, option) {
  await cellRightClick(driver, row, column);
  await contextMenuSelect(driver, option);
}

async function contextMenuSelect(driver, option) {
  const optionElement = await driver.findElement(
    contextMenuLocator(option));
  await driver.actions({ bridge: true })
    .move({ origin: optionElement })
    .click()
    .perform();
}

function contextMenuLocator(option) {
  return By.css(`#input #input-context-menu option[value='${option}']`);
}

async function contextMenuContents(driver) {
  const els = await driver.wait(async () =>
    driver.findElements(By.css('#input #input-context-menu option')));
  const vs = await asyncMap(els, function(el) {
    return el.getAttribute('value');
  });
  return vs;
}

async function columnHeaderElement(driver, column) {
  return await driver.findElement(
    By.css(`#input thead th:nth-child(${column + 2})`));
}

async function columnHeaderClick(driver, column) {
  const ch = await columnHeaderElement(driver, column);
  await driver.actions({ bridge: true }).click(ch).perform();
}

async function columnHeaderRightClick(driver, column) {
  const columnHeader = await columnHeaderElement(driver, column);
  await driver.actions({ bridge: true }).contextClick(columnHeader).perform();
}

async function rowHeaderClick(driver, row) {
  const rowHeader = await rowHeaderElement(driver, row);
  await driver.actions({ bridge: true }).click(rowHeader).perform();
}

async function rowHeaderRightClick(driver, row) {
  const rowHeader = await rowHeaderElement(driver, row);
  await driver.actions({ bridge: true }).contextClick(rowHeader).perform();
}

async function cellRightClick(driver, row, column) {
  const cell = await getCell(driver, row, column);
  await driver.actions({ bridge: true }).contextClick(cell).perform();
}

async function rowHeaderElement(driver, row) {
  return await driver.findElement(
    By.css(`#input tbody tr:nth-child(${row + 1}) th:nth-child(1)`));
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

async function assertRowHeaderText(driver, row, expected) {
  const rowHeader = await rowHeaderElement(driver, row);
  const actual = await getText(rowHeader);
  assert.strictEqual(actual, expected);
}

async function assertCellFloat(driver, row, column, expected) {
  const r = Number(row);
  const c = Number(column);
  // assert that the cell is reported as expected
  const rows = await getCells(driver, r, r + 1, c, c + 1);
  const actual = Number(rows[0][0]);
  const delta = (Math.abs(expected)+1e-9) * 0.0001;
  assert(expected - delta < actual && actual < expected + delta,
    `actual value ${actual} does not match expected value ${expected}`);
}

async function assertCellsFloat(driver, row, column, rows) {
  for (let i = 0; i !== rows.length; ++i) {
    let cells = rows[i];
    for (let j = 0; j !== cells.length; ++j) {
      await assertCellFloat(driver, row + i, column + j, cells[j]);
    }
  }
}

async function getText(cell) {
  const inputs = await cell.findElements(By.css('input'));
  if (inputs.length === 0) {
    return await cell.getText();
  }
  return await inputs[0].getAttribute('value');
}

async function repeatKey(driver, times, key, modifier) {
  const element = await focus(driver);
  modifier = modifier? [modifier] : [];
  await element.sendKeys.apply(element, modifier.concat(repeat(times, key)));
}

function repeat(times, x) {
  return Array(times).fill(x);
}

async function focus(driver) {
  return await driver.switchTo().activeElement();
}

async function sendKeys(driver, ...keys) {
  const element = await focus(driver);
  await element.sendKeys.apply(element, keys);
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
        await assertHasClass(cell, 'selected',
          '('+r+','+c+') should have been selected');
      }
      else {
        await assertHasNoClass(cell, 'selected',
          '('+r+','+c+') should not have been selected');
      }
      if (r === startRow && c === startColumn) {
        await assertHasClass(cell, 'anchor',
          '('+r+','+c+') should have been the anchor');
      }
      else {
        await assertHasNoClass(cell, 'anchor',
          '('+r+','+c+') should not have been the anchor');
      }
    }
  }
}

async function clickCell(driver, row, column) {
  const cell = await getCell(driver, row, column);
  await cell.click();
}

async function init(driver, headers, rows, subheaderSpecs, subheaderDefaults) {
  return await driver.executeScript(
      'window.dataEntryGrid.init(arguments[0], arguments[1], arguments[2], arguments[3]);',
      headers, rows, subheaderSpecs, subheaderDefaults);
}

async function extendRows(driver, rows) {
  return await driver.executeScript(
    'window.dataEntryGrid.extendRows(arguments[0]);', rows);
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

async function setSelection(driver, anchorRow, anchorColumn, selectionRow, selectionColumn) {
  return await driver.executeScript(`window.dataEntryGrid.setSelection(
    ${anchorRow}, ${anchorColumn}, ${selectionRow}, ${selectionColumn});`);
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

async function getColumn(driver, column) {
  return await driver.executeScript(
    `return window.dataEntryGrid.getColumn(${column});`);
}

async function putCells(driver, startRow, endRow, startColumn, endColumn, rows) {
  await driver.executeScript(
    `window.dataEntryGrid.putCells(${startRow}, ${endRow},
      ${startColumn}, ${endColumn}, ${JSON.stringify(rows)});`);
}

async function clearData(driver) {
  await driver.executeScript('window.dataEntryGrid.clearData()');
}

async function getSubheaders(driver) {
  return await driver.executeScript(
    'return window.dataEntryGrid.getSubheaders();');
}

async function getColumnHeaders(driver) {
  return await driver.executeScript('return window.dataEntryGrid.getColumnHeaders();');
}

async function getRowHeaders(driver) {
  return await driver.executeScript('return window.dataEntryGrid.getRowHeaders();');
}

async function mouseDragCells(driver, coords) {
  let [r,c] = coords[0];
  const element = getCell(driver, r, c);
  let actions = driver.actions({bridge: true}).move({origin: element}).press();
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

async function elementName(element) {
  const tag = await element.getTagName();
  const id = await element.getId();
  return id? `${tag} element ${id}` : `${tag} element`;
}

async function assertHasClass(element, c, message) {
  const cs = await element.getAttribute('class');
  if (cs && (' '+cs+' ').includes(c)) {
    return;
  }
  if (!message) {
    const name = await elementName(element);
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
    const name = await elementName(element);
    message = `${name} should not have the class ${c} (it has ${cs})`;
  }
  assert.fail(message);
}

async function assertHasTitle(element, t, message) {
  const a = await element.getAttribute('title');
  if (a && a === t) {
    return;
  }
  if (!message) {
    const name = await elementName(element);
    message = a? 
      `${name} does not have the title ${t} (it has ${a})`
      : `${name} does not have the title ${t} (it has no title)`;
  }
  assert.fail(message);
}

async function assertHasNoTitle(element, message) {
  const a = await element.getAttribute('title');
  if (!a) {
    return;
  }
  if (!message) {
    const name = await elementName(element);
    message = `${name} should have no title (it has ${a})`;
  }
  assert.fail(message);
}
