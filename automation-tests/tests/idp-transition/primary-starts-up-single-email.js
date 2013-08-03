#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint sub: true */

// This test excercised codepaths when primaries come on line.  It
// uses testidp.org to create programatically controlled IdPs that can
// be turened on or off.  Both the cases where a user has an
// authenticated session with persona, and the case where she doesn't
// are excercised in this test.

const
path = require('path'),
assert = require('../../lib/asserts.js'),
restmail = require('../../lib/restmail.js'),
utils = require('../../lib/utils.js'),
persona_urls = require('../../lib/urls.js'),
CSS = require('../../pages/css.js'),
dialog = require('../../pages/dialog.js'),
runner = require('../../lib/runner.js'),
testSetup = require('../../lib/test-setup.js'),
// tools for creating "secondary" users
secondary = require('../../../tests/lib/secondary.js');

var browser;
var testidp, testidp2;

var email1, email2;

runner.run(module, {
  "setup": function(done) {
    testSetup.setup({browsers: 1, testidps: 2}, function(err, fixtures) {
      if (fixtures) {
        browser = fixtures.browsers[0];
        testidp = fixtures.testidps[0];
        testidp2 = fixtures.testidps[1];
      }
      done(err);
    });
  },
  "turn off idps so we can create secondary users": function(done) {
    testidp.turnOffSupport(function(err) {
      if (err) done(err);
      else testidp2.turnOffSupport(done);
    });
  },
  "create two secondary users using the domain": function(done) {
    email1 = testidp.getRandomEmail();
    email2 = testidp2.getRandomEmail();

    // Here we'll use an abstraction around server APIs to programatically
    // create secondary accounts.  By directly hitting server APIs we don't
    // needlessly re-test secondary account creation flows and tests run faster.
    secondary.create({
      email: email1,
      password: 'password',
      fetchVerificationLinkCallback: restmail.getVerificationLink
    }, function(err) {
      if (err) return done(err);
      secondary.create({
        email: email2,
        password: 'password',
        fetchVerificationLinkCallback: restmail.getVerificationLink
      }, done);
    });
  },
  "create a new selenium session": function(done) {
    testSetup.newBrowserSession(browser, done);
  },
  //
  // First let's test the case where a user is authenticated to persona, they
  // have an email address that is a secondary address, and their email provider
  // turn on persona support.
  //
  "authenticate to persona with our username and password as a secondary": function(done) {
    browser.chain()
      .get(persona_urls["123done"])
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS["persona.org"].windowName, function(err) {
        if (err) return done(err);
        dialog.signInExistingUser({
          browser: browser,
          email: email2,
          password: 'password'
        }, done);
      });
  },
  "verify user is logged in on page reload": function(done) {
    browser.chain({onError: done})
      .wwin()
      .refresh()
      .wfind(CSS['123done.org'].logoutLink, done);
  },
  "enable primary support for the transition when authed test": function(done) {
    testidp2.enableSupport(done);
  },
  "verify user is logged out on page reload - email is in transition state":
      function(done) {
    browser.chain({onError: done})
      .refresh()
      .wfind(CSS['123done.org'].signinButton, done);
  },
  "enter the dialog": function(done) {
    browser.chain()
      .wwin()
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS["persona.org"].windowName, done);
  },
  //
  // Key moment!  Here's where we see happy messaging right
  // after we select the email, and before we're sent to
  // our email provider to authenticate.
  //
  "select the previously secondary email address": function(done) {
    browser.chain()
      .wclick(CSS['dialog'].signInButton)
      // before being re-directed, we'll see language about how
      // this is now awesome and easy
      .wclick(CSS['dialog'].verifyWithPrimaryButton)
      .wclick(CSS['testidp.org'].loginButton)
      .wwin(done);
  },
  //
  // Now let's test the non-authenticated case.  A user has an account with
  // and address on it, the address is a secondary email address, and they
  // go to sign into persona with it one day, only to find that it's
  // now a secondary
  //
  "enable primary support for the transition when not authed test": function(done) {
    testidp.enableSupport(done);
  },
  "setup for the second test - log out and enter the dialog, and logout of persona": function(done) {
    browser.chain()
      .wclick(CSS['123done.org'].logoutLink)
      .get(persona_urls["123done"])
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS["persona.org"].windowName)
      .wclick(CSS["dialog"].thisIsNotMe, done);
  },
  "enter a previously-secondary email address and log in": function(done) {
    browser.chain()
      .wtype(CSS['dialog'].emailInput, email1)
      .wclick(CSS['dialog'].newEmailNextButton)
      // upon first use, it's important we *do* see a button. and
      // language about how this domain makes this easy
      .wclick(CSS['dialog'].verifyWithPrimaryButton)
      .wclick(CSS['testidp.org'].loginButton)
      .wwin(done);
  },
  "now log out and enter the dialog, and logout of persona": function(done) {
    browser.chain()
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS["persona.org"].windowName)
      .wclick(CSS["dialog"].thisIsNotMe, done);
  },
  //
  // And a final high level thing to excercise here.  That the user sees
  // happy "your provider makes this easy" language once and only once.
  //
  "log in again with the transitioned secondary email address": function(done) {
    browser.chain()
      .wtype(CSS['dialog'].emailInput, email1)
      .wclick(CSS['dialog'].newEmailNextButton)
      // upon second use, no language about how this is easy, no button
      .wclick(CSS['testidp.org'].loginButton)
      .wwin(done);
  }
},
{
  suiteName: path.basename(__filename),
  cleanup: function(done) { testSetup.teardown(done); }
});
