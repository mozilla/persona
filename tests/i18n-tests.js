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
      return i18n.format("%(salutation) %(place)!", params);
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

suite.addBatch({
  "We find exact language match": {
    topic: function () {
      var accept = 'pa,sv;q=0.8,fi;q=0.7,it-ch;q=0.5,en-us;q=0.3,en;q=0.2';
      var supported = ['af', 'en-US', 'pa'];
      var def = 'en-US';
      return i18n.bestLanguage(
          i18n.parseAcceptLanguage(accept),
          supported, def);
    },
    "For Punjabi": function (err, locale) {
      assert.equal(locale, "pa");
    }
  },
  "Issue#1128 We find best locale even if region doesn't match": {
    topic: function () {
      var accept = 'pa-it,sv;q=0.8,fi;q=0.7,it-ch;q=0.5,en-us;q=0.3,en;q=0.2';
      var supported = ['af', 'en-US', 'pa'];
      var def = 'en-US';
      return i18n.bestLanguage(
          i18n.parseAcceptLanguage(accept),
          supported, def);
    },
    "For Punjabi (India) serve Punjabi": function (err, locale) {
      assert.equal(locale, "pa");
    }
  },
  "We don't extend into a region, unless we have an exact match": {
    topic: function () {
      var accept = 'pa,sv;q=0.8,fi;q=0.7,it-ch;q=0.5,en-us;q=0.3,en;q=0.2';
      var supported = ['af', 'en-US', 'pa-IT'];
      var def = 'en-US';
      return i18n.bestLanguage(
          i18n.parseAcceptLanguage(accept),
          supported, def);
    },
    "Don't choose Punjabi (India)": function (err, locale) {
      assert.equal(locale, "en-us");
    }
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
