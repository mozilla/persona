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

const
assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
primary = require('./lib/primary.js');

var suite = vows.describe('primary-then-secondary');

// start up a pristine server
start_stop.addStartupBatches(suite);

// this test excercises the codepath whereby a user adds
// a primary email address, then a secondary, then another
// secondary.  It checks that the critical wsapi calls
// along the way perform as expected

// first we'll need to authenticate a user with an assertion from a
// primary IdP

const TEST_DOMAIN = 'example.domain',
      TEST_EMAIL = 'testuser@' + TEST_DOMAIN,
      TEST_ORIGIN = 'http://127.0.0.1:10002',
      TEST_PASS = 'fakepass',
      SECONDARY_EMAIL = 'secondary@notexample.domain';

var primaryUser = new primary({
  email: TEST_EMAIL,
  domain: TEST_DOMAIN
});

// now let's generate an assertion using this user
suite.addBatch({
  "generating an assertion": {
    topic: function() {
      return primaryUser.getAssertion(TEST_ORIGIN);
    },
    "succeeds": function(r, err) {
      assert.isString(r);
    },
    "and logging in with the assertion succeeds": {
      topic: function(assertion)  {
        wsapi.post('/wsapi/auth_with_assertion', {
          email: TEST_EMAIL,
          assertion: assertion
        }).call(this);
      },
      "works": function(r, err) {
        var resp = JSON.parse(r.body);
        assert.isObject(resp);
        assert.isTrue(resp.success);
      }
    }
  }
});

var token;

// now we have a new account.  let's add a secondary to it
suite.addBatch({
  "add a new email address to our account": {
    topic: wsapi.post('/wsapi/stage_email', {
      email: SECONDARY_EMAIL,
      site:'fakesite.com'
    }),
    "works": function(r, err) {
      assert.strictEqual(r.code, 200);
    },
    "and get a token": {
      topic: function() {
        start_stop.waitForToken(this.callback);
      },
      "successfully": function (t) {
        this._token = t;
        assert.strictEqual(typeof t, 'string');
      },
      "and complete":  {
        topic: function(t) {
          wsapi.get('/wsapi/email_for_token', {
            token: t
          }).call(this);
        },
        "we need to set our password": function (r) {
          r = JSON.parse(r.body);
          assert.ok(r.needs_password);
        },
        "with": {
          topic: function() {
            wsapi.post('/wsapi/complete_email_addition', { token: this._token }).call(this);
          },
          "no password fails": function(r, err) {
            assert.equal(r.code, 200);
            assert.strictEqual(JSON.parse(r.body).success, false);
          },
          "a password": {
            topic: function() {
              wsapi.post('/wsapi/complete_email_addition', {
                token: this._token,
                pass: TEST_PASS
              }).call(this);
            },
            "succeeds": function(r, err) {
              assert.equal(r.code, 200);
              assert.strictEqual(JSON.parse(r.body).success, true);
            }
          }
        }
      }
    }
  }
});

suite.addBatch({
  "authentication with first email": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: TEST_PASS
    }),
    "works": function(r, err) {
      assert.strictEqual(r.code, 200);
    },
  },
  "authentication with second email": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: SECONDARY_EMAIL,
      pass: TEST_PASS
    }),
    "works": function(r, err) {
      assert.strictEqual(r.code, 200);
    },
  }
});


// shut the server down and cleanup
start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
