#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint sub: true */

const
path = require('path'),
assert = require('../lib/asserts.js'),
utils = require('../lib/utils.js'),
persona_urls = require('../lib/urls.js'),
CSS = require('../pages/css.js'),
dialog = require('../pages/dialog.js'),
restmail = require('../lib/restmail.js'),
runner = require('../lib/runner.js'),
testSetup = require('../lib/test-setup.js'),
timeouts = require('../lib/timeouts.js');

var pcss = CSS['persona.org'],
  browser, secondBrowser, primaryEmail, theEmail, testIdp;

// all the stuff common between primary and secondary tests:
// go to persona.org, click sign in, enter email, click next.
var startup = function(b, email, cb) {
  b.chain({onError: cb})
    .get(persona_urls['persona'])
    .wclick(pcss.header.signIn)
    .wwin(CSS['dialog'].windowName)
    .wtype(CSS['dialog'].emailInput, email)
    .wclick(CSS['dialog'].newEmailNextButton, cb);
};

var setup = {
  "setup stuff": function(done) {
    testSetup.setup({browsers: 2, testidps: 1, restmails: 1}, function(err, fixtures) {
      if (fixtures) {
        browser = fixtures.browsers[0];
        secondBrowser = fixtures.browsers[1];
        testIdp = fixtures.testidps[0];
        primaryEmail = testIdp.getRandomEmail();
        theEmail = fixtures.restmails[0];
      }
      done(err);
    });
  }
};

var primaryTest = {
  "enable primary support": function(done) {
    testIdp.enableSupport(done);
  },

  "setup browser": function(done) {
    testSetup.newBrowserSession(browser, done);
  },

  "go to personaorg, click sign in, type testidp addy, click next": function(done) {
    startup(browser, primaryEmail, done);
  },
  "switch to testidp dialog, submit password, click ok": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['testidp.org'].loginButton, done);
  },
  "switch back to main window, look for the email in acct mgr, then log out": function(done) {
    browser.chain({onError: done})
      .wwin()
      .wtext(pcss.accountEmail, function(err, text) {
        done(err || assert.equal(primaryEmail.toLowerCase(), text)); // note, had to lower case it.
      });
  },
  "sign out": function(done) {
    browser.wclick(pcss.header.signOut, done);
  },
  "shut down primary test": function(done) {
    browser.quit(done);
    browser = null;
  }
};

var secondaryTest = {
  "setup second browser": function(done) {
    testSetup.newBrowserSession(secondBrowser, done);
  },
  "go to personaorg, click sign in, type restmail addy, click next": function(done) {
    startup(secondBrowser, theEmail, done);
  },
  "enter password and click verify": function(done) {
    secondBrowser.chain({onError: done})
      .wtype(CSS['dialog'].choosePassword, theEmail.split('@')[0])
      .wtype(CSS['dialog'].verifyPassword, theEmail.split('@')[0])
      .wclick(CSS['dialog'].createUserButton, done);
  },
  "get verification link": function(done) {
    restmail.getVerificationLink({email: theEmail}, done);
  },
  "open verification link and verify we are redirected to the manage page": function(done, token, link) {
    secondBrowser.chain({onError: done})
      .wwin()
      .get(link)
      .wfind(pcss.accountManagerHeader, done);
  },
  "shut down secondary test": function(done) {
    secondBrowser.quit(done);
    secondBrowser = null;
  }
};

runner.run(
  module,
  [setup, secondaryTest, primaryTest],
  {
    suiteName: path.basename(__filename),
    cleanup: function(done) { testSetup.teardown(done); }
  });
