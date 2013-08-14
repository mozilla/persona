/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint sub: true */

const
assert = require('../lib/asserts.js'),
restmail = require('../lib/restmail.js'),
CSS = require('./css.js');

function verifyOpts(optionList, opts) {
  optionList.forEach(function(required) {
    if (!opts[required]) throw ("Error: missing required argument '"+required+"'");
  });
}

/**
 * Log user out of 123done, re-open dialog
 */
exports.logoutOpenDialog = function(browser, done) {
  browser.chain({onError: done})
    .wwin()
    .wclick(CSS['123done.org'].logoutLink)
    .wclick(CSS['123done.org'].signinButton)
    .wwin(CSS['dialog'].windowName, done);
};

/**
 * Complete email verification, wait for the logout link
 */
exports.completeEmailVerification = function(opts, done) {
  verifyOpts(['email', 'browser'], opts);
  var email = opts.email;
  var browser = opts.browser;

  var verifyWindow = 'verifyWindow1';
  restmail.getVerificationLink(email, function(err, token, verificationURL) {
    browser.chain({onError: done})
        .newWindow(verificationURL, verifyWindow)
        .wwin(verifyWindow)
        .waitForDisplayed({which: CSS['123done.org'].logoutLink})
        .close()
        .wwin(done);
  });
};

/**
 * Complete password reset, wait for the logout link
 */
exports.completePasswordReset = function(opts, done) {
  verifyOpts(['email', 'browser', 'password'], opts);
  var email = opts.email;
  var browser = opts.browser;
  var password = opts.password;

  var verifyWindow = 'verifyWindow1';
  restmail.getVerificationLink(email, function(err, token, verificationURL) {
    browser.chain({onError: done})
        .newWindow(verificationURL, verifyWindow)
        .wwin(verifyWindow)
        .wtype(CSS['persona.org'].signInForm.password, password)
        .wtype(CSS['persona.org'].signInForm.verifyPassword, password)
        .wclick(CSS['persona.org'].signInForm.finishButton)
        .waitForDisplayed({which: CSS['123done.org'].logoutLink})
        .close()
        .wwin(done);
  });
};

/**
 * Test if expected user is signed in to 123done
 */
exports.testSignedInUser = function(opts, done) {
  verifyOpts(['email', 'browser'], opts);
  var email = opts.email;
  var browser = opts.browser;

  browser.chain({onError: done})
    .wwin()
    .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
    done(err || assert.equal(text, email));
  });
};

