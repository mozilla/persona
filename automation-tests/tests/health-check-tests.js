#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
path = require('path'),
assert = require('../lib/asserts.js'),
utils = require('../lib/utils.js'),
persona_urls = require('../lib/urls.js'),
CSS = require('../pages/css.js'),
dialog = require('../pages/dialog.js'),
restmail = require('../lib/restmail.js'),
runner = require('../lib/runner.js'),
testSetup = require('../lib/test-setup.js');

var pcss = CSS['persona.org'],
  browser, secondBrowser, eyedeemail, theEmail;

// all the stuff common between primary and secondary tests:
// go to persona.org, click sign in, enter email, click next.
var startup = function(b, email, cb) {
  b.chain({onError: cb})
    .get(persona_urls['persona'])
    .wclick(pcss.header.signIn)
    .wtype(pcss.signInForm.email, email)
    .wclick(pcss.signInForm.nextButton, cb);
}

var setup = {
  "setup stuff": function(done) {
    testSetup.setup({browsers: 2, eyedeemails: 1, restmails: 1}, function(err, fixtures) {
      browser = fixtures.browsers[0];
      secondBrowser = fixtures.browsers[1];
      eyedeemail = fixtures.eyedeemails[0];
      theEmail = fixtures.restmails[0];
      done(err)
    });
  }
};

var primaryTest = {
  "setup browser": function(done) {
    testSetup.newBrowserSession(browser, done);
  },
  "go to personaorg, click sign in, type eyedeeme addy, click next": function(done) {
    startup(browser, eyedeemail, done)
  },
  "click 'verify primary' to pop eyedeeme dialog": function(done) {
    browser.wclick(pcss.signInForm.verifyPrimaryButton, done);
  },
  "switch to eyedeeme dialog, submit password, click ok": function(done) {
    browser.chain({onError: done})
      .wwin(pcss.verifyPrimaryDialogName)
      .wtype(CSS['eyedee.me'].newPassword, eyedeemail.split('@')[0])
      .wclick(CSS['eyedee.me'].createAccountButton, done);
  },
  "switch back to main window, look for the email in acct mgr, then log out": function(done) {
    browser.chain({onError: done})
      .wwin()
      .wtext(pcss.accountEmail, function(err, text) {
        done(err || assert.equal(eyedeemail.toLowerCase(), text)); // note, had to lower case it.
      })
      .wclick(pcss.header.signOut, done);
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
    secondBrowser.chain({onError: done})
      .get(link)
      .wfind(pcss.congratsMessage, done);
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
    cleanup: function(done) { testSetup.teardown(done) }
  });
