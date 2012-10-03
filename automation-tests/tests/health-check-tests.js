#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
path = require('path'),
wd = require('wd'),
assert = require('assert'),
restmail = require('../lib/restmail.js'),
utils = require('../lib/utils.js'),
persona_urls = require('../lib/urls.js'),
CSS = require('../pages/css.js'),
dialog = require('../pages/dialog.js'),
vowsHarness = require('../lib/vows_harness.js'),
personatestuser = require('../lib/personatestuser.js');

// add fancy helper routines to wd
require('../lib/wd-extensions.js');

var browser = wd.remote(),
  eyedeemail = restmail.randomEmail(10, 'eyedee.me'),
  pcss = CSS['persona.org'],
  testUser;

vowsHarness({
  "create a new selenium session": function(done) {
    browser.newSession(done);
  },
  "go to persona.org and click sign in": function(done) {
    browser.chain()
      .get(persona_urls['persona'])
      .wclick(pcss.header.signIn, done);
  },
  "enter username and click 'verify' to pop dialog": function(done) {
    browser.chain()
      .wtype(pcss.signInForm.email, eyedeemail)
      .wclick(pcss.signInForm.nextButton)
      .wclick(pcss.signInForm.verifyPrimaryButton, done)
  },
  "switch to eyedeeme dialog, submit password, click ok": function(done) {
    browser.chain()
      .wwin('auth_with_primary')
      .wtype(CSS['eyedee.me'].newPassword, eyedeemail.split('@')[0])
      .wclick(CSS['eyedee.me'].createAccountButton, done);
  },
  "switch back to main window, look for the email in acct mgr, then log out": function(done) {
    browser.chain()
      .wwin() // back to main window
      .wtext(pcss.accountEmail, function(err, text) {
        assert.equal(eyedeemail.toLowerCase(), text) // interesting. 
      })
      .wclick(pcss.header.signOut, done);
  },
  "shut down": function(done) {
    browser.quit(done);
  }
}, module);
