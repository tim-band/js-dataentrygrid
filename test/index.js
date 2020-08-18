"use strict";

const { describe, before, after, it } = require('mocha');
const assert = require('assert');
const { Builder, By, Key, until } = require('selenium-webdriver');
const http = require('http');
const fs = require('fs');
const { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } = require('constants');
const { exit } = require('process');

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
    this.timeout(5000);

    before(async function() {
      await driver.get("http://localhost:3004/dataentrygrid.html");
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
      const table = await getTable(driver);
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
      const table = await getTable(driver);
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

/*    it('gets extended with shift-arrows', async function() {
    });
    it('does not extend past the ends', async function() {
    });*/
  });

/*8  describe('cell content text', function() {
    it('is set with typing', async function() {
      // finish typing with return, highlight moves down
      // finish typing with tab, highlight moves right
      // finish typing with return again, highlight moves down and left
    });
    it('is still there when typing is initiated', async function() {
    });
    it('can be copied to the clipboard', async function() {
    });
    it('can be cut', async function() {
    });
    it('can be pasted', async function() {
    });
  });

  describe('top header', function() {
    it('can be set via the API', async function() {
    });
    it('can be read via the API', async function() {
    });
  });

  describe('left header', function() {
    it('can be set via the API', async function() {
    });
    it('can be read via the API', async function() {
    });
  });

  describe('rows', function() {
    it('can be deleted', async function() {
    });
    it('can be added', async function() {
    });
    it('are automatically added as required', async function() {
    });
  });

/*  describe('', function() {
    it('', async function() {
    });
    it('', async function() {
    });
    it('', async function() {
    });
  });*/
});

async function repeatKey(element, times, key) {
  await element.sendKeys.apply(element, repeat(times, key));
}

function repeat(times, x) {
  return Array(times).fill(x);
}

function getTable(driver) {
  return driver.findElement(By.id('input'));
}

async function checkSelection(driver, startRow, endRow, startColumn, endColumn) {
  // API selection
  const sel = await getSelection(driver);
  assert.equal(sel.anchorRow, startRow);
  assert.equal(sel.anchorColumn, startColumn);
  assert.equal(sel.selectionRow, endRow);
  assert.equal(sel.selectionColumn, endColumn);
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

async function mouseDragCells(driver, coords) {
  let [r,c] = coords[0];
  let sel = cellSelector(r,c);
  const element = getCell(driver, r, c);
  let actions = driver.actions().move({origin:element}).press();
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
