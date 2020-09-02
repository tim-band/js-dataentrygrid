"use strict";

const { describe, before, after, it } = require('mocha');
const assert = require('assert');
const { Builder, By, Key, until } = require('selenium-webdriver');
const http = require('http');
const fs = require('fs');
const clipboardy = require("clipboardy");

describe('dataentrygrid', function () {
  let server = null;
  let driver = null;

  before(async function () {
    server = await http.createServer(function(req, resp) {
      fs.readFile("./test" + req.url, function(error, content) {
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
    this.timeout(5000);

    before(async function() {
      await driver.get("http://localhost:3004/dataentrygrid.html");
      table = await getTable(driver);
    })

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
      await driver.get("http://localhost:3004/dataentrygrid.html");
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
      assert.deepEqual(actual, rows, 'cell text did not match pasted text');
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
    it('can be set via the API', async function() {
      assert.fail();
    });

    it('can be read via the API', async function() {
      const headers = await getColumnHeaders(driver);
      assert.deepEqual(headers, ['One', 'Two', 'Three']);
    });
  });

  describe('rows', function() {
    let table = null;

    before(async function () {
      await driver.get("http://localhost:3004/dataentrygrid.html");
      table = await getTable(driver);
    });

    it('can be added', async function() {
      const rc = await getRowCount(driver);
      await clickCell(driver, 0, 0);
      const contents = '32.1';
      table.sendKeys(contents);
      await rowHeaderClick(driver, 0, 'add-before');
      const rc2 = await getRowCount(driver);
      assert.strictEqual(rc2, rc + 1,
        'row count (from API) does not increase when adding a row before');
      await assertCellContents(driver, 1, 0, contents);
      await assertCellContents(driver, 0, 0, '');
      await clickCell(driver, 0, 0);
      table.sendKeys(Key.SHIFT, Key.ARROW_DOWN);
      await rowHeaderClick(driver, 1, 'add-after');
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
      await rowHeaderClick(driver, 1, 'delete');
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
    it('can have its option text set', async function() {
      assert.fail();
    });
  });

  describe('control buttons', function() {
    it('can be set', function() {
      assert.fail();
    });

    it('get disabled appropriately', function() {
      assert.fail();
    });
  });
});

async function rowHeaderClick(driver, row, option) {
  const rowHeader = await driver.findElement(
    By.css(`#input tbody tr:nth-child(${row + 1}) th:nth-child(1)`));
  await driver.actions({bridge: true}).contextClick(rowHeader).perform();
  const optionElement = await driver.findElement(
    By.css(`#input #input-row-menu option[value='${option}']`));
  await driver.actions({bridge: true})
      .move({origin: optionElement})
      .click()
      .perform();
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
  const inputs = await cell.findElements(By.tagName('input'));
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
  assert.deepEqual(sel, expected, `${name} failed`);
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

async function clearUndo(driver) {
  return await driver.executeScript('return window.dataEntryGrid.clearUndo();');
}

async function getSelection(driver) {
  const sel = await driver.executeScript('return window.dataEntryGrid.getSelection();');
  // columns are zero-based but rows are one-based;
  // this should be corrected.
  sel.anchorRow -= 1;
  sel.selectionRow -= 1;
  return sel;
}

async function getRowCount(driver) {
  // columns are zero-based but rows are one-based;
  // this should be corrected.
  return await driver.executeScript('return window.dataEntryGrid.rowCount();') - 1;
}

async function getColumnCount(driver) {
  return await driver.executeScript('return window.dataEntryGrid.columnCount();');
}

async function getCells(driver, startRow, endRow, startColumn, endColumn) {
  // columns are zero-based but rows are one-based;
  // this should be corrected.
  return await driver.executeScript(
    `return window.dataEntryGrid.getCells(${startRow+1}, ${endRow+1},
      ${startColumn}, ${endColumn});`);
}

async function putCells(driver, startRow, endRow, startColumn, endColumn, rows) {
  // columns are zero-based but rows are one-based;
  // this should be corrected.
  await driver.executeScript(
    `window.dataEntryGrid.putCells(${startRow+1}, ${endRow+1},
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
