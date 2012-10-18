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
testSetup = require('../lib/test-setup.js'),
vowsHarness = require('../lib/vows_harness.js');

var browser, primary, secondary;
/*
- setup: create account with 2 emails (primary and a secondary on same account) on persona.org, then:
- verify that no email is selected on first login to a site
  - visit 123done & verify
  - verify that the most recently used email for a given site is at top of dialog on next use:
    - log into 123done with one acct, sign out, open dialog to sign back in, verify.
*/

vowsHarness({
  "setup": function(done) {
    testSetup.setup({browsers: 1, restmails: 1, eyedeemails:1}, function(err, fix) {
      browser = fix.browsers[0];
      primary = fix.eyedeemails[0];
      secondary = fix.restmails[0];
      done(err);
    });
  },
  "startup, create primary acct on personaorg": function(done) {
    browser.chain()
      .newSession(testSetup.sessionOpts)
      .get(persona_urls['persona'])
      .wclick(CSS['persona.org'].header.signIn)
      .wtype(CSS['persona.org'].signInForm.email, primary)
      .wclick(CSS['persona.org'].signInForm.nextButton)
      .wclick(CSS['persona.org'].signInForm.verifyPrimaryButton)
      .wwin(CSS['persona.org'].verifyPrimaryDialogName)
      .wtype(CSS['eyedee.me'].newPassword, primary.split('@')[0])
      .wclick(CSS['eyedee.me'].createAccountButton)
      .wwin()
      .wtext(CSS['persona.org'].accountEmail, function(err, text) {
        assert.equal(primary.toLowerCase(), text) // note
        done()
      })
  },
  "go to 123done and add a secondary acct": function(done) {
    browser.chain()
      .get(persona_urls['123done'])
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS['persona.org'].windowName)
      .wclick(CSS['dialog'].useNewEmail)
      .wtype(CSS['dialog'].newEmail, secondary)
      .wclick(CSS['dialog'].addNewEmailButton)
    .wtype(CSS['dialog'].choosePassword, secondary.split('@')[0])
    .wtype(CSS['dialog'].verifyPassword, secondary.split('@')[0])
    .wclick(CSS['dialog'].createUserButton, done)
  },
  "get verification link": function(done) {
    restmail.getVerificationLink({ email: secondary }, done);
  },
  "follow link, wait for redirect, secondary should be displayed": function(done, link) {
    browser.chain()
      .wwin()
      .get(link)
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, secondary);
        done()
      })
  },
  "go to mfb, open dialog for first login": function(done) {
    browser.chain()
      .get(persona_urls['myfavoritebeer'])
      .wclick(CSS['myfavoritebeer.org'].signinButton)
      .wwin(CSS['persona.org'].windowName, done)
  },
  "check first radio is not selected":function(done, el) {
    browser.wfind(CSS['dialog'].firstEmail, function(err, el) {
      browser.getAttribute(el, 'selected', function(err, val) {
        assert.ok(!val)
        done()
      })
    })
  },
  "check second radio is not selected": function(done) {
    browser.wfind(CSS['dialog'].secondEmail, function(err, el) {
      browser.getAttribute(el, 'selected', function(err, val) {
        assert.ok(!val)
        done()
      })
    });
  },
  "sign in using primary, sign out, reload, click sign in, verify primary is selected": function(done) {
    browser.chain()
      .wclick(CSS['dialog'].firstEmail)
      .wclick(CSS['dialog'].signInButton)
      .wclick(CSS['dialog'].notMyComputerButton)
      .wwin()
      .wclick(CSS['myfavoritebeer.org'].logout)
      .wclick(CSS['myfavoritebeer.org'].signinButton)
      .wwin(CSS['persona.org'].windowName, done)
  },
  // this time, the first radio should be selected
  "check first radio is selected":function(done, el) {
    browser.wfind(CSS['dialog'].firstEmail, function(err, el) {
      browser.getAttribute(el, 'selected', function(err, val) {
        assert.ok(val)
        done()
      })
    })
  },
  "check second radio is still not selected": function(done) {
    browser.wfind(CSS['dialog'].secondEmail, function(err, el) {
      browser.getAttribute(el, 'selected', function(err, val) {
        assert.ok(!val)
        done()
      })
    });
  },
  "destroy": function(done) {
    browser.quit(done)
  }
}, module);
