#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const fs = require("fs");

var dir = process.env.TEMPLATE_DIR || process.cwd();
var output_dir = process.env.BUILD_DIR || dir;

var templates = {};


fs.readdir(dir, function(err, fileNames) {
  for(var index = 0, max = fileNames.length; index < max; index++) {
    var fileName = fileNames[index];
    if(fileName.match(/\.ejs$/)) {
      var templateName = fileName.replace(/\.ejs/, '');
      templates[templateName] = fs.readFileSync(dir + "/" + fileName, "utf8")
    }
  }

  var templateData = "BrowserID.Templates =" + JSON.stringify(templates) + ";";

  fs.writeFileSync(output_dir + "/templates.js", templateData, "utf8");
});

