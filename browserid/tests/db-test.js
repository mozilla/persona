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
db = require('../lib/db.js'),
fs = require('fs'),
path = require('path'),
configuration = require('../../libs/configuration.js');

var suite = vows.describe('db');
// disable vows (often flakey?) async error behavior
suite.options.error = false;

var dbCfg = configuration.get('database');

suite.addBatch({
  "onReady": {
    topic: function() { db.onReady(this.callback); },
    "works": function(r) { }
  },
  "onReady still": {
    topic: function() { db.onReady(this.callback); },
    "works for more than one caller": function(r) { }
  },
  "opening the database": {
    topic: function() {
      db.open(dbCfg, this.callback);
    },
    "and its ready": function(r) {
      assert.isUndefined(r);
    },
    "doesn't prevent onReady": {
      topic: function() { db.onReady(this.callback); },
      "from working": function(r) { }
    }
  }
});

// caching of secrets between test batches.
var secret = undefined;

suite.addBatch({
  "an email address is not reported as staged before it is": {
    topic: function() {
      db.isStaged('lloyd@nowhe.re', this.callback);
    },
    "isStaged returns false": function (r) {
      assert.isFalse(r);
    }
  },
  "an email address is not reported as known before it is": {
    topic: function() {
      db.emailKnown('lloyd@nowhe.re', this.callback);
    },
    "emailKnown returns false": function (r) {
      assert.isFalse(r);
    }
  }
});

suite.addBatch({
  "stage a user for creation pending verification": {
    topic: function() {
      db.stageUser('lloyd@nowhe.re', this.callback);
    },
    "staging returns a valid secret": function(r) {
      secret = r;
      assert.isString(secret);
      assert.strictEqual(secret.length, 48);
    },
    "fetch email for given secret": {
      topic: function(secret) {
        db.emailForVerificationSecret(secret, this.callback);
      },
      "matches expected email": function(storedEmail) {
        assert.strictEqual('lloyd@nowhe.re', storedEmail);
      }
    }
  }
});

suite.addBatch({
  "an email address is reported": {
    topic: function() {
      db.isStaged('lloyd@nowhe.re', this.callback);
    },
    " as staged after it is": function (r) {
      assert.strictEqual(r, true);
    }
  },
  "an email address is not reported": {
    topic: function() {
      db.emailKnown('lloyd@nowhe.re', this.callback);
    },
    " as known when it is only staged": function (r) {
      assert.strictEqual(r, false);
    }
  }
});

suite.addBatch({
  "upon receipt of a secret": {
    topic: function() {
      db.gotVerificationSecret(secret, 'fakepasswordhash', this.callback);
    },
    "gotVerificationSecret completes without error": function (r) {
      assert.strictEqual(r, undefined);
    }
  }
});

suite.addBatch({
  "an email address is not reported": {
    topic: function() {
      db.isStaged('lloyd@nowhe.re', this.callback);
    },
    "as staged immediately after its verified": function (r) {
      assert.strictEqual(r, false);
    }
  },
  "an email address is known": {
    topic: function() {
      db.emailKnown('lloyd@nowhe.re', this.callback);
    },
    "when it is": function (r) {
      assert.strictEqual(r, true);
    }
  }
});

suite.addBatch({
  "checkAuth returns": {
    topic: function() {
      db.checkAuth('lloyd@nowhe.re', this.callback);
    },
    "the correct password": function(r) {
      assert.strictEqual(r, "fakepasswordhash");
    }
  }
});

suite.addBatch({
  "staging an email": {
    topic: function() {
      db.stageEmail('lloyd@nowhe.re', 'lloyd@somewhe.re', this.callback);
    },
    "yields a valid secret": function(secret) {
      assert.isString(secret);
      assert.strictEqual(secret.length, 48);
    },
    "then": {
      topic: function(secret) {
        var cb = this.callback;
        db.isStaged('lloyd@somewhe.re', function(r) { cb(secret, r); });
      },
      "makes it visible via isStaged": function(sekret, r) { assert.isTrue(r); },
      "and lets you verify it": {
        topic: function(secret, r) {
          db.gotVerificationSecret(secret, undefined, this.callback);
        },
        "successfully": function(r) {
          assert.isUndefined(r);
        },
        "and knownEmail": {
          topic: function() { db.emailKnown('lloyd@somewhe.re', this.callback); },
          "returns true": function(r) { assert.isTrue(r); }
        },
        "and isStaged": {
          topic: function() { db.isStaged('lloyd@somewhe.re', this.callback); },
          "returns false": function(r) { assert.isFalse(r); }
        }
      }
    }
  }
});

// exports.emailsBelongToSameAccount
suite.addBatch({
  "emails do belong to the same account": {
    "is true": {
      topic: function() {
        db.emailsBelongToSameAccount('lloyd@nowhe.re', 'lloyd@somewhe.re', this.callback);
      },
      "when they do": function(r) {
        assert.isTrue(r);
      }
    },
    "is false": {
      topic: function() {
        db.emailsBelongToSameAccount('lloyd@anywhe.re', 'lloyd@somewhe.re', this.callback);
      },
      "when they don't": function(r) {
        assert.isFalse(r);
      }
    }
  }
});

suite.addBatch({
  "removing an existing email": {
    topic: function() {
      db.removeEmail("lloyd@somewhe.re", "lloyd@nowhe.re", this.callback);
    },
    "returns no error": function(r) {
      assert.isUndefined(r);
    },
    "causes emailKnown": {
      topic: function() {
        db.emailKnown('lloyd@nowhe.re', this.callback);
      },
      "to return false": function (r) {
        assert.strictEqual(r, false);
      }
    }
  }
});

suite.addBatch({
  "canceling an account": {
    topic: function() {
      db.cancelAccount("lloyd@somewhe.re", this.callback);
    },
    "returns no error": function(r) {
      assert.isUndefined(r);
    },
    "causes emailKnown": {
      topic: function() {
        db.emailKnown('lloyd@somewhe.re', this.callback);
      },
      "to return false": function (r) {
        assert.strictEqual(r, false);
      }
    }
  }
});

suite.addBatch({
  "closing the database": {
    topic: function() {
      db.close(this.callback);
    },
    "should work": function(err) {
      assert.isUndefined(err);
    }
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
