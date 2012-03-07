#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const
fs = require("fs"),
path = require('path');

var dir = process.env.TEMPLATE_DIR || process.cwd();
var output_dir = process.env.BUILD_DIR || dir;

var templates = {};

function generateTemplates() {
  var fileNames = fs.readdirSync(dir)

  // is a regen even neccesary?
  try {
    var lastGen = fs.statSync(path.join(output_dir, "templates.js")).mtime;
    for (var i = 0; i < fileNames.length; i++) {
      if (lastGen < fs.statSync(path.join(dir, fileNames[i])).mtime) {
        throw "newer";
      }
    };
    // no rebuild needed
    console.log("templates.js is up to date");
    return;
  } catch (e) {
    console.log("creating templates.js");
  }

  for(var index = 0, max = fileNames.length; index < max; index++) {
    var fileName = fileNames[index];
    if(fileName.match(/\.ejs$/)) {
      var templateName = fileName.replace(/\.ejs/, '');
      templates[templateName] = fs.readFileSync(dir + "/" + fileName, "utf8")
    }
  }

  var templateData = "BrowserID.Templates =" + JSON.stringify(templates) + ";";

  fs.writeFileSync(output_dir + "/templates.js", templateData, "utf8");
};

// run or export the function
if (process.argv[1] === __filename) generateTemplates();
else module.exports = generateTemplates;
