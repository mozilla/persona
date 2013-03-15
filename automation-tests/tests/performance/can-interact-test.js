#!/usr/bin/env node
/*jshint sub:true */

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
path = require('path'),
assert = require('../../lib/asserts'),
runner = require('../../lib/runner.js'),
testSetup = require('../../lib/test-setup.js'),
persona_urls = require('../../lib/urls.js'),
performance = require('../../lib/performance.js'),
CSS = require('../../pages/css.js'),
config = require('../../../lib/configuration');

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

  "start the session": function(done) {
    testSetup.newBrowserSession(browser, done);
  },

  "load up 123done & open dialog": function(done) {
    browser.chain({onError: done})
      .get(persona_urls["123done"])
      .wclick(CSS['123done.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wfind(CSS['dialog'].emailInput, done);
  },

  "load up 123done & reload the dialog to use primed cache": function(done) {
    browser.chain({onError: done})
      .wwin()
      .refresh()
      .wclick(CSS['123done.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wfind(CSS['dialog'].emailInput)
      // give time for the interaction_data blob to be sent
      .delay(performance.REQUEST_TIMEOUT, done);
  },

  "save cache emtpy results": function(done) {
    performance.save("cache empty", done);
  },

  "load up 123done & reopen dialog to send KPIs": function(done) {
      /* KPIs for one dialog session are sent in the next dialog session.
       * hold on a second, go back to the main page, and reload the dialog
       * so the KPIs are sent. */
    browser.chain({onError: done})
      .wwin()
      .refresh()
      .wclick(CSS['123done.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wfind(CSS['dialog'].emailInput)
      // give time for the interaction_data blob to be sent
      .delay(performance.REQUEST_TIMEOUT, done);
  },

  "save cache full results": function(done) {
    browser.quit();
    performance.save("cache full", done);
  }
},
{
  suiteName: path.basename(__filename),
  cleanup: function(done) { testSetup.teardown(done);
}});

