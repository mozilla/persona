#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
      vows = require('vows'),
      i18n = require('../lib/i18n'),
      start_stop = require('./lib/start-stop.js'),
      wsapi = require('./lib/wsapi.js'),
      http = require('http'),
      path = require('path');

var suite = vows.describe('i18n');

suite.options.error = false;

suite.addBatch({
  "format a string with place values": {
    topic: function () {
      return i18n.format("%s %s!", ["Hello", "World"]);
    },
    "was interpolated": function (str) {
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
    "was interpolated": function (str) {
      assert.equal(str, "Hello World!");
    }
  }
});

suite.addBatch({
  "format a string without interpolation": {
    topic: function () {
      return i18n.format("Hello World!");
    },
    "was interpolated": function (str) {
      assert.equal(str, "Hello World!");
    }
  },
  "format a null": {
    topic: function () {
      return i18n.format(null);
    },
    "was interpolated": function (str) {
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
    "For Punjabi": function (locale) {
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
    "For Punjabi (India) serve Punjabi": function (locale) {
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
    "Don't choose Punjabi (India)": function (locale) {
      assert.equal(locale, "en-us");
    }
  }
});

// point to test translation files
process.env['TRANSLATION_DIR'] = path.join(__dirname, "i18n_test_files");

// supported languages for the purposes of this test
process.env['SUPPORTED_LANGUAGES'] = 'en,bg,it-CH';

// now let's start up our servers
start_stop.addStartupBatches(suite);

function getTestTemplate(langs, tp) {
  tp = tp || '/i18n_test';
  return function() {
    var self = this;
    var req = http.request({
      host: '127.0.0.1',
      port: 10002,
      path: tp,
      method: "GET",
      headers: { 'Accept-Language': langs }
    }, function (res) {
      var body = "";
      res.on('data', function(chunk) { body += chunk; })
        .on('end', function() {
          self.callback(null, { code: res.statusCode, body: body });
        });
    }).on('error', function (e) {
      self.callback(e);
    });
    req.end();
  };
}

suite.addBatch({
  // test default language
  "test template with no headers": {
    topic: getTestTemplate(undefined),
    "returns english" : function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(
        r.body.trim(),
        'This is a translation <strong>test</strong> string.');
    }
  },
  // test un-supported case
  "test template with german headers": {
    topic: getTestTemplate('de'),
    "returns english" : function(err, r) {
      assert.strictEqual(200, r.code);
      assert.strictEqual(
        r.body.trim(),
        'This is a translation <strong>test</strong> string.');
    }
  },
  // test debug translation
  "test template with debug headers": {
    topic: getTestTemplate('it-CH'),
    "returns gobbledygook" : function(err, r) {
      assert.strictEqual(200, r.code);
      assert.strictEqual(
        r.body.trim(),
        '.ƃuıɹʇs <strong>ʇsǝʇ</strong> uoıʇaʅsuaɹʇ a sı sıɥ⊥');
    }
  },
  // test .json extraction
  "bulgarian accept headers": {
    topic: getTestTemplate('bg'),
    "return a translation extacted from .json file" : function(err, r) {
      assert.strictEqual(200, r.code);
      assert.strictEqual(r.body.trim(), "Прова?  Прова?  Четери, пет, шещ?");
    }
  },
  // test .json extraction fallback when translation is the empty string
  "bulgarian accept headers without a translation": {
    topic: getTestTemplate('bg', '/i18n_fallback_test'),
    "return a non-translated string" : function(err, r) {
      assert.strictEqual(200, r.code);
      assert.strictEqual(r.body.trim(), "This is not translated");
    }
  }

});

// and let's stop them servers
start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
