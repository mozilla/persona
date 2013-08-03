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
runner = require('../../lib/runner.js');

var browser, secondBrowser, theEmail, mfbEmail, nspEmail;

var new_secondary_123done_two_browsers = {
  "setup": function(done) {
    // this is the more compact setup syntax
    testSetup.setup({b:2, r:3}, function(err, fix) {
      if (fix) {
        browser = fix.b[0];
        secondBrowser = fix.b[1];
        theEmail = fix.r[0];
        mfbEmail = fix.r[1];
        nspEmail = fix.r[2];
      }
      done(err);
    });
  },
  "startup browser": function(done) {
    testSetup.newBrowserSession(browser, done);
  },
  "startup, go to 123done, click sign in": function(done) {
    browser.chain({onError: done})
      .get(persona_urls['123done'])
      .wclick(CSS['123done.org'].signinButton, done);
  },
  "switch to the persona dialog": function(done) {
    browser.wwin(CSS['persona.org'].windowName, done);
  },
  "enter incorrect email, cancel set password screen": function(done) {
    browser.chain({onError: done})
      .wtype(CSS['dialog'].emailInput, "incorrect_email@restmail.net")
      .wclick(CSS['dialog'].newEmailNextButton)
      .wclick(CSS['dialog'].submitCancelButton)
      .wclear(CSS['dialog'].emailInput, done);
  },
  "go through signup flow": function(done) {
    dialog.signInAsNewUser({
      browser: browser,
      email: theEmail,
      password: theEmail.split('@')[0]
    }, done);
  },
  "get another browser session": function(done) {
    testSetup.newBrowserSession(secondBrowser, done);
  },
  "get verification link from email": function(done) {
    restmail.getVerificationLink({ email: theEmail }, done);
  },
  "open verification link in new browser window": function(done, token, link) {
    secondBrowser.get(link, done);
  },
  "re-enter password and click login on persona.org": function(done) {
    secondBrowser.chain({onError: done})
      .wtype(CSS['persona.org'].signInForm.password, theEmail.split('@')[0])
      .wclick(CSS['persona.org'].signInForm.finishButton, done);
  },
  "verify the user is redirected to the manage page": function(done) {
    secondBrowser.wfind(CSS['persona.org'].accountManagerHeader, done);
  },
  "verify logged in automatically to 123done in first browser": function(done) {
    browser.chain({onError: done})
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        done(err || assert.equal(text, theEmail));
      });
  },
  "tear down both browsers": function(done) {
    browser.quit(function(err) {
      secondBrowser.quit(function(err2) {
        done(err || err2);
      });
    });
  }
};


var new_secondary_mfb_two_browsers = {
  "create a new selenium session": function(done) {
    testSetup.newBrowserSession(browser, done);
  },
  "load mfb and click the signin button": function(done) {
    browser.chain({onError: done})
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
  "create a second selenium session": function(done) {
    testSetup.newBrowserSession(secondBrowser, done);
  },
  "mfb get verification link from email": function(done) {
    restmail.getVerificationLink({ email: mfbEmail }, done);
  },
  "open verification link in second session and re-enter password": function(done, token, link) {
    secondBrowser.chain({onError: done})
      .get(link)
      .wtype(CSS['persona.org'].signInForm.password, mfbEmail.split('@')[0])
      .wclick(CSS['persona.org'].signInForm.finishButton, done);
  },
  "back in the first session, back to main window and verify we're auto-logged in as the expected user": function(done) {
    browser.chain({onError: done})
      .wwin()
      .wtext(CSS['myfavoritebeer.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, mfbEmail);
        done();
      });
  },
  "shut down browsers": function(done) {
    browser.quit(function(err) {
      secondBrowser.quit(function(err2) {
        done(err || err2);
      });
    });
  }
};

var new_secondary_personaorg = {
    // trying another super terse test. I find I'm liking these better and better,
    // but I'm afraid they will be totally unreadable if you only write these
    // tests once in a while
    "setup browser": function(done) {
      testSetup.newBrowserSession(browser, done);
    },
    "create restmail user at persona.org and verify logged in OK": function(done) {
      browser.chain({onError: done})
        .get(persona_urls['persona'])
        .wclick(CSS['persona.org'].header.signIn)
        .wwin(CSS['dialog'].windowName)
        .wtype(CSS['dialog'].emailInput, nspEmail)
        .wclick(CSS['dialog'].newEmailNextButton)
        .wtype(CSS['dialog'].choosePassword, nspEmail.split('@')[0])
        .wtype(CSS['dialog'].verifyPassword, nspEmail.split('@')[0])
        .wclick(CSS['dialog'].createUserButton, done);
    },
    "get verification link": function(done) {
      restmail.getVerificationLink({email: nspEmail}, done);
    },
    "open link, verify you are redirected to acct mgr and see your email": function(done, token, link) {
      browser.chain({onError: done})
        .wwin()
        .get(link)
        .wtext(CSS['persona.org'].accountEmail, done);
    },
    "shut down zee browzr": function(done) {
      browser.quit(done);
    }
};

runner.run(
  module,
  [new_secondary_123done_two_browsers, new_secondary_mfb_two_browsers, new_secondary_personaorg],
  {
    suiteName: path.basename(__filename),
    cleanup: function(done) { testSetup.teardown(done); }
  });
