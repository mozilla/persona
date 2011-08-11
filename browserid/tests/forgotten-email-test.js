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

const assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
interceptor = require('./lib/email-interceptor.js');

var suite = vows.describe('forgotten-email');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

// ever time a new token is sent out, let's update the global
// var 'token'
var token = undefined;
interceptor.onEmail = function(newtok) { token = newtok; };

// create a new account via the api with (first address)
suite.addBatch({
  "stage first account": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: 'first@fakeemail.com',
      pass: 'firstfakepass',
      pubkey: 'fakepubkey',
      site:'fakesite.com'
    }),
    "the token is sane": function(r, err) {
      assert.strictEqual('string', typeof token);
    }
  }
});

suite.addBatch({
  "create first account": {
    topic: function() {
      wsapi.get('/wsapi/prove_email_ownership', { token: token }).call(this);
    },
    "account created": function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

suite.addBatch({
  "email created": {
    topic: wsapi.get('/wsapi/registration_status'),
    "should exist": function(r, err) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body), "complete");
    }
  }
});

// add a new email address to the account (second address)
suite.addBatch({
  "add a new email address to our account": {
    topic: wsapi.post('/wsapi/add_email', {
      email: 'second@fakeemail.com',
      pubkey: 'fakepubkey',
      site:'fakesite.com'
    }),
    "the token is sane": function(r, err) {
      assert.strictEqual('string', typeof token);
    }
  },
  "set the key again": {
    topic: wsapi.post('/wsapi/set_key', {
      email: 'second@fakeemail.com',
      pubkey: 'fakepubkey2'
    }),
    "the token is sane": function(r, err) {
      assert.strictEqual('string', typeof token);
    }
  }
});

// confirm second email email address to the account
suite.addBatch({
  "create second account": {
    topic: function() {
      wsapi.get('/wsapi/prove_email_ownership', { token: token }).call(this);
    },
    "account created": function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

// verify now both email addresses are known
suite.addBatch({
  "first email exists": {
    topic: wsapi.get('/wsapi/have_email', { email: 'first@fakeemail.com' }),
    "should exist": function(r, err) {
      assert.strictEqual(true, JSON.parse(r.body));
    }
  },
  "second email exists": {
    topic: wsapi.get('/wsapi/have_email', { email: 'second@fakeemail.com' }),
    "should exist": function(r, err) {
      assert.strictEqual(JSON.parse(r.body), true);
    }
  },
  "a random email doesn't exist": {
    topic: wsapi.get('/wsapi/have_email', { email: 'third@fakeemail.com' }),
    "shouldn't exist": function(r, err) {
      assert.strictEqual(JSON.parse(r.body), false);
    }
  }
});

// Run the "forgot_email" flow with first address.  This is really
// just re-registering the user.
suite.addBatch({
  "re-stage first account": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: 'first@fakeemail.com',
      pass: 'secondfakepass',
      pubkey: 'fakepubkey2',
      site:'otherfakesite.com'
    }),
    "the token is sane": function(r, err) {
      assert.strictEqual('string', typeof token);
    }
  }
});

// verify that the old email address + password combinations are still
// valid (this is so *until* someone clicks through)
suite.addBatch({
  "first email works": {
    topic: wsapi.post('/wsapi/authenticate_user', { email: 'first@fakeemail.com', pass: 'firstfakepass' }),
    "should work": function(r, err) {
      assert.strictEqual(true, JSON.parse(r.body));
    }
  },
  "second email works": {
    topic: wsapi.post('/wsapi/authenticate_user', { email: 'second@fakeemail.com', pass: 'firstfakepass' }),
    "should work": function(r, err) {
      assert.strictEqual(true, JSON.parse(r.body));
    }
  }
});

// now let's complete the re-registration of first email address
suite.addBatch({
  "re-create first email address": {
    topic: function() {
      wsapi.get('/wsapi/prove_email_ownership', { token: token }).call(this);
    },
    "account created": function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

// now we should be able to sign into the first email address with the second
// password, and all other combinations should fail
suite.addBatch({
  "first email, first pass bad": {
    topic: wsapi.post('/wsapi/authenticate_user', { email: 'first@fakeemail.com', pass: 'firstfakepass' }),
    "shouldn't work": function(r, err) {
      assert.strictEqual(JSON.parse(r.body), false);
    }
  },
  "first email, second pass good": {
    topic: wsapi.post('/wsapi/authenticate_user', { email: 'first@fakeemail.com', pass: 'secondfakepass' }),
    "should work": function(r, err) {
      assert.strictEqual(JSON.parse(r.body), true);
    }
  },
  "sync emails": {
    topic: wsapi.post('/wsapi/sync_emails', {'emails': '{}'}),
      "should work" : function(r, err) {
      var parsed_body = JSON.parse(r.body);
      assert.equal(typeof parsed_body.unknown_emails, "object");
      assert.equal(typeof parsed_body.key_refresh, "object");
    }
  },
  "logout": {
    topic: wsapi.post('/wsapi/logout', {}),
      "should work": function(r, err) {
      assert.strictEqual(JSON.parse(r.body), "ok");
    }
  },
  "second email, first pass good": {
    topic: wsapi.post('/wsapi/authenticate_user', { email: 'second@fakeemail.com', pass: 'firstfakepass' }),
    "should work": function(r, err) {
      assert.strictEqual(JSON.parse(r.body), true);
    }
  },
  "second email, second pass bad": {
    topic: wsapi.post('/wsapi/authenticate_user', { email: 'second@fakeemail.com', pass: 'secondfakepass' }),
    "shouldn' work": function(r, err) {
      assert.strictEqual(JSON.parse(r.body), false);
    }
  },
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
