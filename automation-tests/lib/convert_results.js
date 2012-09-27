#!/usr/bin/env node
/*
 * Converts html reports into nice, machine readable JSON
 * Run: $ ./convert_result.js result/index.html
 */

const fs         = require('fs'),
      path       = require('path'),
      jsonselect = require('JSONSelect'),
      htmlparser = require('htmlparser');


function main (args) {
  var file = fs.readFile(path.resolve(args[2]), "utf8", function (err, html) {
    if (err) throw err;
    parseReport(html);
  });
}

function parseReport (html) {
  var report = {};
  var handler = new htmlparser.DefaultHandler(function(err, dom) {
    if (err) {
      console.error("Error: " + err);
    } else {
      var results = jsonselect.match(':has(:root > .attribs > .id:val("results")) .children :has(:root > .name:val("tr"))', dom);

      // remove header row
      results.shift();

      results.forEach(function (node, i, array) {
        var url;
        var result = node.children[1].attribs.class;

        // skip traceback rows
        if (!result) return;

        try {
          url = result === 'error' ?
                  findJobUrl(array[i+1].children[1].children[1].children) :
                  node.children[9].children[0].attribs.href;
        } catch (e) {
          url = '';
        }

        var name = node.children[5].children[0].data;

        report[name] = {
          success: result === 'passed',
          class: node.children[3].children[0].data,
          duration: node.children[7].children[0].data,
          url: url
        };
      });
    }
  });

  var parser = new htmlparser.Parser(handler);
  parser.parseComplete(html);
  return report;
}

// extract saucelab url from error report
function findJobUrl (children) {
  var result;
  children.forEach(function (node) {
    var match = node.raw.match(/https:\/\/saucelabs.com\/jobs\/[a-f0-9]+/);
    if (match) result = match[0];
  });
  return result;
}

exports.parseReport = parseReport;

if (process.argv[1] === __filename) main(process.argv);
