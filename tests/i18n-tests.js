#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
      vows = require('vows'),
      i18n = require('../lib/i18n');

var suite = vows.describe('i18n');

suite.addBatch({
  "format a string with place values": {
    topic: function () {
      return i18n.format("%s %s!", ["Hello", "World"]);
    },
    "was interpolated": function (err, str) {
      assert.equal(str, "Hello World!");
    }
  }
});

suite.addBatch({
  "format a string with named values": {
    topic: function () {
      var params = { salutation: "Hello", place: "World" };
      return i18n.format("%(salutation)s %(place)s!", params, true);
    },
    "was interpolated": function (err, str) {
      assert.equal(str, "Hello World!");
    }
  }
});

suite.addBatch({
  "format a string without interpolation": {
    topic: function () {
      return i18n.format("Hello World!");
    },
    "was interpolated": function (err, str) {
      assert.equal(str, "Hello World!");
    }
  },
  "format a null": {
    topic: function () {
      return i18n.format(null);
    },
    "was interpolated": function (err, str) {
      assert.equal(str, "");
    }
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
