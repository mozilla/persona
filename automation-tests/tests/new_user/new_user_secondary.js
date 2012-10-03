#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
path = require('path'),
wd = require('wd'),
assert = require('assert'),
restmail = require('../../lib/restmail.js'),
utils = require('../../lib/utils.js'),
persona_urls = require('../../lib/urls.js'),
CSS = require('../../pages/css.js'),
dialog = require('../../pages/dialog.js'),
vowsHarness = require('../../lib/vows_harness.js');

// add fancy helper routines to wd
require('../../lib/wd-extensions.js');

// generate a randome email we'll use
const theEmail = restmail.randomEmail(10);
var browser = wd.remote();

vowsHarness({
  "create a new selenium session": function(done) {
    browser.newSession(done);
  },
  "load 123done and click the signin button": function(done) {
    browser.chain()
      .get(persona_urls["123done"])
      .wclick(CSS["123done.org"].signinButton, done);
  },
  "switch to the dialog when it opens": function(done) {
    browser.wwin(CSS["persona.org"].windowName, done);
  },
  "sign in a new @restmail (secondary) user": function(done) {
    dialog.signInAsNewUser({
      browser: browser,
      email: theEmail,
      password: theEmail.split('@')[0], // we use the user part of email as password.  why not?
    }, done);
  },
  "get verification link from email": function(done) {
    restmail.getVerificationLink({ email: theEmail }, done);
  },
  "open verification link": function(done, link) {
    browser.closeCurrentBrowserWindow(function() {
      browser.get(link, done);
    });
  },
  "verify we're logged in as the expected user": function(done) {
    browser.wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
      assert.equal(text, theEmail);
      done()
    });
  },
  "shut down": function(done) {
    browser.quit(done);
  }
}, module);
