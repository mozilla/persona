#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint sub: true */

const
path = require('path'),
assert = require('../../lib/asserts.js'),
restmail = require('../../lib/restmail.js'),
utils = require('../../lib/utils.js'),
persona_urls = require('../../lib/urls.js'),
CSS = require('../../pages/css.js'),
dialog = require('../../pages/dialog.js'),
testSetup = require('../../lib/test-setup.js'),
runner = require('../../lib/runner.js'),
timeouts = require('../../lib/timeouts.js');

var browser, testIdp, primaryEmail, theEmail, primaryEmail_mfb, porg_primaryEmail;

function dialogTestIdpFlow(b, email, cb) {
  b.chain({onError: cb})
    .wwin(CSS['persona.org'].windowName)
    .wtype(CSS['dialog'].emailInput, email)
    .wclick(CSS['dialog'].newEmailNextButton)
    .wclick(CSS['testidp.org'].loginButton, cb);
}

var primary_123done = {
  "setup": function(done) {
    testSetup.setup({browsers: 1, testidps: 1, restmails: 1}, function(err, fixtures) {
      if (fixtures) {
        browser = fixtures.browsers[0];
        testIdp = fixtures.testidps[0];
        primaryEmail = testIdp.getRandomEmail();
        primaryEmail_mfb = testIdp.getRandomEmail();
        porg_primaryEmail = testIdp.getRandomEmail();
        theEmail = fixtures.restmails[0];
      }
      done(err);
    });
  },
  "enable primary support": function(done) {
    testIdp.enableSupport(done);
  },
  "startup browser": function(done) {
    testSetup.newBrowserSession(browser, done);
  },
  "load 123done, click sign in": function(done) {
    browser.chain({onError: done})
      .get(persona_urls['123done'])
      .wclick(CSS['123done.org'].signinButton, done);
  },
  "sign in a new testIdp user": function(done) {
    dialogTestIdpFlow(browser, primaryEmail, done);
  },
  // TODO 123done never seems to log in. something up with beta server?
  "switch back to main window and verify we're logged in": function(done) {
    browser.chain({onError: done})
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, primaryEmail));
      });
  },
  "123done end this browser session": function(done) {
    browser.quit(done);
  }
};

var mcss = CSS['myfavoritebeer.org'],
  primary_mfb = {
    "startup browser": function(done) {
      testSetup.newBrowserSession(browser, done);
    },
    "go to mfb, click sign in, switch to dialog": function(done) {
      browser.chain({onError: done})
        .get(persona_urls['myfavoritebeer'])
        .wclick(mcss.signinButton, done);
    },
    "sign in using testIdp": function(done) {
      dialogTestIdpFlow(browser, primaryEmail_mfb, done);
    },
    "back to mfb, check we logged in OK": function(done) {
      browser.chain({onError: done})
        .wwin()
        .wtext(CSS['myfavoritebeer.org'].currentlyLoggedInEmail, function(err, text) {
          done(err || assert.equal(text, primaryEmail_mfb));
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
    // open browser, go to persona.org, click sign in, enter primaryEmail, click next
    // click verify primary button, switch to popup, enter password, click ok
    // switch back to main window, look for email in acct mgr, log out
    "startup browser": function(done) {
      testSetup.newBrowserSession(browser, done);
    },
    "create testidp primary at persona.org and verify logged in OK": function(done) {
      browser.chain({onError: done})
        .get(persona_urls['persona'])
        .wclick(pcss.header.signIn)
        .wwin(CSS['dialog'].windowName)
        .wtype(CSS['dialog'].emailInput, porg_primaryEmail)
        .wclick(CSS['dialog'].newEmailNextButton)
        .wclick(CSS['testidp.org'].loginButton)
        .wwin()
        .wtext(pcss.accountEmail, function(err, text) {
          done(err || assert.equal(porg_primaryEmail.toLowerCase(), text)); // note
        });
    },
    "log out": function(done) {
      browser.chain({onError: done})
        .wclick(pcss.header.signOut)
        .quit(done);
    }
};

runner.run(
  module,
  [primary_123done, primary_mfb, primary_personaorg],
  {
    suiteName: path.basename(__filename),
    cleanup: function(done) { testSetup.teardown(done); }
  });
