#!/usr/bin/env node

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
