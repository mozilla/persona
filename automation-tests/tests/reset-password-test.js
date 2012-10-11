#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
path = require('path'),
assert = require('assert'),
restmail = require('../lib/restmail.js'),
utils = require('../lib/utils.js'),
persona_urls = require('../lib/urls.js'),
CSS = require('../pages/css.js'),
dialog = require('../pages/dialog.js'),
vowsHarness = require('../lib/vows_harness.js'),
personatestuser = require('../lib/personatestuser.js'),
testSetup = require('../lib/test-setup.js');

// pull in test environment, including wd
var browser, testUser, mfbUser;
testSetup.setup({browsers: 1, personatestusers: 2}, function(err, fixtures) {
  browser = fixtures.browsers[0];
  testUser = fixtures.personatestusers[0];
  mfbUser = fixtures.personatestusers[1];
});

vowsHarness({
  "create a new selenium session": function(done) {
    browser.newSession(testSetup.sessionOpts, done);
  },
  "create a new personatestuser": function(done) {
    personatestuser.getVerifiedUser(function(err, user, blob) {
      if (err) { throw new Error('error getting persona test user: ' + err); }
      testUser = user;
      done();
    });
  },
  "load 123done and click the signin button": function(done) {
    browser.chain()
      .get(persona_urls["123done"])
      .wclick(CSS['123done.org'].signinButton, done);
  },
  "switch to the dialog when it opens": function(done) {
    browser.wwin(CSS["persona.org"].windowName, done);
  },
  "enter username and click the forgot password button": function(done) {
    browser.chain()
      .wtype(CSS['dialog'].emailInput, testUser.email)
      .wclick(CSS['dialog'].newEmailNextButton)
      .wclick(CSS['dialog'].forgotPassword, done);
  },
  "enter new password and verification password": function(done) {
    testUser.password = "new_password";

    browser.chain()
      .wtype(CSS['dialog'].choosePassword, testUser.password)
      .wtype(CSS['dialog'].verifyPassword, testUser.password)
      .wclick(CSS['dialog'].resetPasswordButton, done);
  },

  "open verification email": function(done) {

  }
}, module);
