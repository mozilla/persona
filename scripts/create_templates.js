#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const
fs = require("fs"),
path = require('path'),
ejs = require('ejs');

var dir = process.env.TEMPLATE_DIR || process.cwd();
var output_dir = process.env.BUILD_DIR || dir;

var bundles = {};

function generateTemplates(outputType, templatesDir, namePrefix) {
  if (templatesDir) dir = templatesDir;
  if (!namePrefix) namePrefix = "";

  var bundle = bundles[templatesDir] || (bundles[templatesDir] = {});
  var lastGen = bundle.lastGen || 0;
  var templateData = bundle.data;

  var fileNames = fs.readdirSync(dir);
  var templates = {};

  // is a regen even neccesary?
  try {
    if (outputType !== generateTemplates.RETURN) {
      lastGen = fs.statSync(path.join(output_dir, "templates.js")).mtime;
    }
    for (var i = 0; i < fileNames.length; i++) {
      if (lastGen < fs.statSync(path.join(dir, fileNames[i])).mtime) {
        throw "newer";
      }
    };
    // no rebuild needed
    console.log("templates.js is up to date");
    return templateData;
  } catch (e) {
    console.log("creating templates.js");
  }

  for(var index = 0, max = fileNames.length; index < max; index++) {
    var fileName = fileNames[index];
    if(fileName.match(/\.ejs$/)) {
      var templateName = namePrefix + fileName.replace(/\.ejs/, '');
      var templateText = fs.readFileSync(dir + "/" + fileName, "utf8");

      templates[templateName] = ejs.compile(templateText, {
        client: true,
        compileDebug: true // TODO: make this depend on config
      });
    }
  }

  templateData = "BrowserID.Templates = BrowserID.Templates || {};";
  for (var t in templates) {
    if (templates.hasOwnProperty(t)) {
      templateData += "\nBrowserID.Templates['" + t + "'] = " + String(templates[t]);
    }
  }

  if (outputType === generateTemplates.RETURN) {
    bundle.lastGen = Date.now();
    bundle.data = templateData;
    return templateData;
  } else {
    fs.writeFileSync(output_dir + "/templates.js", templateData, "utf8");
  }
};

generateTemplates.FILE = 0;
generateTemplates.RETURN = 1;

// run or export the function
if (process.argv[1] === __filename) generateTemplates();
else module.exports = generateTemplates;
