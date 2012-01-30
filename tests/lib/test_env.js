/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* this zero-exports include file should be included by each of the tests.
 * if NODE_ENV was not explicitly set to a test environment it will set
 * NODE_ENV and issue a warning on the console to developers */ 

if (undefined === process.env['NODE_ENV']) {
  console.log("Setting NODE_ENV to test_json to test with the local JSON database");
  console.log("To test with a local mysql database, setup mysql and set NODE_ENV to test_mysql");
  process.env['NODE_ENV'] = 'test_json';
} else if (process.env['NODE_ENV'].substr(0,5) !== 'test_') {
  console.log("(Woah.  Running tests without a test_ configuration.  Is this *really* what you want?)");
  process.exit(1);
}

// if the environment is a 'test_' environment, then we'll use an
// ephemeral database
if (process.env['NODE_ENV'] === 'test_mysql') {
  process.env['DATABASE_NAME'] = "browserid_tmp_" +
    require('../../lib/secrets.js').generate(6);
} else if (process.env['NODE_ENV'] === 'test_json') {
  process.env['DATABASE_NAME'] = require('temp').path({suffix: '.db'});
}
