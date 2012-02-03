#!/usr/bin/env node

var path = require('path');

// use the 'local' configuration if one isn't explicitly specified in the environment
process.env['CONFIG_FILES'] = process.env['CONFIG_FILES'] ||
  path.join(__dirname, '..', 'config', 'local.json');

console.log(require("../lib/configuration.js").toString());
