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

var browser = wd.remote();
var eyedeemail = restmail.randomEmail(10, 'eyedee.me');
var theEmail = restmail.randomEmail(10);

function startup123done(b, cb) {
  b.chain()
    .newSession()
    .get(persona_urls['123done'])
    .wclick(CSS['123done.org'].signinButton, cb);
}

var primary_123done = {
  "startup, load 123done, click sign in": function(done) {
    startup123done(browser, done);
  },
  "sign in a new eyedeemee user": function(done) {
    browser.chain()
      .wwin(CSS['persona.org'].windowName)
      .wtype(CSS['dialog'].emailInput, eyedeemail)
      .wclick(CSS['dialog'].newEmailNextButton)
      .wclick(CSS['dialog'].verifyWithPrimaryButton)
      // for some reason, this button sometimes gets stuck. click it twice.
      .wclick(CSS['dialog'].verifyWithPrimaryButton)
      .wtype(CSS['eyedee.me'].newPassword, eyedeemail.split('@')[0])
      .wclick(CSS['eyedee.me'].createAccountButton, done);
  },
  // TODO 123done never seems to log in. something up with beta server?
  "switch back to main window and verify we're logged in": function(done) {
    browser.chain()
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, eyedeemail);
        done()
      });
  }
};

var secondBrowser,
  secondary_123done_two_browsers = {
  "again: startup, load 123done, click sign in": function(done) {
    startup123done(browser, done);
  },
  "switch to the persona dialog": function(done) {
    browser.wwin(CSS['persona.org'].windowName, done);
  },
  "go through signup flow": function(done) {
    dialog.signInAsNewUser({
      browser: browser,
      email: theEmail,
      password: theEmail.split('@')[0]
    }, done);
  },
  "get verification link from email": function(done) {
    restmail.getVerificationLink({ email: theEmail }, done);
  },
  "open verification link in another window": function(done, link) {
    secondBrowser = wd.remote(); //spin up a second browser
    secondBrowser.chain()
      .newSession()
      .get(link, done);
  },
  "re-enter password and click login on persona.org": function(done) {
    secondBrowser.chain()
      .wtype(CSS['persona.org'].signInForm.password, theEmail.split('@')[0])
      .wclick(CSS['persona.org'].signInForm.finishButton, done);
  },
  "verify the congrats message is displayed": function(done) {
    secondBrowser.wfind(CSS['persona.org'].congratsMessage, done);
  },
  "tear down both browsers": function(done) {
    browser.quit();
    secondBrowser.quit();
    done();
  }
};


vowsHarness(secondary_123done_two_browsers, module)
