#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint sub: true */

// This test excercised codepaths when primaries become unreachable.  It
// uses testidp.org to create programatically controlled IdPs that can
// be turned on or off.

const
path = require('path'),
assert = require('../../lib/asserts.js'),
restmail = require('../../lib/restmail.js'),
utils = require('../../lib/utils.js'),
persona_urls = require('../../lib/urls.js'),
CSS = require('../../pages/css.js'),
dialog = require('../../pages/dialog.js'),
runner = require('../../lib/runner.js'),
testSetup = require('../../lib/test-setup.js');

var browser;
var testidp;

runner.run(module, {
  "setup": function(done) {
    testSetup.setup({browsers: 1, testidps: 1}, function(err, fixtures) {
      if (fixtures) {
        browser = fixtures.browsers[0];
        testidp = fixtures.testidps[0];
      }
      done(err);
    });
  },
  "create a new selenium session": function(done) {
    testSetup.newBrowserSession(browser, done);
  },
  "enable primary support behind a click": function(done) {
    testidp.setWellKnown({
      authentication: '/click/auth.html',
      provisioning: '/click/prov.html',
      "public-key": '<TEST IDP PROVIDED>'
    }, done);
  },
  //
  // First let's test the case where a user is authenticated to persona, they
  // have an email address that is a secondary address, and their email
  // provider turn on persona support.
  //
  "authenticate to persona for the first time with a primary email address": function(done) {
    browser.chain()
      .get(persona_urls["123done"])
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS["persona.org"].windowName)
      .wtype(CSS['dialog'].emailInput, testidp.email)
      .wclick(CSS['dialog'].newEmailNextButton)
      .wclick(CSS['testidp.org'].loginButton)
      .wwin()
      // wait until the sign-in fully completes
      .wfind(CSS['123done.org'].logoutLink, done);
  },
  "break the primary": function(done) {
    testidp.setWellKnown("broken", done);
  },
  "now try to log in with the email": function(done) {
    browser.chain()
      .wwin()
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS["persona.org"].windowName)
      .wclick(CSS['dialog'].signInButton, done);
  },
  "click cancel once broken primary message is displayed": function(done) {
    browser.chain()
      // primary is broken displayed!
      .wclick(CSS['dialog'].primaryOfflineCancel)
      // verify cancel button returns us to the sign-in screen
      .wfind(CSS['dialog'].signInButton, done);
  },
  "log out of persona and close dialog": function(done) {
    browser.chain()
      .wclick(CSS["dialog"].thisIsNotMe)
      .wfind(CSS["dialog"].emailInput)
      .closeCurrentBrowserWindow(done);
  },
  "spawn the dialog again and try to log in un-authed with address": function(done) {
    browser.chain()
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS["persona.org"].windowName)
      .wtype(CSS['dialog'].emailInput, testidp.email)
      .wclick(CSS['dialog'].newEmailNextButton, done);
  },
  "verify canceled screen is displayed and functions": function(done) {
    browser.chain()
    // primary is broken displayed!
      .wclick(CSS['dialog'].primaryOfflineCancel)
      // verify cancel button returns us to the initial screen
      .wfind(CSS['dialog'].emailInput, done);
  }
},
{
  suiteName: path.basename(__filename),
  cleanup: function(done) { testSetup.teardown(done); }
});
