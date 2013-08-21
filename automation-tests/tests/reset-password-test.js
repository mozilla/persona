#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint sub: true */

const
path = require('path'),
assert = require('../lib/asserts.js'),
utils = require('../lib/utils.js'),
restmail = require('../lib/restmail.js'),
persona_urls = require('../lib/urls.js'),
CSS = require('../pages/css.js'),
dialog = require('../pages/dialog.js'),
runner = require('../lib/runner.js'),
testSetup = require('../lib/test-setup.js'),
user = require('../lib/user.js'),
NEW_PASSWORD = "password";

var browser;
var verificationBrowser;

var addressInitiatingReset;
var addressVerifiedAtSignIn;
var addressVerifiedFromEmailPicker;
var password;

var getVerifiedUser = user.getVerifiedUser;

function addSecondaryAddress(addressToAdd, done) {

  stageNewAddress(function(err) {
    if (err) return done(err);
    verifyNewAddress(function(err) {
      if (err) return done(err);
      signOutOfMyFavoriteBeer(done);
    });
  });

  function stageNewAddress(done) {
    browser.chain({onError: done})
      .wclick(CSS['myfavoritebeer.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].useNewEmail)
      .wtype(CSS['dialog'].newEmail, addressToAdd)
      .wclick(CSS['dialog'].addNewEmailButton, done);
  }

  function verifyNewAddress(done) {
    restmail.getVerificationLink({ email: addressToAdd }, function(err, token, link) {
      testSetup.newBrowserSession(verificationBrowser, function() {
        verificationBrowser.chain({onError: done})
          .get(link)
          .wtype(CSS['persona.org'].signInForm.password, password)
          .wclick(CSS['persona.org'].signInForm.finishButton)
          .wfind(CSS['persona.org'].header.signOut)
          .quit(done);
      });
    });
  }

  function signOutOfMyFavoriteBeer(done) {
    browser.chain({onError: done})
      .wwin()
      .wclick(CSS['myfavoritebeer.org'].logoutLink, done);
  }
}

function findElementForAddress(addressToFind, done) {
  var addressesFound = [];

  browser.elementsByName('email', searchElementsForAddress);

  function searchElementsForAddress(err, elements) {
    if (err) return done(err);

    var elToCheck = elements.shift();
    if (!elToCheck)
        return done("could not find element with address: " + addressToFind + " emails found: " + JSON.stringify(addressesFound, null, 2));

    browser.getValue(elToCheck, function(err, elAddress) {
      if (err) return done(err);

      addressesFound.push(elAddress);

      if (elAddress == addressToFind) return done(null, elToCheck);
      searchElementsForAddress(null, elements);
    });
  }
}


runner.run(module, {
  "setup": function(done) {
    // this is the more compact setup syntax
    testSetup.setup({browsers:2, restmails: 2}, function(err, fix) {
      if (fix) {
        browser = fix.browsers[0];
        verificationBrowser = fix.browsers[1];
        // addressInitiatingReset is fetched in "get a verified user"
        addressVerifiedAtSignIn = fix.restmails[0];
        addressVerifiedFromEmailPicker = fix.restmails[1];
      }
      done(err);
    });
  },

  // So much setup to get an account with three addresses!
  "get a verified user": function(done) {
    getVerifiedUser(function(err, user) {
      addressInitiatingReset = user.email;
      password = user.password;
      done(err);
    });
  },
  "start browser session": function(done) {
    testSetup.newBrowserSession(browser, done);
  },
  "open myfavoritebeer, open dialog, sign in first user": function(done) {
    browser.chain({onError: done})
      .get(persona_urls['myfavoritebeer'])
      .wclick(CSS['myfavoritebeer.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      .wtype(CSS['dialog'].emailInput, addressInitiatingReset)
      .wclick(CSS['dialog'].newEmailNextButton)
      .wtype(CSS['dialog'].existingPassword, password)
      .wclick(CSS['dialog'].returningUserButton)
      .wwin()
      .wclick(CSS['myfavoritebeer.org'].logoutLink, done);
  },

  "add addressVerifiedAtSignIn": function(done) {
    addSecondaryAddress(addressVerifiedAtSignIn, done);
  },

  "add addressVerifiedFromEmailPicker": function(done) {
    addSecondaryAddress(addressVerifiedFromEmailPicker, done);
  },

  "reset password for addressInitiatingReset": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['myfavoritebeer.org'].signinButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].thisIsNotMe)
      .wtype(CSS['dialog'].emailInput, addressInitiatingReset)
      .wclick(CSS['dialog'].newEmailNextButton)
      .wclick(CSS['dialog'].forgotPassword, done);
  },

  "complete reset for addressInitiatingReset": function(done) {
    restmail.getVerificationLink({ email: addressInitiatingReset, index: 1 }, function(err, token, link) {
      testSetup.newBrowserSession(verificationBrowser, function() {
        verificationBrowser.chain({onError: done})
          .get(link)
          .wtype(CSS['persona.org'].signInForm.password, NEW_PASSWORD)
          .wtype(CSS['persona.org'].signInForm.verifyPassword, NEW_PASSWORD)
          .wclick(CSS['persona.org'].signInForm.finishButton)
          .wfind(CSS['persona.org'].accountManagerHeader)
          .quit(done);
      });
    });
  },

  "after password reset, original browser asks for new password 'cause this is a different browser": function(done) {
    browser.chain({onError: done})
      .wtype(CSS['dialog'].postVerificationPassword, NEW_PASSWORD)
      .wclick(CSS['dialog'].postVerificationPasswordButton, done);
  },

  "make sure user is signed in to RP after password reset": function(done) {
    browser.chain({onError: done})
      .wwin()
      .wtext(CSS['myfavoritebeer.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, addressInitiatingReset));
      });
  },


  "try to sign in with addressVerifiedAtSignIn: user must enter password and verify - address marked as unverified after pw reset": function(done) {
    browser.chain({onError: done})
      .wwin()
      .wclick(CSS['myfavoritebeer.org'].logout)
      .wclick(CSS['myfavoritebeer.org'].signinButton)
      .wwin(CSS['dialog'].windowName)
      .wclick(CSS['dialog'].thisIsNotMe)
      .wtype(CSS['dialog'].emailInput, addressVerifiedAtSignIn)
      .wclick(CSS['dialog'].newEmailNextButton)
      .wtype(CSS['dialog'].existingPassword, NEW_PASSWORD)
      .wclick(CSS['dialog'].returningUserButton)
      .wfind(CSS['dialog'].confirmAddressScreen, done);
  },

  "in a new browser, verify addressVerifiedAtSignIn": function(done) {
    restmail.getVerificationLink({ email: addressVerifiedAtSignIn, index: 1 }, function(err, token, link) {
      testSetup.newBrowserSession(verificationBrowser, function() {
        verificationBrowser.chain({onError: done})
          .get(link)
          .wtype(CSS['persona.org'].signInForm.password, NEW_PASSWORD)
          .wclick(CSS['persona.org'].signInForm.finishButton)
          .wfind(CSS['persona.org'].accountManagerHeader)
          .quit(done);
      });
    });
  },

  "make sure user is signed in to RP after password reset as addressVerifiedAtSignIn": function(done) {
    browser.chain({onError: done})
      .wwin()
      .wtext(CSS['myfavoritebeer.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, addressVerifiedAtSignIn));
      });
  },

  "open dialog again and make sure user is signed in to Persona": function(done) {
    browser.chain({onError: done})
      .wclick(CSS['myfavoritebeer.org'].logout)
      .wclick(CSS['myfavoritebeer.org'].signInButton)
      .wwin(CSS['dialog'].windowName)
      // the thisIsNotMe button is only displayed if the user is already
      // authenticated.
      .wfind(CSS['dialog'].thisIsNotMe, done);
  },

  "select addressVerifiedFromEmailPicker from the email picker - it must be verified": function(done) {
    findElementForAddress(addressVerifiedFromEmailPicker, function(err, el) {
      if (err) return done(err);

      browser.chain({onError: done})
        .clickElement(el)
        .wclick(CSS['dialog'].signInButton)
        .wfind(CSS['dialog'].confirmAddressScreen, done);
    });
  },

  "in a new browser, verify addressVerifiedFromEmailPicker": function(done) {
    restmail.getVerificationLink({ email: addressVerifiedFromEmailPicker, index: 1 }, function(err, token, link) {
      testSetup.newBrowserSession(verificationBrowser, function() {
        verificationBrowser.chain({onError: done})
          .get(link)
          .wtype(CSS['persona.org'].signInForm.password, NEW_PASSWORD)
          .wclick(CSS['persona.org'].signInForm.finishButton)
          .wfind(CSS['persona.org'].accountManagerHeader)
          .quit(done);
      });
    });
  },

  "make sure user is signed in to RP after password reset as addressVerifiedFromEmailPicker": function(done) {
    browser.chain({onError: done})
      .wwin()
      .wtext(CSS['myfavoritebeer.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, addressVerifiedFromEmailPicker));
      });
  },

  "shut down remaining browsers": function(done) {
    browser.quit(done);
  }
},
{
  suiteName: path.basename(__filename),
  cleanup: function(done) { testSetup.teardown(done); }
});
