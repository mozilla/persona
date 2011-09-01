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
      pass: 'fakepass',
      pubkey: 'fakekey',
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
      wsapi.get('/wsapi/prove_email_ownership', { token: token }).call(this);
    },
    "works": function(r, err) {
      assert.equal(r.code, 200);
      assert.strictEqual(true, JSON.parse(r.body));
    }
  }
});

suite.addBatch({
  "calling registration_status after a registration is complete": {
    topic: wsapi.get("/wsapi/registration_status"),
    "yields a HTTP 200": function (r, err) {
      assert.strictEqual(r.code, 200);
    },
    "returns a json encoded string - `complete`": function (r, err) {
      assert.strictEqual(JSON.parse(r.body), "complete");
    }
  }
});

suite.addBatch({
  "the sync emails API invoked without a proper argument": {
    topic: wsapi.post('/wsapi/sync_emails', {}),
    "fails with HTTP 400" : function(r, err) {
      assert.strictEqual(r.code, 400);
    }
  },
  "the sync emails API invoked with a proper argument": {  
    topic: wsapi.post('/wsapi/sync_emails', { emails: '{}' }),
    "returns a response with a proper content-type" : function(r, err) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.headers['content-type'], 'application/json; charset=utf-8');
    }
  },
  "the sync emails API invoked without a empty emails argument": {  
    topic: wsapi.post('/wsapi/sync_emails', { emails: undefined }),
    "returns a 400" : function(r, err) {
      assert.strictEqual(r.code, 400);
    }
  },
  "the sync emails API invoked without malformed JSON in emails argument": {  
    topic: wsapi.post('/wsapi/sync_emails', { emails: '{ "foo@bar.com": "fakekey" '}),
    "returns a 400" : function(r, err) {
      assert.strictEqual(r.code, 400);
    }
  },
  "syncing emails without providing anything": {
    topic: wsapi.post('/wsapi/sync_emails', {emails: '{}'}),
    "should tell us to refresh keys for exisitng accounts" : function(r, err) {
      assert.strictEqual(r.code, 200);
      r = JSON.parse(r.body);
      assert.strictEqual(typeof r, 'object');
      assert.isTrue(Array.isArray(r.unknown_emails));
      assert.isTrue(Array.isArray(r.key_refresh));
      assert.strictEqual(r.unknown_emails.length, 0);
      assert.strictEqual(r.key_refresh.length, 1);
    }
  },
  "syncing emails with an unknown email address": {
    topic: wsapi.post('/wsapi/sync_emails', {emails: '{ "foo@bar.com": "fake" }'}),
    "should tell us to refresh keys for exisitng accounts" : function(r, err) {
      assert.strictEqual(r.code, 200);
      r = JSON.parse(r.body);
      assert.strictEqual(typeof r, 'object');
      assert.isTrue(Array.isArray(r.unknown_emails));
      assert.isTrue(Array.isArray(r.key_refresh));
      assert.strictEqual(r.unknown_emails.length, 1);
      assert.strictEqual(r.unknown_emails[0], 'foo@bar.com');
      assert.strictEqual(r.key_refresh.length, 1);
      assert.strictEqual(r.key_refresh[0], 'syncer@somehost.com');
    }
  }
  // NOTE: db-test has more thorough tests of the algorithm behind the sync_emails API
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
