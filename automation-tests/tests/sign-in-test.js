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
  browserId = testSetup.startup(),
  browser = testSetup.browsers[browserId],
  testUser;

vowsHarness({
  "create a new selenium session": function(done) {
    browser.newSession(testSetup.sessionOpts, done);
  },
  "create a new personatestuser": function(done) {
    personatestuser.getVerifiedUser({ env: process.env['PERSONA_ENV'] || 'dev' }, function(err, user, blob) { 
      if (err) { throw new Error('error getting persona test user: ' + err) }
      testUser = user;
      done()
    })
  },
  "load 123done and wait for the signin button to be visible": function(done) {
    browser.get(persona_urls["123done"], done);
  },
  "click the signin button": function(done, el) {
    browser.wclick(CSS['123done.org'].signinButton, done);
  },
  "switch to the dialog when it opens": function(done) {
    browser.wwin(CSS["persona.org"].windowName, done);
  },
  "sign in with the usual fake account": function(done) {
    dialog.signInExistingUser({
      browser: browser,
      email: testUser.email,
      password: testUser.pass
    }, done);
  },
  "verify signed in to 123done": function(done) {
    browser.chain()
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, testUser.email);
        done()
       });
  },
  "tear down browser": function(done) {
    browser.quit(done);
  },

  // tricky: you can't have duplicate keys or weird things happen

  // todo extract duplication!
  "create another selenium session": function(done) {
    browser.newSession(done);
  },
  "create another new personatestuser": function(done) {
    personatestuser.getVerifiedUser({ env: process.env['PERSONA_ENV'] || 'dev' }, function(err, user, blob) { 
      if (err) { throw new Error('error getting persona test user: ' + err) }
      testUser = user;
      done()
    })
  },
  "load myfavoritebeer and wait for the signin button to be visible": function(done) {
    browser.chain()
      .get(persona_urls['myfavoritebeer'])
      .wclick(CSS['myfavoritebeer.org'].signinButton, done);
  },
  "mfb switch to the dialog when it opens": function(done) {
    browser.wwin(CSS["persona.org"].windowName, done);
  },
  "mfb sign in with the usual fake account": function(done) {
    dialog.signInExistingUser({
      browser: browser,
      email: testUser.email,
      password: testUser.pass
    }, done);
  },
  "verify signed in to myfavoritebeer": function(done) {
    browser.chain()
      .wwin()
      .wtext(CSS['myfavoritebeer.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, testUser.email);
        done()
      });
  },
  "mfb tear down browser": function(done) {
    browser.quit(done);
  }
}, module);
