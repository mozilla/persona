#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// a simple script to test to see if we can connect to
// the database using the present configuration.
const path = require('path');

if (!process.env['CONFIG_FILES']) {
  process.env['CONFIG_FILES'] = path.join(__dirname, "..", "config", "local.json");
}

const
configuration = require('../lib/configuration.js'),
db = require('../lib/db.js');

var dbCfg = configuration.get('database');

// don't bother creating the schema
delete dbCfg.create_schema;

db.open(dbCfg, function (err, r) {
  if (err && err.message === "Unknown database 'browserid'") err = undefined;
  function end() { process.exit(err ? 1 : 0); }
  if (!err) db.close(end);
  else end();
});
