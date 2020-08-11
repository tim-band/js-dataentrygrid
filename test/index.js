"use strict";

const { describe, before, after, it } = require('mocha');
const assert = require("assert");
const Browser = require("zombie");
const http = require("http");
const fs = require('fs');

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

  after(function() {
    server.close();
  });
});
