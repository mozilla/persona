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

start_stop.addStartupBatches(suite);

// this test verifies that a user who has only authenticated with
// an assertion from their primary, may not call restricted apis

const TEST_DOMAIN = 'example.domain',
      TEST_EMAIL = 'testuser2@' + TEST_DOMAIN,
      TEST_ORIGIN = 'http://127.0.0.1:10002';

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
    "succeeds": function(r) {
      assert.isString(r);
    },
    "and logging in with the assertion": {
      topic: function(assertion)  {
        wsapi.post('/wsapi/auth_with_assertion', {
          email: TEST_EMAIL,
          assertion: assertion
        }).call(this);
      },
      "succeeds": function(err, r) {
        var resp = JSON.parse(r.body);
        assert.isObject(resp);
        assert.isTrue(resp.success);
      }
    }
  }
});

suite.addBatch({
  "updating our password": {
    topic: wsapi.post('/wsapi/update_password', { oldpass: '', newpass: 'frobaztastic' }),
    "won't work": function(err, r) {
      assert.strictEqual(r.code, 400);
    }
  },
  "certifying a key": {
    topic: wsapi.post('/wsapi/cert_key', { email: TEST_EMAIL, pubkey: 'fake_key' }),
    "won't work": function(err, r) {
      assert.strictEqual(r.code, 400);
    }
  },
  "listing emails": {
    topic: wsapi.get('/wsapi/list_emails'),
    "works fine": function(err, r) {
      assert.strictEqual(r.code, 200);
      assert.equal(Object.keys(JSON.parse(r.body)).length, 1);
    }
  }
});

// shut the server down and cleanup
start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
