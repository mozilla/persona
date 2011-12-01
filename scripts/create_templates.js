#!/usr/bin/env node

const fs = require("fs");

var dir = process.env.TEMPLATE_DIR || process.cwd();
console.log(dir);

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

  fs.writeFileSync(dir + "/templates.js", templateData, "utf8");
});

