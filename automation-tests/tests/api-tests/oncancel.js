#!/usr/bin/env node
/*jshint sub:true */

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
path = require('path'),
CSS = require('../../pages/css.js'),
runner = require('../../lib/runner.js'),
persona_urls = require('../../lib/urls.js'),
testSetup = require('../../lib/test-setup.js');

var browser;

runner.run(module, {
  "setup all the things": function(done) {
    testSetup.setup({ b:1 }, function(err, fix) {
      if (fix) {
        browser = fix.b[0];
      }
      done(err);
    });
  },

  "create a new selenium session": function(done) {
    testSetup.newBrowserSession(browser, done);
  },

  "open 123done, load up dialog": function(done) {
    browser.chain({ onError: done })
      .get(persona_urls["123done"])
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS["persona.org"].windowName)
      .wfind(CSS['dialog'].emailInput, done);
  },

  "close dialog": function(done) {
    browser.closeCurrentBrowserWindow(done);
  },

  "ensure the sign in button is re-enabled and is clickable": function(done) {
    browser.chain({ onError: done })
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS["persona.org"].windowName)
      .wfind(CSS['dialog'].emailInput, done);
  }
}, {
  suiteName: path.basename(__filename),
  cleanup: function(done) { testSetup.teardown(done); }
});


