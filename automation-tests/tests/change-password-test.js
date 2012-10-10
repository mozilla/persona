#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
path = require('path'),
assert = require('assert'),
utils = require('../lib/utils.js'),
persona_urls = require('../lib/urls.js'),
CSS = require('../pages/css.js'),
dialog = require('../pages/dialog.js'),
vowsHarness = require('../lib/vows_harness.js'),
personatestuser = require('../lib/personatestuser.js');

// this should really be testSetup({browsers: 2, personatestusers: 1})
var testSetup = require('../lib/test-setup.js'),
  firstSession = testSetup.startup(),
  browser = testSetup.browsers[firstSession],
  secondSession = testSetup.startup(),
  secondBrowser = testSetup.browsers[secondSession],
  testUser;

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
  "sign in to 123done using personatestuser": function(done) {
    browser.chain()
      .get(persona_urls["123done"])
      .wclick(CSS["123done.org"].signinButton, done);
  },
  "switch to the dialog when it opens": function(done) {
    browser.wwin(CSS["persona.org"].windowName, done);
  },
  "sign in using our personatestuser": function(done) {
    dialog.signInExistingUser({
      browser: browser,
      email: testUser.email,
      password: testUser.pass
    }, done);
  },
  "verify we're logged in as the expected user": function(done) {
    browser.chain()
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, testUser.email);
        done();
      });
  },
  "go to the account manager": function(done) {
    browser.chain()
      .get(persona_urls['persona'])
      .wtext(CSS['persona.org'].accountManagerHeader, function(err, text) {
        assert.equal(text, 'Account Manager');
        done();
      });
    },
  "make sure the right account is logged in": function(done) {
    browser.wtext(CSS['persona.org'].accountEmail, function(err, text) {
      assert.equal(text, testUser.email);
      done();
    });
  },
  "click the change password button": function(done) {
    browser.wclick(CSS["persona.org"].changePasswordButton, done);
  },
  "enter old and new passwords and click done": function(done) {
    browser.chain()
      .wtype(CSS['persona.org'].oldPassword, testUser.pass)
      .wtype(CSS['persona.org'].newPassword, 'new' + testUser.pass)
      .wclick(CSS['persona.org'].passwordChangeDoneButton, done);
  },
  "wait for the change password button to go back before leaving": function(done) {
      browser.wfind(CSS['persona.org'].changePasswordButton, done);
  },
  "back to 123done": function(done) {
    browser.get(persona_urls["123done"], done);
  },
  "click sign out and sign in": function(done) {
    browser.chain()
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS["123done.org"].signinButton, done);
  },
  "switch to the dialog and click not-my-account": function(done) {
    browser.chain()
      .wwin(CSS["persona.org"].windowName)
      .wclick(CSS["dialog"].thisIsNotMe, done);
  },
  "sign in using the changed password": function(done) {
    dialog.signInExistingUser({
      browser: browser,
      email: testUser.email,
      password: 'new' + testUser.pass
    }, done);
  },
  "finally, verify signed in to 123done": function(done) {
    browser.chain()
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, testUser.email);
        done();
      });
  },
  "shut down": function(done) {
    browser.quit(done);
  }
}, module);
