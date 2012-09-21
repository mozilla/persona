/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const
fs = require('fs'),
path = require('path'),
ejs = require('ejs'),
cachify = require('connect-cachify'),
config = require('./configuration');

var bundles = {};


const commentsRE = /<!--[\s\S]*?-->/g;
function stripComments(text) {
  return String(text).replace(commentsRE, '');
}

const cachifyRE = /cachify\(\s*["']([^"']*)["']*\s*\)/g; // :-(
function preCachify(text) {
  // cachify depends on an md5 hash of the contents of the file, so we
  // can't determine that once we're on the client. This replaces
  // instances of `cachify('some-url')` to the complete URL.
  //
  // Any instances of variables being used are part of the expression
  // will FAIL.
  //
  // Bad: cachify( base + '/my-image.png')
  return String(text).replace(cachifyRE, function(m, url) {
    return "'" + cachify.cachify(url) + "'";
  });
}

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
      console.log('starting template: ', templateName);
      var templateText = fs.readFileSync(path.join(templatesDir, fileName), "utf8");

      // remove HTML comments
      templateText = stripComments(templateText);

      // we need to take care of cachify at this point
      templateText = preCachify(templateText);

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
