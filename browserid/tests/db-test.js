#!/usr/bin/env node

const assert = require('assert'),
        vows = require('vows'),
          db = require('../lib/db.js'),
        temp = require('temp'),
          fs = require('fs');

var suite = vows.describe('db');

db.dbPath = temp.path({suffix: '.sqlite'});

suite.addBatch({
  "waiting for the database to become ready": {
    topic: function() {
      var cb = this.callback;
      db.onReady(function() { cb(true) });
    },
    "the database is ready": function(err, r) {
      assert.strictEqual(r, true);
    }
  }
});

// caching of secrets between test batches.
var secret = undefined;

suite.addBatch({
  "an email address is not reported as staged before it is": {
    topic: function() {
      return db.isStaged('lloyd@nowhe.re');
    },
    "isStaged returns false": function (e, r) {
      assert.strictEqual(r, false);
    }
  },
  "an email address is not reported as known before it is": {
    topic: function() {
      db.emailKnown('lloyd@nowhe.re', this.callback);
    },
    "emailKnown returns false": function (e, r) {
      assert.strictEqual(r, false);
    }
  }
});

suite.addBatch({
  "stage a user for creation pending verification": {
    topic: function() {
      return secret = db.stageUser({
        email: 'lloyd@nowhe.re',
        pubkey: 'fakepublickey',
        pass: 'fakepasswordhash'
      });
    },
    "staging returns a valid secret": function(e, r) {
      assert.isString(secret);
      assert.strictEqual(secret.length, 48);
    }
  }
});

suite.addBatch({
  "an email address is reported": {
    topic: function() {
      return db.isStaged('lloyd@nowhe.re');
    },
    " as staged after it is": function (e, r) {
      assert.strictEqual(r, true);
    }
  },
  "an email address is not reported": {
    topic: function() {
      db.emailKnown('lloyd@nowhe.re', this.callback);
    },
    " as known when it is only staged": function (e, r) {
      assert.strictEqual(r, false);
    }
  }
});

suite.addBatch({
  "upon receipt of a secret": {
    topic: function() {
      db.gotVerificationSecret(secret, this.callback);
    },
    "gotVerificationSecret completes without error": function (e, r) {
      assert.strictEqual(r, undefined);
    }
  }
});

suite.addBatch({
  "an email address is not reported": {
    topic: function() {
      return db.isStaged('lloyd@nowhe.re');
    },
    "as staged immediately after its verified": function (e, r) {
      assert.strictEqual(r, false);
    }
  },
  "an email address is known": {
    topic: function() {
      db.emailKnown('lloyd@nowhe.re', this.callback);
    },
    "when it is": function (e, r) {
      assert.strictEqual(r, true);
    }
  }
});

// XXX: remaining APIs to test 
// exports.addEmailToAccount
// exports.addKeyToEmail
// exports.cancelAccount
// exports.checkAuth
// exports.checkAuthHash
// exports.emailsBelongToSameAccount
// exports.getSyncResponse
// exports.pubkeysForEmail
// exports.removeEmail
// exports.stageEmail


suite.addBatch({
  "remove the database file": {
    topic: function() {
      fs.unlink(db.dbPath, this.callback);
    },
    "file is toast": function(err, exception) {
      assert.strictEqual(exception, undefined);
    }
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
