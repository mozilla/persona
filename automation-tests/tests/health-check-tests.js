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
personatestuser = require('../lib/personatestuser.js');

// pull in test environment, including wd
var testSetup = require('../lib/test-setup.js'),
  browser = testSetup.startup(),
  eyedeemail = restmail.randomEmail(10, 'eyedee.me'),
  theEmail = restmail.randomEmail(10),
  pcss = CSS['persona.org'],
  testUser;

// all the stuff common between primary and secondary tests:
// go to persona.org, click sign in, enter email, click next.
var startup = function(b, email, cb) {
  b.chain()
    .newSession(testSetup.sessionOpts)
    .get(persona_urls['persona'])
    .wclick(pcss.header.signIn)
    .wtype(pcss.signInForm.email, email)
    .wclick(pcss.signInForm.nextButton, cb);
}

var primaryTest = {
  "start, go to personaorg, click sign in, type eyedeeme addy, click next": function(done) {
    startup(browser, eyedeemail, done)
  },
  "click 'verify primary' to pop eyedeeme dialog": function(done) {
    browser.wclick(pcss.signInForm.verifyPrimaryButton, done);
  },
  "switch to eyedeeme dialog, submit password, click ok": function(done) {
    browser.chain()
      .wwin(pcss.verifyPrimaryDialogName)
      .wtype(CSS['eyedee.me'].newPassword, eyedeemail.split('@')[0])
      .wclick(CSS['eyedee.me'].createAccountButton, done);
  },
  "switch back to main window, look for the email in acct mgr, then log out": function(done) {
    browser.chain()
      .wwin()
      .wtext(pcss.accountEmail, function(err, text) {
        assert.equal(eyedeemail.toLowerCase(), text) // note, had to lower case it.
      })
      .wclick(pcss.header.signOut, done);
  },
  "shut down primary test": function(done) {
    browser.quit(done);
  }
};

var secondaryTest = {
  "start, go to personaorg, click sign in, type restmail addy, click next": function(done) {
    startup(browser, theEmail, done);
  },
  "enter password and click verify": function(done) {
    browser.chain()
      .wtype(pcss.signInForm.password, theEmail.split('@')[0])
      .wtype(pcss.signInForm.verifyPassword, theEmail.split('@')[0])
      .wclick(pcss.signInForm.verifyEmailButton, done);
  },
  "get verification link": function(done) {
    restmail.getVerificationLink({email: theEmail}, done);
  },
  // if we asserted against contents of #congrats message, our tests would
  // break if we ran them against a non-English deploy of the site
  "open verification link and verify we see congrats node": function(done, link) {
    browser.chain()
      .get(link)
      .wfind(pcss.congratsMessage, done); 
  },
  "shut down secondary test": function(done) {
    browser.quit(done);
  }
};

// this is DEFINITELY just a hack. 
// TODO: find a more solid way, maybe add to vowsHarness directly
for (var x in secondaryTest) { primaryTest[x] = secondaryTest[x] }
vowsHarness(primaryTest, module);
