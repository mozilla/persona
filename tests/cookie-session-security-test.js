#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
email = require('../lib/email.js'),
jwcert = require('jwcrypto/jwcert'),
jwk = require('jwcrypto/jwk'),
jws = require('jwcrypto/jws');

var suite = vows.describe('cookie-session-security');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

var first_cookie, second_cookie;

function stripExpires(cookieString) {
  return cookieString.replace(/expires=[^;]*;/, '');
}

// changed tests that assumed that cookies were coming back in every request
// because they're not anymore! (2011-12-29)

// certify a key
suite.addBatch({
  "get context": {
    topic: wsapi.get('/wsapi/session_context'),
    "has a cookie because of CSRF setting" : function(err, r) {
      // make sure there's NO cookie
      var cookie = r.headers["set-cookie"];
      assert.isNotNull(cookie[0]);
      first_cookie = cookie[0];
    },
    "and then session context again": {
      topic: wsapi.get('/wsapi/logout'),
      "should not set-cookie": function(err, r) {
        var cookie = r.headers["set-cookie"];
        assert.isUndefined(cookie);
      },
      "then let's screw it up": {
        topic: function() {
          wsapi.clearCookies();

          // mess up the cookie
          var the_match = first_cookie.match(/browserid_state(?:_[a-z0-9]+)?=([^;]*);/);
          assert.isNotNull(the_match);
          var new_cookie_val = the_match[1].substring(0, the_match[1].length - 1);
          wsapi.injectCookies({browserid_state: new_cookie_val});
          return "next";
        },
        "and then get context": {
          topic: wsapi.get('/wsapi/session_context'),
          "and result should have a new cookie for session reset": function(err, r) {
            var cookie = r.headers["set-cookie"];
            assert.isNotNull(cookie);
            assert.isNotNull(cookie[0]);
            assert.notEqual(first_cookie, cookie[0]);
          }
        }
      }
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
