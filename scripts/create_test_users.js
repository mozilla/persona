#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* A quick and dirty script to create test users for load generation.
 * Usage: ./create_test_users.js [number of test users]
 *
 * NOTE: the database used can be altered by specifying the path to a
 * configuration file in the `CONFIG_FILES` environment variable.
 *
 * Example:
 *  $ CONFIG_FILES=config/production.json scripts/create_test_users.js 5000
 */

const
db = require('../lib/db.js'),
config = require('../lib/configuration.js'),
logging = require('../lib/logging.js'),
logger = logging.logger,
bcrypt = require('../lib/bcrypt')

logging.enableConsoleLogging();

// how many?

var want = (process.argv.length > 2 ? parseInt(process.argv[2], 10) : 2000);

logger.info("creating " + want + " test users... this can take a while...");

db.open(config.get('database'), function (error) {
  if (error) {
    logger.error("can't open database: " + error);
    // let async logging flush, then exit 1
    return setTimeout(function() { process.exit(1); }, 0);
  }

  bcrypt.encrypt(
    config.get('bcrypt_work_factor'), "THE PASSWORD", function(err, hash) {
      if (err) {
        logger.error("error creating test users - bcrypt encrypt pass: " + err);
        process.exit(1);
      }
      var have = 0;
      for (var i = 1; i <= want; i++) {
        db.addTestUser(i + "@loadtest.domain", hash, function(err, email) {
          if (++have == want) {
            logger.warn("created " + want + " test users");
            bcrypt.shutdown();
            db.close();
          }
        });
      }
    });
});
