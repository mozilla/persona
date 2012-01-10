#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// a simple script to test to see if we can connect to
// the database using the present configuration.

const
configuration = require('../lib/configuration.js'),
db = require('../lib/db.js');

var dbCfg = configuration.get('database');

// don't bother creating the schema
delete dbCfg.create_schema;

db.open(dbCfg, function (r) {
  if (r && r.message === "Unknown database 'browserid'") r = undefined;
  function end() { process.exit(r === undefined ? 0 : 1); }
  if (r === undefined) db.close(end);
  else end();
});
