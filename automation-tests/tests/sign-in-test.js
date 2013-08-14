#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint sub: true */

const
path = require('path'),
assert = require('../lib/asserts.js'),
utils = require('../lib/utils.js'),
persona_urls = require('../lib/urls.js'),
CSS = require('../pages/css.js'),
dialog = require('../pages/dialog.js'),
runner = require('../lib/runner.js'),
testSetup = require('../lib/test-setup.js');

var browser, testUser;

runner.run(module, {
  "setup": function(done) {
    testSetup.setup({browsers: 1, personatestusers: 1}, function(err, fixtures) {
      if (fixtures) {
        browser = fixtures.browsers[0];
        testUser = fixtures.personatestusers[0];
      }
      done(err);
    });
  },
  "create a new selenium session": function(done) {
    testSetup.newBrowserSession(browser, done);
  },
  "load 123done and wait for the signin button to be visible": function(done) {
    browser.get(persona_urls["123done"], done);
  },
  "click the signin button": function(done) {
    browser.wclick(CSS['123done.org'].signinButton, done);
  },
  "switch to the dialog when it opens": function(done) {
    browser.wwin(CSS["persona.org"].windowName, done);
  },
  "sign in with the personatestuser account": function(done) {
    dialog.signInExistingUser({
      browser: browser,
      email: testUser.email,
      password: testUser.pass
    }, done);
  },
  "verify signed in to 123done": function(done) {
    browser.chain({onError: done})
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, testUser.email));
       });
  },

  "tear down browser": function(done) {
    browser.quit(done);
  },

  // todo extract duplication!
  "create another selenium session": function(done) {
    testSetup.newBrowserSession(browser, done);
  },
  "load myfavoritebeer and wait for the signin button to be visible": function(done) {
    browser.chain({onError: done})
      .get(persona_urls['myfavoritebeer'])
      .wclick(CSS['myfavoritebeer.org'].signinButton, done);
  },
  "mfb switch to the dialog when it opens": function(done) {
    browser.wwin(CSS["persona.org"].windowName, done);
  },
  "mfb sign in with allcaps personatestuser - signin is case insensitive": function(done) {
    dialog.signInExistingUser({
      browser: browser,
      email: testUser.email.toUpperCase(),
      password: testUser.pass
    }, done);
  },
  "verify signed in to myfavoritebeer": function(done) {
    browser.chain({onError: done})
      .wwin()
      .wtext(CSS['myfavoritebeer.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, testUser.email));
      });
  }

},
{
  suiteName: path.basename(__filename),
  cleanup: function(done) { testSetup.teardown(done); }
});
