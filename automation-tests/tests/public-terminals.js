#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint sub: true */

const
path = require('path'),
assert = require('../lib/asserts.js'),
restmail = require('../lib/restmail.js'),
utils = require('../lib/utils.js'),
persona_urls = require('../lib/urls.js'),
CSS = require('../pages/css.js'),
dialog = require('../pages/dialog.js'),
testSetup = require('../lib/test-setup.js'),
runner = require('../lib/runner.js');

var browser, secondary;

/*
 * - sign up as a new user via an RP
 * - hack localStorage to simulate 60+ seconds of wait
 *   // need to make sure usersComputer[userID].state == 'seen'
 *   // need to make sure usersComputer[userID].updated is at least 60s in the past
 * - login to another persona site
 * - verify 'is this your computer' screen is displayed
 *   - verify clicking 'yes' extends session
 *   // sets usersComputer.state to 'confirmed', doesn't ask again
 *   - verify clicking 'no' does not extend session
 *   // sets usersComputer.state to 'denied', doesn't ask again
 *
 */
runner.run(module, {
  'pull in test environment': function(done) {
    testSetup.setup({browsers: 1, restmails: 1}, function(err, fixtures) {
      if (fixtures) {
        browser = fixtures.browsers[0];
        secondary = fixtures.restmails[0];
      }
      done(err);
    });
  },
  'startup browser': function(done) {
    testSetup.newBrowserSession(browser, done);
  },
  'create new secondary via mfb': function(done) {
    browser.chain({onError: done})
      .get(persona_urls['myfavoritebeer'])
      .wclick(CSS['myfavoritebeer.org'].signinButton)
      .wwin(CSS['persona.org'].windowName, function(err) {
        if (err) return done(err);
        dialog.signInAsNewUser({
          browser: browser,
          email: secondary,
          password: secondary.split('@')[0]
        }, done);
      });
  },
  'do the restmail verification step': function(done) {
    restmail.getVerificationLink({ email: secondary }, done);
  },
  'open persona.org verification link and wait for congrats message': function(done, token, link) {
    browser.chain({onError: done})
      .wwin()
      .get(link)
      .wfind(CSS['persona.org'].accountManagerHeader, done);
  },
  'hack localStorage to simulate 60 seconds of inactivity': function(done) {
    /*jshint evil:true */

    // JSON.parse to get user id, JSON.parse usersCOmputer, rewind time,
    // stringify and finally set as local storage.
    var rewindOneMinute = '(function() { ' +
      'var usersComputer = JSON.parse(localStorage.getItem("usersComputer")); ' +
      'var userId = JSON.parse(localStorage.emailToUserID)["' + secondary + '"]; ' +
      'var orig = updatedTime = new Date(usersComputer[userId].updated); ' +
      'var hackedTime = updatedTime.setMinutes(updatedTime.getMinutes() - 1); ' +
      'usersComputer[userId].updated = new Date(hackedTime).toString(); ' +
      /* you can have this eval return storable for debugging */
      'var storable = JSON.stringify(usersComputer); ' +
      'localStorage.setItem("usersComputer", storable); ' +
      '})();';

    browser.chain({onError: done})
      .wclick(CSS['persona.org'].header.signIn)
      .wfind(CSS['persona.org'].accountManagerHeader) // make sure we're logged in
      .eval(rewindOneMinute, function(err) {
        // you can echo out eval's return value for debugging
        // console.error(out);
        done(err);
      });
  },
  'go to 123done, click log in, click "thats my email" button': function(done) {
    browser.chain({onError: done})
      .get(persona_urls['123done'])
      .wclick(CSS['123done.org'].signinButton)
      .wwin(CSS['persona.org'].windowName)
      .wclick(CSS['dialog'].signInButton, done);
  },
  // TODO here's where the two tests differ: extract setup vows from assert vows
  // TODO figure out which cases to cover now that we've hacked localStorage
  'click "this is my computer" and the session should last a long time': function(done) {
    browser.wclick(CSS['dialog'].myComputerButton, done);
  },
  "until we decide what to do, at least end the session properly": function(done) {
    browser.quit(done);
  }
},
{
  suiteName: path.basename(__filename),
  cleanup: function(done) { testSetup.teardown(done); }
});
