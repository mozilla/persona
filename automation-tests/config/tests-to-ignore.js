/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// These are tests to ignore
// XXX extract duplication if this file gets significantly longer

var testsToIgnore = {
  dev: [
    "public-terminals.js",
    "remove-email.js"
  ],


  stage: [
    "frontend-qunit-test.js",
    "public-terminals.js",
    "remove-email.js"
  ],

  prod: [
    "frontend-qunit-test.js",
    "public-terminals.js",
    "remove-email.js"
  ]
};

module.exports = function(env) {
  return testsToIgnore[env] || testsToIgnore.dev;
};
