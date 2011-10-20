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
email = require('../lib/email.js');

var suite = vows.describe('registration-status-wsapi');

// FIXME: these tests are probably going to fail after Ben
// revamps wsapi to be more express-like.

// ever time a new token is sent out, let's update the global
// var 'token'
var token = undefined;
email.setInterceptor(function(email, site, secret) {token = secret; });

// start up a pristine server
start_stop.addStartupBatches(suite);

suite.addBatch({
  "calling registration_status without a pending reg is an error": {
    topic: wsapi.get("/wsapi/user_creation_status"),
    "HTTP 400": function (r, err) {
      assert.equal(400, r.code);
    }
  }
});

suite.addBatch({
  "authentication as an unknown user": {
    topic: wsapi.post('/wsapi/authenticate_user', { email: 'first@fakeemail.com', pass: 'secondfakepass' }),
    "fails": function (r, err) {
      assert.isFalse(JSON.parse(r.body).success);
    }
  }
});

// now start a registration
suite.addBatch({
  "start registration": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: 'first@fakeemail.com',
      site:'fakesite.com'
    }),
    "the token is sane": function(r, err) {
      assert.strictEqual('string', typeof token);
    }
  }});

suite.addBatch({
  "comparing token to email": {
    topic: function() {
      return wsapi.get('/wsapi/email_for_token', {token: token}).call(this);
    },
    "and it matches": function(r, err) {
      assert.strictEqual(JSON.parse(r.body).email, 'first@fakeemail.com');
    }
  }
});

suite.addBatch({
  "calling user_creation_status without an email argument": {
    topic: wsapi.get("/wsapi/user_creation_status"),
    "yields a HTTP 400": function (r, err) {
      assert.strictEqual(r.code, 400);
    },
    "returns an error string": function (r, err) {
      assert.strictEqual(r.body, "Bad Request: no 'email' parameter");
    }
  }
});

suite.addBatch({
  "calling user_creation_status when a reg is really pending": {
    topic: wsapi.get("/wsapi/user_creation_status", { email: 'first@fakeemail.com' }),
    "yields a HTTP 200": function (r, err) {
      assert.strictEqual(r.code, 200);
    },
    "returns a json encoded string - `pending`": function (r, err) {
      assert.strictEqual(JSON.parse(r.body).status, "pending");
    }
  }
});

suite.addBatch({
  "completing user creation": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', { token: token, pass: 'firstfakepass' }).call(this);
    },
    "works": function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

suite.addBatch({
  "calling user_creation_status after a registration is complete": {
    topic: wsapi.get("/wsapi/user_creation_status", { email: 'first@fakeemail.com' }),
    "yields a HTTP 200": function (r, err) {
      assert.strictEqual(r.code, 200);
    },
    "returns a json encoded string - `complete`": function (r, err) {
      assert.strictEqual(JSON.parse(r.body).status, "complete");
    }
  }
});

suite.addBatch({
  "calling registration_status a second time after a registration is complete": {
    topic: wsapi.get("/wsapi/user_creation_status", { email: 'first@fakeemail.com' }),
    "still yields a HTTP 200": function (r, err) {
      assert.strictEqual(r.code, 200);
    },
    "and still returns a json encoded string - `complete`": function (r, err) {
      assert.strictEqual(JSON.parse(r.body).status, "complete");
    }
  }
});

suite.addBatch({
  "after successful registration": {
    topic: wsapi.get("/wsapi/session_context"),
    "we're authenticated": function (r, err) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).authenticated, true);
    },
    "but we can easily clear cookies on the client to change that!": function(r, err) {
      wsapi.clearCookies();
    }
  }
});

suite.addBatch({
  "after clearing cookies": {
    topic: wsapi.get("/wsapi/session_context"),
    "we're NOT authenticated": function (r, err) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).authenticated, false);
    }
  }
});

suite.addBatch({
  "re-registering an existing email": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: 'first@fakeemail.com',
      site:'secondfakesite.com'
    }),
    "yields a valid token": function(r, err) {
      assert.strictEqual('string', typeof token);
    }
  }
});

suite.addBatch({
  "calling registration_status when a reg is pending for an email that is already verified": {
    topic: wsapi.get("/wsapi/user_creation_status", { email: 'first@fakeemail.com' }),
    "should yield a HTTP 200": function (r, err) {
      assert.strictEqual(r.code, 200);
    },
    "returns a json encoded string - `pending`": function (r, err) {
      assert.strictEqual(JSON.parse(r.body).status, "pending");
    }
  }
});

suite.addBatch({
  "proving email ownership causes account re-creation": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', { token: token, pass: 'secondfakepass' }).call(this);
    },
    "and returns a 200 code": function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

suite.addBatch({
  "calling registration_status after proving a re-registration": {
    topic: wsapi.get("/wsapi/user_creation_status", { email: 'first@fakeemail.com' }),
    "yields a HTTP 200": function (r, err) {
      assert.strictEqual(r.code, 200);
    },
    "returns a json encoded string - `complete`": function (r, err) {
      assert.strictEqual(JSON.parse(r.body).status, "complete");
    }
  }
});

suite.addBatch({
  "again, calling registration_status a second time after a registration is complete": {
    topic: wsapi.get("/wsapi/user_creation_status", { email: 'first@fakeemail.com' }),
    "yields a HTTP 200": function (r, err) {
      assert.strictEqual(r.code, 200);
    }
  }
});

suite.addBatch({
  "after re-registration, authenticating with new credetials": {
    topic: wsapi.post('/wsapi/authenticate_user', { email: 'first@fakeemail.com', pass: 'secondfakepass' }),
    "works as you might expect": function (r, err) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    }
  }
});

// shut the server down and cleanup
start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
