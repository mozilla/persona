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

    "and locale specific css bundles contain the same number of assets as the non-localized bundle": function (files) {
      var res = resources.resources;
      // Check to make sure that locale specific css bundles are generated.
      // Each bundle should contain the same number of files as the
      // non-localized bundle.
      var numDialogCSSFiles = res['/production/:locale/dialog.css'].length;
      assert.equal(files['/production/ar/dialog.css'].length,
          numDialogCSSFiles);
      assert.equal(files['/production/de/dialog.css'].length,
          numDialogCSSFiles);
      assert.equal(files['/production/fr/dialog.css'].length,
          numDialogCSSFiles);
    },

    "and each localized asset has a per-locale entry in the list of files": function (files) {
      var res = resources.resources;
      // Get rid of non-localized asset bundles or else they mess with our
      // calculations.
      for(var resource in res) {
        if (resource.indexOf(":locale") === -1) {
          // non localized asset, get rid of it.
          delete res[resource];
          delete files[resource];
        }
      }

      // Make sure each localized asset has a per-locale entry in the list of
      // files.
      // files ['/production/:locale/dialog.js']
      // becomes ['/production/ar/dialog.js', 'production/de/dialog.js', ...]
      assert.equal(Object.keys(files).length,
                   Object.keys(res).length * locales.length);
    },

    "and component assets are localized if needed": function (files) {
      var res = resources.resources;

      // Let's use the first bundle
      var minFile = Object.keys(files)[0];
      var minRes = Object.keys(res)[0];

      var nonLocalizedResource = res[minRes];
      var localizedResource = files[minFile];

      nonLocalizedResource.forEach(function(nonLocalizedAsset, index) {
        var localizedAsset = localizedResource[index];

        // Check to make sure :locale is replaced if it exists.
        if (nonLocalizedAsset.indexOf(':locale') > -1) {
          // localized resource - :locale has been replaced.
          assert.equal(localizedAsset.indexOf(':locale'), -1);

          // convert the non-localized path into a RegExp that can be used
          // to search for the locale.
          var localizedRegExp = new RegExp(nonLocalizedAsset
                                    // allows searching on the locale
                                    .replace(':locale', '(.*)')
                                    // allow / in the path to be matched.
                                    .replace(/\//g, '\\/'));

          // make sure the only thing replaced in the path is the :locale
          assert.ok(localizedRegExp.test(localizedAsset));
        }
        else {
          // non-localized asset, name should remain the same.
          assert.equal(localizedAsset, nonLocalizedAsset);
        }
      });
    },

    "and total count is sane": function (files) {
      var res = resources.resources;
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
