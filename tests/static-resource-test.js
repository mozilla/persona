#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
      vows = require('vows'),
      resources = require('../lib/static_resources');

var suite = vows.describe('cache header tests');
suite.options.error = false;

var locales = ['ar', 'de', 'en_US', 'fr'];
suite.addBatch({
  "All resources expand": {
    topic: function () {
      this.callback(resources.all(locales));
    },
    "We get stuff": function (files) {
      var res = resources.resources;
      assert.ok(files['/production/dialog.css'].length >= 3);
      // Get ride of non-localized asset bundles
      ['/production/communication_iframe.js', '/production/include.js', '/production/dialog.css', '/production/browserid.css', '/production/ie8_main.css', '/production/ie8_dialog.css'].forEach(
        function (nonLocaleAsset) {
          delete res[nonLocaleAsset];
          delete files[nonLocaleAsset];
        });

      // Keys expand
      // files ['/production/:locale/dialog.js']
      // becomes ['/production/ar/dialog.js', 'production/de/dialog.js', ...]
      assert.equal(Object.keys(files).length,
                   Object.keys(res).length * locales.length);

      // Let's use the first bundle
      var minFile = Object.keys(files)[0];
      var minRes = Object.keys(res)[0];

      // Number of files underneath stay the same
      assert.equal(files[minFile].length,
                   res[minRes].length);
      // Non-localized files underneath stay the same
      [0, 1, 2, 3, 4, 5, 6, 8].forEach(function (nonLocalizedIndex) {
      assert.equal(files[minFile][nonLocalizedIndex],
                   res[minRes][nonLocalizedIndex]);
      });
      // Fragile - filename with :locale...
      // When fixing this test case... console.log(res[Object.keys(res)[0]]);
      var localeIndex = 7;
      assert.notEqual(files[minFile][localeIndex],
                      res[minRes][localeIndex]);
      var counter = 0;
      for (var key in res) {
        res[key].forEach(function (item) {
          counter++;
        });
      }
      assert.ok(counter > 90);
    }
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
