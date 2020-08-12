"use strict";

const { describe, before, after, it } = require('mocha');
const assert = require('assert');
const Browser = require('zombie');
const http = require('http');
const fs = require('fs');
const { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } = require('constants');

describe('dataentrygrid', function () {
  const browser = new Browser();
  let server = null;

  before(function (done) {
    server = http.createServer(function(req, resp) {
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
    }).listen(3004);
    browser.visit("http://localhost:3004/dataentrygrid.html", done);
  });

  it('does something', async function () {
    await browser.assert.text(".anchor", "1");
  });

  describe('highlight (visual and API)', function () {
    it('can be set with a mouse click', async function() {
      const row = 0;
      const column = 1;
      await browser.click(cellSelector(row, column));
      // visual selection
      browser.assert.hasClass(cellSelector(row, column), 'anchor');
      browser.assert.hasClass(cellSelector(row, column), 'selected');
      // API selection
      const sel = await getSelection(browser);
      assert.equal(sel.anchorRow, row);
      assert.equal(sel.anchorColumn, column);
      assert.equal(sel.selectionRow, row);
      assert.equal(sel.selectionColumn, column);
    });
    it('can be set with a mouse drag', async function() {
      const startRow = 1;
      const startColumn = 1;
      const endRow = 0;
      const endColumn = 2;
      await mouseDragCells(browser,
        [[startRow,startColumn], [0,1], [endRow,endColumn]]);
      // visual selection
      browser.assert.hasClass(cellSelector(1,1), 'anchor');
      const minR = Math.min(startRow, endRow);
      const maxR = Math.max(startRow, endRow);
      const minC = Math.min(startColumn, endColumn);
      const maxC = Math.max(startColumn, endColumn);
      for (let r = 0; r <= 1; ++r) {
        for (let c = 0; c <= 2; ++c) {
          if (minR <= r && r <= maxR && minC <= c && c <= maxC) {
            browser.assert.hasClass(cellSelector(r,c), 'selected');
          } else {
            browser.assert.hasNoClass(cellSelector(r,c), 'selected');
          }
          if (r === startRow && c === startColumn) {
            browser.assert.hasClass(cellSelector(r,c), 'anchor');
          } else {
            browser.assert.hasNoClass(cellSelector(r,c), 'anchor');
          }
        }
      }
      // API selection
      const sel = await getSelection(browser);
      assert.equal(sel.anchorRow, startRow);
      assert.equal(sel.anchorColumn, startColumn);
      assert.equal(sel.selectionRow, endRow);
      assert.equal(sel.selectionColumn, endColumn);
    });
    it('moves with the cursor keys', async function() {
    });
    it('does not move off the ends', async function() {
    });
    it('gets extended with shift-arrows', async function() {
    });
    it('does not extend past the ends', async function() {
    });
  });

  describe('cell content text', function() {
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

  after(function() {
    server.close();
  });
});

async function getSelection(browser) {
  const sel = await browser.evaluate('window.dataEntryGrid.getSelection();');
  // columns are zero-based but rows are one-based;
  // this should be corrected.
  sel.anchorRow -= 1;
  sel.selectionRow -= 1;
  return sel;
}

async function mouseDragCells(browser, coords) {
  const mouseDownEvent = new browser.window.MouseEvent('mousedown', {
    button: 0, buttons: 1, bubbles: true, cancelable: true, detail: 0});
  const mouseUpEvent = new browser.window.MouseEvent('mouseup', {
    button: 0, buttons: 1, bubbles: true, cancelable: true, detail: 0});
  const mouseEnterEvent = new browser.window.MouseEvent('mouseenter', {
    buttons: 1, bubbles: true, cancelable: true, detail: 0});
  const mouseLeaveEvent = new browser.window.MouseEvent('mouseleave', {
    buttons: 1, bubbles: true, cancelable: true, detail: 0});
  let [r,c] = coords[0];
  let sel = cellSelector(r,c);
  let element = browser.querySelector(sel);
  await browser.fire(sel, 'mouseenter');
  await element.dispatchEvent(mouseDownEvent);
  await browser.fire(sel, 'click');
  for (let i = 1; i != coords.length; ++i) {
    [r,c] = coords[i];
    await element.dispatchEvent(mouseLeaveEvent);
    sel = cellSelector(r,c);
    element = browser.querySelector(sel);
    await element.dispatchEvent(mouseEnterEvent);
  }
  await element.dispatchEvent(mouseUpEvent);
}

function cellSelector(row, column) {
  return `#input tbody tr:nth-child(${row + 1}) td:nth-child(${column + 2})`;
}
