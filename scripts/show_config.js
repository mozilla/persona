#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var path = require('path');

// use the 'local' configuration if one isn't explicitly specified in the environment
process.env['CONFIG_FILES'] = process.env['CONFIG_FILES'] ||
  path.join(__dirname, '..', 'config', 'local.json');

console.log(require("../lib/configuration.js").toString());
