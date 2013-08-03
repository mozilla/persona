#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint sub: true */

const
assert = require('../../lib/asserts.js'),
CSS = require('../../pages/css.js'),
path = require('path'),
persona_urls = require('../../lib/urls.js'),
restmail = require('../../lib/restmail.js'),
runner = require('../../lib/runner.js'),
testSetup = require('../../lib/test-setup.js');

var browser, testUser, testIdp, noAuthTestUser;

runner.run(module, {
  "setup": function(done) {
    testSetup.setup({browsers: 1, testidps: 1}, function(err, fixtures) {
      if (fixtures) {
        browser = fixtures.browsers[0];
        testIdp = fixtures.testidps[0];
        testUser = testIdp.getRandomEmail();
        noAuthTestUser = testIdp.getRandomEmail();
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
  "Happy, healthy primary": function(done) {
    testIdp.enableSupport(false, done);
  },
  "Sign in": function(done) {
    browser.chain({onError: done})
      .wtype(CSS['dialog'].emailInput, testUser)
      .wclick(CSS['dialog'].newEmailNextButton, done);
  },
  "verify we're signed in to 123done": function(done) {
    browser.chain({onError: done})
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, testUser));
       });
  },
  "verify user is logged in on page reload": function(done) {
    browser.chain({onError: done})
      .refresh()
      .wfind(CSS['123done.org'].logoutLink, done);
  },
  "The IdP disables support": function(done) {
    testIdp.disableSupport(done);
  },
  "verify user is logged out on page reload - email is in transition state":
      function(done) {
    browser.chain({onError: done})
      .refresh()
      .wfind(CSS['123done.org'].signinButton, done);
  },
  "Authed user tries to log in": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].signInButton)
      .wtype(CSS['dialog'].choosePassword, 'password')
      .wtype(CSS['dialog'].verifyPassword, 'password')
      .wclick(CSS['dialog'].createUserButton, done);
  },
  "Verify testUser email": function(done) {
    var verifyWindow = 'verifyWindow1';
    restmail.getVerificationLink(testUser, function(err, token, verificationURL) {
      browser.chain({onError: done})
          .newWindow(verificationURL, verifyWindow)
          .wwin(verifyWindow)
          .waitForDisplayed({which: CSS['123done.org'].logoutLink})
          .close()
          .wwin(done);
    });
  },
  "Check testUser is logged in": function(done) {
      browser.wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, testUser));
      });
  },
  "Authed user logs out and in": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS['dialog'].windowName, done);
  },
  "testUser can use new password": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['dialog'].thisIsNotMe)
      .wtype(CSS['dialog'].emailInput, testUser)
      .wclick(CSS['dialog'].newEmailNextButton)
      .wtype(CSS['dialog'].existingPassword, 'password')
      .wclick(CSS['dialog'].returningUserButton)
      .wclickIfExists(CSS['dialog'].notMyComputerButton)
      .wwin(done);
  },
  "Check testUser is logged in again": function(done) {
      browser.wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, testUser));
      });
  },
  "A new user (noAuthTestUser) tries to log in": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['123done.org'].logoutLink)
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].thisIsNotMe)
      .wtype(CSS['dialog'].emailInput, noAuthTestUser)
      .wclick(CSS['dialog'].newEmailNextButton)
      .wtype(CSS['dialog'].choosePassword, 'anotherpassword')
      .wtype(CSS['dialog'].verifyPassword, 'anotherpassword')
      .wclick(CSS['dialog'].createUserButton, done);
  },
  "Verify noAuthTestUser email": function(done) {
    var verifyWindow = 'verifyWindow2';
    restmail.getVerificationLink(noAuthTestUser, function(err, token, verificationURL) {
      browser.chain({onError: done})
          .newWindow(verificationURL, verifyWindow)
          .wwin(verifyWindow)
          .waitForDisplayed({which: CSS['123done.org'].logoutLink})
          .close()
          .wwin(done);
    });
  },
  "Check noAuthTestUser is logged in": function(done) {
      browser.wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, noAuthTestUser));
      });
  }
},
{
  suiteName: path.basename(__filename),
  cleanup: function(done) { testSetup.teardown(done); }
});
