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

const assert =
require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
db = require('../lib/db.js'),
config = require('../lib/configuration.js'),
bcrypt = require('bcrypt');

var suite = vows.describe('password-length');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const TEST_EMAIL = 'someuser@somedomain.com',
      OLD_PASSWORD = 'thisismyoldpassword',
      NEW_PASSWORD = 'thisismynewpassword';

// surpress console output of emails with a noop email interceptor
var token = undefined;

// first stage the account
suite.addBatch({
  "account staging": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: TEST_EMAIL,
      site: 'fakesite.com'
    }),
    "works":     function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

// wait for the token
suite.addBatch({
  "a token": {
    topic: function() {
      start_stop.waitForToken(this.callback);
    },
    "is obtained": function (t) {
      assert.strictEqual(typeof t, 'string');
      token = t;
    }
  }
});

// create a new account via the api with (first address)
suite.addBatch({
  "setting password": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', {
        token: token,
        pass: OLD_PASSWORD
      }).call(this);
    },
    "works just fine": function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

suite.addBatch({
  "authenticating with the password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: OLD_PASSWORD
    }),
    "works as expected": function(r, err) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  },
  "authenticating with the wrong password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: NEW_PASSWORD
    }),
    "fails as expected": function(r, err) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  }
});

suite.addBatch({
  "updating the password without specifying a proper old password": {
    topic: wsapi.post('/wsapi/update_password', {
      oldpass: "bogus ass password",
      newpass: NEW_PASSWORD
    }),
    "fails as expected": function(r, err) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  }
});

suite.addBatch({
  "updating the password": {
    topic: wsapi.post('/wsapi/update_password', {
      oldpass: OLD_PASSWORD,
      newpass: NEW_PASSWORD
    }),
    "works as expected": function(r, err) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

suite.addBatch({
  "authenticating with the password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: NEW_PASSWORD
    }),
    "works as expected": function(r, err) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  },
  "authenticating with the wrong password": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: OLD_PASSWORD
    }),
    "fails as expected": function(r, err) {
      assert.strictEqual(JSON.parse(r.body).success, false);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
