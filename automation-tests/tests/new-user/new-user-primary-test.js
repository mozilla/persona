#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
path = require('path'),
assert = require('assert'),
restmail = require('../../lib/restmail.js'),
utils = require('../../lib/utils.js'),
persona_urls = require('../../lib/urls.js'),
CSS = require('../../pages/css.js'),
dialog = require('../../pages/dialog.js'),
testSetup = require('../../lib/test-setup.js'),
vowsHarness = require('../../lib/vows_harness.js');

var browser, eyedeemail, theEmail, eyedeemail_mfb, porg_eyedeemail;
testSetup.setup({browsers: 1, eyedeemails: 3, restmails: 1}, function(err, fixtures) {
  browser = fixtures.browsers[0];
  eyedeemail = fixtures.eyedeemails[0];
  eyedeemail_mfb = fixtures.eyedeemails[1];
  porg_eyedeemail = fixtures.eyedeemails[2];
  theEmail = fixtures.restmails[0];
});

function dialogEyedeemeFlow(b, email, cb) {
  b.chain()
    .wwin(CSS['persona.org'].windowName)
    .wtype(CSS['dialog'].emailInput, email)
    .wclick(CSS['dialog'].newEmailNextButton)
    .wclick(CSS['dialog'].verifyWithPrimaryButton)
    .wclick(CSS['dialog'].verifyWithPrimaryButton) //XXX Why do we need to click twice?
    .wtype(CSS['eyedee.me'].newPassword, email.split('@')[0])
    .wclick(CSS['eyedee.me'].createAccountButton, cb);
}

var primary_123done = {
  "startup, load 123done, click sign in": function(done) {
    browser.chain()
      .newSession(testSetup.sessionOpts)
      .get(persona_urls['123done'])
      .wclick(CSS['123done.org'].signinButton, done)
  },
  "sign in a new eyedeemee user": function(done) {
    dialogEyedeemeFlow(browser, eyedeemail, done);
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

var mcss = CSS['myfavoritebeer.org'],
  primary_mfb = {
    "go to mfb, click sign in, switch to dialog": function(done) {
      browser.chain()
        .newSession(testSetup.sessionOpts)
        .get(persona_urls['myfavoritebeer'])
        .wclick(mcss.signinButton, done)
    },
    "sign in using eyedeeme": function(done) {
      dialogEyedeemeFlow(browser, eyedeemail_mfb, done);
    },
    "back to mfb, check we logged in OK": function(done) {
      browser.chain()
        .wwin()
        .wtext(CSS['myfavoritebeer.org'].currentlyLoggedInEmail, function(err, text) {
          assert.equal(text, eyedeemail_mfb);
          done()
        });
    },
    "mfb tear down browser": function(done) {
      browser.quit(done);
    }
};

var pcss = CSS['persona.org'],
  primary_personaorg = {
    // how much do we really need to split this out into separate vows?
    // is this too compact or actually better?
    //
    // open browser, go to persona.org, click sign in, enter eyedeemail, click next
    // click verify primary button, switch to popup, enter password, click ok
    // switch back to main window, look for email in acct mgr, log out
    "create eyedee.me primary at persona.org and verify logged in OK": function(done) {
      browser.chain()
        .newSession(testSetup.sessionOpts)
        .get(persona_urls['persona'])
        .wclick(pcss.header.signIn)
        .wtype(pcss.signInForm.email, porg_eyedeemail)
        .wclick(pcss.signInForm.nextButton)
        .wclick(pcss.signInForm.verifyPrimaryButton)
        .wwin(pcss.verifyPrimaryDialogName)
        .wtype(CSS['eyedee.me'].newPassword, porg_eyedeemail.split('@')[0])
        .wclick(CSS['eyedee.me'].createAccountButton)
        .wwin()
        .wtext(pcss.accountEmail, function(err, text) {
          assert.equal(porg_eyedeemail.toLowerCase(), text) // note
        })
        .wclick(pcss.header.signOut)
        .quit(done);
    }
};

// ARGH. maddening partly because of the duplication, and partly because
// if any vows share the same name, everything a splode.
for (var x in primary_mfb) { primary_123done[x] = primary_mfb[x]; }
for (var x in primary_personaorg) { primary_123done[x] = primary_personaorg[x]; }
vowsHarness(primary_123done, module);
