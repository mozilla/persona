#!/usr/bin/env node

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

require('./lib/test_env.js');

const assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
wcli = require('../../libs/wsapi_client');
email = require('../lib/email.js'),
ca = require('../lib/ca.js'),
jwcert = require('jwcrypto/jwcert'),
jwk = require('jwcrypto/jwk'),
jws = require('jwcrypto/jws');

var suite = vows.describe('cookie-session-security');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

var first_cookie, second_cookie;

// certify a key
suite.addBatch({
  "get context": {
    topic: wsapi.get('/wsapi/session_context'),
    "parses" : function(r, err) {
      // make sure there's a cookie
      var cookie = r.headers["set-cookie"];
      assert.isNotNull(cookie);
      assert.isNotNull(cookie[0]);
      first_cookie = cookie[0];
    },
    "with nothing": {
      topic: wsapi.get('/wsapi/session_context'),
      "still the same": function(r, err) {
        var cookie = r.headers["set-cookie"];
        assert.equal(first_cookie, cookie[0]);
      }
    },
    "let's screw it up": {
      topic: function() {
        wsapi.clearCookies();

        // mess up the cookie
        var the_match = first_cookie.match(/browserid_state=([^;]*);/);
        assert.isNotNull(the_match);
        var new_cookie_val = the_match[1].substring(0, the_match[1].length - 1);
        wsapi.injectCookies({browserid_state: new_cookie_val});
        return "next";
      },
      "and then": {
        topic: wsapi.get('/wsapi/session_context'),
        "and result": function(r, err) {
          var cookie = r.headers["set-cookie"];
          assert.notEqual(first_cookie, cookie[0]);
        }
      }
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
