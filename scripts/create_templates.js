#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const
fs = require("fs"),
path = require('path'),
templates = require('../lib/templates'),
cachify = require('connect-cachify'),
config = require('../lib/configuration');

cachify.setup({}, {
  prefix: config.get('cachify_prefix'),
  root: path.join(__dirname, '../resources/static')
});

var existsSync = fs.existsSync || path.existsSync;
var dir = process.env.TEMPLATE_DIR || process.cwd();
var output_dir = process.env.BUILD_DIR || dir;
var outputFile = path.join(output_dir, "templates.js");

function generateTemplates() {
  var lastGen = existsSync(outputFile) ? fs.statSync(outputFile).mtime : 0;
  var templateData = templates.generate(dir, null, lastGen);
  if (templateData) {
    // no data most likely means we're already up-to-date
    fs.writeFileSync(path.join(output_dir, "templates.js"), templateData, "utf8");
  }
};

// run or export the function
if (process.argv[1] === __filename) generateTemplates();
else module.exports = generateTemplates;
