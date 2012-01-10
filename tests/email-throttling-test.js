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
wsapi = require('./lib/wsapi.js');

var suite = vows.describe('email-throttling');

var token;

// start up a pristine server
start_stop.addStartupBatches(suite);

// now stage a registration (causing an email to be sent)
suite.addBatch({
  "staging a registration": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: 'first@fakeemail.com',
      site:'fakesite.com'
    }),
    "returns 200": function(err, r) {
      assert.strictEqual(r.code, 200);
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

suite.addBatch({
  "immediately staging another": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: 'first@fakeemail.com',
      site:'fakesite.com'
    }),
    "is throttled": function(err, r) {
      assert.strictEqual(r.code, 403);
    }
  }
});

suite.addBatch({
  "finishing creating the first account": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', { token: token, pass: 'firstfakepass' }).call(this);
    },
    "works": function(err, r) {
      assert.equal(r.code, 200);
      assert.strictEqual(true, JSON.parse(r.body).success);
      token = undefined;
    }
  }
});

suite.addBatch({
  "add a new email address to our account": {
    topic: wsapi.post('/wsapi/stage_email', {
      email: 'second@fakeemail.com',
      site:'fakesite.com'
    }),
    "works": function(err, r) {
      assert.strictEqual(r.code, 200);
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

suite.addBatch({
  "re-adding that same new email address a second time": {
    topic: wsapi.post('/wsapi/stage_email', {
      email: 'second@fakeemail.com',
      site:'fakesite.com'
    }),
    "is throttled with a 403": function(err, r) {
      assert.strictEqual(r.code, 403);
    }
  }
});

suite.addBatch({
  "and when we attempt to finish adding the email address": {
    topic: function() {
      wsapi.post('/wsapi/complete_email_addition', { token: token }).call(this);
    },
    "it works swimmingly": function(err, r) {
      assert.equal(r.code, 200);
      assert.strictEqual(JSON.parse(r.body).success, true);
      token = undefined;
    }
  }
});


// shut the server down and cleanup
start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
