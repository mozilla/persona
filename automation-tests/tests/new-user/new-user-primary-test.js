#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
path = require('path'),
wd = require('wd'),
assert = require('assert'),
restmail = require('../../lib/restmail.js'),
utils = require('../../lib/utils.js'),
persona_urls = require('../../lib/urls.js'),
CSS = require('../../pages/css.js'),
dialog = require('../../pages/dialog.js'),
vowsHarness = require('../../lib/vows_harness.js');

// add fancy helper routines to wd
require('../../lib/wd-extensions.js');

var browser = wd.remote();
var eyedeemail = restmail.randomEmail(10, 'eyedee.me');

vowsHarness({
  "startup, load 123done, click sign in": function(done) {
    browser.chain()
      .newSession()
      .get(persona_urls["123done"])
      .wclick(CSS["123done.org"].signinButton, done);
  },
  "sign in a new eyedeemee user": function(done) {
    browser.chain()
      .wwin(CSS['persona.org'].windowName)
      .wtype(CSS['dialog'].emailInput, eyedeemail)
      .wclick(CSS['dialog'].newEmailNextButton)
      .wclick(CSS['dialog'].verifyWithPrimaryButton)
      // for some reason, this button sometimes gets stuck. click it twice.
      .wclick(CSS['dialog'].verifyWithPrimaryButton)
      .wtype(CSS['eyedee.me'].newPassword, eyedeemail.split('@')[0])
      .wclick(CSS['eyedee.me'].createAccountButton, done);
  },
  // TODO 123done never seems to log in. something up with beta server?
  "switch back to main window and verify we're logged in": function(done) {
    browser.chain()
      .wwin()
      .wtext(CSS['123done.org'].currentlyLoggedInEmail, function(err, text) {
        assert.equal(text, eyedeemail);
        done()
      });
  }
}, module);
