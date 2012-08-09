#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert =
require('assert'),
vows = require('vows'),
config = require('../lib/configuration.js'),
bcrypt = require('bcrypt');

var suite = vows.describe('bcrypt-compatibility');

suite.addBatch({
  "new bcrypt of password for given salt": {
    topic: function () {
      var salt = "$2a$04$rakQlaS/TyfjZmoVuRs9ku";
      bcrypt.hash("Thisismypassword1!", salt, this.callback);
    },
    "should match old bcrypt": function (hash) {
      assert.strictEqual(hash, '$2a$04$rakQlaS/TyfjZmoVuRs9kuQHFk2oShl8DNmVbxgSZyOE8Hzgk0One');
    }
  },
  "get rounds of old hash should match new bcrypt": function () {
    var hash = '$2a$04$rakQlaS/TyfjZmoVuRs9kuQHFk2oShl8DNmVbxgSZyOE8Hzgk0One';
    assert.strictEqual(4, bcrypt.getRounds(hash));
  }
});

if (process.argv[1] === __filename) suite.run();
else suite.export(module);
