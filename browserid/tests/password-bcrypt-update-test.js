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
email = require('../lib/email.js'),
db = require('../lib/db.js'),
config = require('../../libs/configuration.js'),
bcrypt = require('bcrypt');

var suite = vows.describe('password-length');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const TEST_EMAIL = 'update@passwd.bcrypt',
      TEST_PASSWORD = 'thisismypassword';

// surpress console output of emails with a noop email interceptor
var token = undefined;
email.setInterceptor(function(email, site, secret) {
  token = secret;
});

suite.addBatch({
  "get csrf token": {
    topic: wsapi.get('/wsapi/session_context'),
    "works": function (r, err) {
      assert.equal(typeof r.body, 'string');
      var v = JSON.parse(r.body);
      assert.equal(typeof v, 'object');
      assert.equal(typeof v.csrf_token, 'string');
      assert.equal(typeof v.server_time, 'number');
    }
  }
});

// first stage the account
suite.addBatch({
  "account staging": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: TEST_EMAIL,
      site:'fakesite.com'
    }),
    "works":     function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

// create a new account via the api with (first address)
suite.addBatch({
  "setting password": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', {
        token: token,
        pass: TEST_PASSWORD
      }).call(this);
    },
    "works just fine": function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

// check the rounds on the password
suite.addBatch({
  "the password": {
    topic: function() {
      db.checkAuth(TEST_EMAIL, this.callback);
    },
    "is bcrypted with the expected number of rounds": function(r, err) {
      assert.equal(typeof r, 'string');
      assert.equal(config.get('bcrypt_work_factor'), bcrypt.get_rounds(r));
    }
  }
});

// now change the configuration to bcrypt at 8 rounds
suite.addBatch({
  "updating work factor": {
    topic: function() {
      config.set('bcrypt_work_factor', 8);
      return true;
    },
    "succeeds": function() {}
  }
});

// at authentication time we should see the password get updated
suite.addBatch({
  "re-authentication": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: TEST_PASSWORD
    }),
    "should work": function(r, err) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

// let's wait a little while for the password update to complete.
// sleeps suck, but 8 rounds should reliably complete in under 750ms
suite.addBatch({
  "after a bit of waiting": {
    topic: function() {
      setTimeout(this.callback, 750);
    },
    "if we recheck the auth hash": {
      topic: function() {
        db.checkAuth(TEST_EMAIL, this.callback);
      },
      "its bcrypted with 8 rounds": function(r, err) {
        assert.equal(typeof r, 'string');
        assert.equal(8, bcrypt.get_rounds(r));
      }
    }
  }
});

// at authentication time we should see the password get updated
suite.addBatch({
  "and re-authentication": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: TEST_PASSWORD
    }),
    "should still work": function(r, err) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
