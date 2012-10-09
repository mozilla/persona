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

// pull in test environment, including wd
var browser, secondBrowser, theEmail, mfbEmail, nspEmail;
// this is the more compact setup syntax
testSetup.setup({b:2, r:3}, function(err, fix) {
  browser = fix.b[0];
  secondBrowser = fix.b[1];
  theEmail = fix.r[0];
  mfbEmail = fix.r[1];
  nspEmail = fix.r[2];
});

var new_secondary_123done_two_browsers = {
  "startup, go to 123done, click sign in": function(done) {
    browser.chain()
      .newSession(testSetup.sessionOpts)
      .get(persona_urls['123done'])
      .wclick(CSS['123done.org'].signinButton, done);
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
  "get another browser session, open verification link in new browser window": function(done, link) {
    secondBrowser.chain()
      .newSession(testSetup.sessionOpts)
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
  "verify logged in automatically to 123done in first browser": function(done) {
    browser.chain()
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        if (err) return done(err)
        assert.equal(text, theEmail)
        done()
      });
  },
  "tear down both browsers": function(done) {
    browser.quit();
    secondBrowser.quit();
    done();
  }
};


var new_secondary_mfb_two_browsers = {
  "create a new selenium session": function(done) {
    browser.newSession(testSetup.sessionOpts, done);
  },
  "load mfb and click the signin button": function(done) {
    browser.chain()
      .get(persona_urls["myfavoritebeer"])
      .wclick(CSS["myfavoritebeer.org"].signinButton, done);
  },
  "switch to the dialog when it opens": function(done) {
    browser.wwin(CSS["persona.org"].windowName, done);
  },
  "sign in a new @restmail (secondary) user": function(done) {
    dialog.signInAsNewUser({
      browser: browser,
      email: mfbEmail,
      password: mfbEmail.split('@')[0], // we use the user part of email as password.  why not?
    }, done);
  },
  "mfb get verification link from email": function(done) {
    restmail.getVerificationLink({ email: mfbEmail }, done);
  },
  "open verification link in second session and re-enter password": function(done, link) {
    secondBrowser.chain()
      .newSession(testSetup.sessionOpts)
      .get(link)
      .wtype(CSS['persona.org'].signInForm.password, mfbEmail.split('@')[0])
      .wclick(CSS['persona.org'].signInForm.finishButton, done);
  },
  "back in the first session, back to main window and verify we're auto-logged in as the expected user": function(done) {
    browser.chain()
      .wwin()
      .wtext(CSS['myfavoritebeer.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, mfbEmail);
        done()
      });
  },
  "shut down first browser": function(done) {
    browser.quit(done);
  },
  "shut down second browser": function(done) {
    secondBrowser.quit(done);
  }
};

var new_secondary_personaorg = {
    // trying another super terse test. I find I'm liking these better and better,
    // but I'm afraid they will be totally unreadable if you only write these
    // tests once in a while
    "create restmail user at persona.org and verify logged in OK": function(done) {
      browser.chain()
        .newSession(testSetup.sessionOpts)
        .get(persona_urls['persona'])
        .wclick(CSS['persona.org'].header.signIn)
        .wtype(CSS['persona.org'].signInForm.email, nspEmail)
        .wclick(CSS['persona.org'].signInForm.nextButton)
        .wtype(CSS['persona.org'].signInForm.password, nspEmail.split('@')[0])
        .wtype(CSS['persona.org'].signInForm.verifyPassword, nspEmail.split('@')[0])
        .wclick(CSS['persona.org'].signInForm.verifyEmailButton, done);
    },
    "get verification link": function(done) {
      restmail.getVerificationLink({email: nspEmail}, done);
    }, 
    "open link, verify you are redirected to acct mgr and see your email": function(done, link) {
      browser.chain()
        .get(link)
        .wtext(CSS['persona.org'].accountEmail, done)
    },
    "shut down zee browzr": function(done) {
      browser.quit(done);
    }
};

// ok, getting tired of this. TODO add to vowsHarness at once.
for (var x in new_secondary_mfb_two_browsers) { 
  new_secondary_123done_two_browsers[x] = new_secondary_mfb_two_browsers[x];
}
for (var x in new_secondary_personaorg) { 
  new_secondary_123done_two_browsers[x] = new_secondary_personaorg[x];
}
vowsHarness(new_secondary_123done_two_browsers, module);
