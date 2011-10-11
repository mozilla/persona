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
email = require('../lib/email.js');

var suite = vows.describe('forgotten-email');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

// ever time a new token is sent out, let's update the global
// var 'token'
var token = undefined;
email.setInterceptor(function(email, site, secret) { token = secret; });

// create a new account via the api with (first address)
suite.addBatch({
  "stage an account": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: 'syncer@somehost.com',
      site:'fakesite.com'
    }),
    "yields a sane token": function(r, err) {
      assert.strictEqual(typeof token, 'string');
    }
  }
});

suite.addBatch({
  "verifying account ownership": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', { token: token, pass: 'fakepass' }).call(this);
    },
    "works": function(r, err) {
      assert.equal(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

suite.addBatch({
  "calling user_creation_status after a creation is complete": {
    topic: wsapi.get("/wsapi/user_creation_status", { email: 'syncer@somehost.com' }),
    "yields a HTTP 200": function (r, err) {
      assert.strictEqual(r.code, 200);
    },
    "returns a json encoded string - `complete`": function (r, err) {
      assert.strictEqual(JSON.parse(r.body).status, "complete");
    }
  }
});

suite.addBatch({
  "list emails API": {
    topic: wsapi.get('/wsapi/list_emails', {}),
    "succeeds with HTTP 200" : function(r, err) {
      assert.strictEqual(r.code, 200);
    },
    "returns an object with proper email": function(r, err) {
      var emails = Object.keys(JSON.parse(r.body));
      assert.equal(emails[0], "syncer@somehost.com");
      assert.equal(emails.length, 1);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
