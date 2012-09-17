/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const
fs = require('fs'),
path = require('path'),
ejs = require('ejs'),
config = require('./configuration');

var bundles = {};

exports.generate = function generate(templatesDir, namePrefix, lastGen) {
  if (!namePrefix) namePrefix = "";

  var bundle = bundles[templatesDir] || (bundles[templatesDir] = {});
  lastGen = lastGen || bundle.lastGen || 0;
  var templateData = bundle.data;

  var fileNames = fs.readdirSync(templatesDir);
  var templates = [];

  // is a regen necessary?
  try {
    for (var i = 0; i < fileNames.length; i++) {
      if (lastGen < fs.statSync(path.join(templatesDir, fileNames[i])).mtime) {
        throw "newer";
      }
    }
    // no rebuild needed
    console.log("templates [%s] up to date", templatesDir);
    return templateData;
  } catch (e) {
    console.log("creating templates [%s]", templatesDir);
  }

  for(var index = 0, max = fileNames.length; index < max; index++) {
    var fileName = fileNames[index];
    if(fileName.match(/\.ejs$/)) {
      var templateName = namePrefix + fileName.replace(/\.ejs/, '');
      var templateText = fs.readFileSync(path.join(templatesDir, fileName), "utf8");

      // remove HTML comments
      templateText = templateText.replace(/<!--[\s\S]*?-->/g, '');

      templates[templateName] = ejs.compile(templateText, {
        client: true,
        compileDebug: !config.get('use_minified_resources')
      });
    }
  }

  templateData = "BrowserID.Templates = BrowserID.Templates || {};";
  for (var t in templates) {
    if (templates.hasOwnProperty(t)) {
      templateData += "\nBrowserID.Templates['" + t + "'] = " + String(templates[t]) + ";";
    }
  }

  bundle.lastGen = Date.now();
  bundle.data = templateData;
  return templateData;
};
