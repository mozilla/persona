#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

// add lib/ to the require path

const
assert = require('assert'),
vows = require('vows'),
fs = require('fs'),
path = require('path'),
db = require('../lib/db.js'),
configuration = require('../lib/configuration.js');

var suite = vows.describe('db');
// disable vows (often flakey?) async error behavior
suite.options.error = false;

var dbCfg = configuration.get('database');
dbCfg.drop_on_close = true;

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
      "matches expected email": function(err, r) {
        assert.strictEqual(r.email, 'lloyd@nowhe.re');
      }
    },
    "fetch secret for email": {
      topic: function(secret) {
        db.verificationSecretForEmail('lloyd@nowhe.re', this.callback);
      },
      "matches expected secret": function(storedSecret) {
        assert.strictEqual(storedSecret, secret);
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
      var cb = this.callback;
      db.emailToUID('lloyd@nowhe.re', function(uid) {
        db.checkAuth(uid, cb);
      });
    },
    "the correct password": function(r) {
      assert.strictEqual(r, "fakepasswordhash");
    }
  }
});

suite.addBatch({
  "emailToUID": {
    topic: function() {
      db.emailToUID('lloyd@nowhe.re', this.callback);
    },
    "returns a valid userid": function(r) {
      assert.isNumber(r);
    },
    "returns a UID": {
      topic: function(uid) {
        db.userOwnsEmail(uid, 'lloyd@nowhe.re', this.callback);
      },
      "that owns the original email": function(r) {
        assert.ok(r);
      }
    }
  }
});

suite.addBatch({
  "getting a UID, then": {
    topic: function() {
      db.emailToUID('lloyd@nowhe.re', this.callback);
    },
    "staging an email": {
      topic: function(uid) {
        db.stageEmail(uid, 'lloyd@somewhe.re', this.callback);
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
        "lets you verify it": {
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
  "emailType of lloyd@anywhe.re": {
    topic: function() {
      db.emailType('lloyd@anywhe.re', this.callback);
    },
    "is null": function (r) {
      assert.isUndefined(r);
    }
  },
  "emailType of lloyd@somewhe.re": {
    topic: function() {
      db.emailType('lloyd@somewhe.re', this.callback);
    },
    "is 'secondary'": function (r) {
      assert.strictEqual(r, 'secondary');
    }
  },
  "emailType of lloyd@nowhe.re": {
    topic: function() {
      db.emailType('lloyd@nowhe.re', this.callback);
    },
    "is 'secondary'": function (r) {
      assert.strictEqual(r, 'secondary');
    }
  }
});

suite.addBatch({
  "removing an existing email": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID("lloyd@somewhe.re", function(uid) {
        db.removeEmail(uid, "lloyd@nowhe.re", cb);
      });
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
  "creating a primary account": {
    topic: function() {
      db.createUserWithPrimaryEmail("lloyd@primary.domain", this.callback);
    },
    "returns no error": function(r) {
      assert.isUndefined(r);
    },
    "causes emailKnown": {
      topic: function() {
        db.emailKnown('lloyd@primary.domain', this.callback);
      },
      "to return true": function (r) {
        assert.strictEqual(r, true);
      }
    },
    "causes emailType": {
      topic: function() {
        db.emailType('lloyd@primary.domain', this.callback);
      },
      "to return 'primary'": function (r) {
        assert.strictEqual(r, 'primary');
      }
    }
  }
});

suite.addBatch({
  "adding a primary email to that account": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID('lloyd@primary.domain', function(uid) {
        db.addPrimaryEmailToAccount(uid, "lloyd2@primary.domain", cb);
      });
    },
    "returns no error": function(r) {
      assert.isUndefined(r);
    },
    "causes emailKnown": {
      topic: function() {
        db.emailKnown('lloyd2@primary.domain', this.callback);
      },
      "to return true": function (r) {
        assert.strictEqual(r, true);
      }
    },
    "causes emailType": {
      topic: function() {
        db.emailType('lloyd@primary.domain', this.callback);
      },
      "to return 'primary'": function (r) {
        assert.strictEqual(r, 'primary');
      }
    }
  },
  "adding a primary email to an account with only secondaries": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID('lloyd@somewhe.re', function(uid) {
        db.addPrimaryEmailToAccount(uid, "lloyd3@primary.domain", cb);
      });
    },
    "returns no error": function(r) {
      assert.isUndefined(r);
    },
    "causes emailKnown": {
      topic: function() {
        db.emailKnown('lloyd3@primary.domain', this.callback);
      },
      "to return true": function (r) {
        assert.strictEqual(r, true);
      }
    },
    "causes emailType": {
      topic: function() {
        db.emailType('lloyd3@primary.domain', this.callback);
      },
      "to return 'primary'": function (r) {
        assert.strictEqual(r, 'primary');
      }
    }
  }
});

suite.addBatch({
  "adding a registered primary email to an account": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID('lloyd@primary.domain', function(uid) {
        db.addPrimaryEmailToAccount(uid, "lloyd3@primary.domain", cb);
      });
    },
    "returns no error": function(r) {
      assert.isUndefined(r);
    },
    "and emailKnown": {
      topic: function() {
        db.emailKnown('lloyd3@primary.domain', this.callback);
      },
      "still returns true": function (r) {
        assert.strictEqual(r, true);
      }
    },
    "and emailType": {
      topic: function() {
        db.emailType('lloyd@primary.domain', this.callback);
      },
      "still returns 'primary'": function (r) {
        assert.strictEqual(r, 'primary');
      }
    },
    "and email is removed": {
      topic: function() {
        db.emailsBelongToSameAccount('lloyd3@primary.domain', 'lloyd@somewhe.re', this.callback);
      },
      "from original account": function(r) {
        assert.isFalse(r);
      }
    },
    "and email is added": {
      topic: function() {
        db.emailsBelongToSameAccount('lloyd3@primary.domain', 'lloyd@primary.domain', this.callback);
      },
      "to new account": function(r) {
        assert.isTrue(r);
      }
    }
  }
});

suite.addBatch({
  "canceling an account": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID("lloyd@somewhe.re", function(uid) {
        db.cancelAccount(uid, cb);
      });
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
    },
    "re-opening the database": {
      topic: function() {
        db.open(dbCfg, this.callback);
      },
      "works": function(r) {
        assert.isUndefined(r);
      },
      "and then purging": {
        topic: function() {
          db.closeAndRemove(this.callback);
        },
        "works": function(r) {
          assert.isUndefined(r);
        }
      }
    }
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
