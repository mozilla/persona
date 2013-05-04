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
    "and its ready": function(err) {
      assert.isNull(err);
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
    "isStaged returns false": function (err, r) {
      assert.isNull(err);
      assert.isFalse(r);
    }
  },
  "an email address is not reported as known before it is": {
    topic: function() {
      db.emailKnown('lloyd@nowhe.re', this.callback);
    },
    "emailKnown returns false": function (err, r) {
      assert.isNull(err);
      assert.isFalse(r);
    }
  }
});

suite.addBatch({
  "stage a user for creation pending verification": {
    topic: function() {
      db.stageUser('lloyd@nowhe.re', 'biglonghashofapassword', this.callback);
    },
    "staging returns a valid secret": function(err, r) {
      assert.isNull(err);
      secret = r;
      assert.isString(secret);
      assert.strictEqual(secret.length, 48);
    },
    "fetch email for given secret": {
      topic: function(err, secret) {
        db.emailForVerificationSecret(secret, this.callback);
      },
      "matches expected email": function(err, email, uid) {
        assert.strictEqual(email, 'lloyd@nowhe.re');
      }
    },
    "fetch secret for email": {
      topic: function(err, secret) {
        db.verificationSecretForEmail('lloyd@nowhe.re', this.callback);
      },
      "matches expected secret": function(err, storedSecret) {
        assert.isNull(err);
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
    " as staged after it is": function (err, r) {
      assert.isNull(err);
      assert.strictEqual(r, true);
    }
  },
  "an email address is not reported": {
    topic: function() {
      db.emailKnown('lloyd@nowhe.re', this.callback);
    },
    " as known when it is only staged": function (err, r) {
      assert.isNull(err);
      assert.strictEqual(r, false);
    }
  }
});

suite.addBatch({
  "upon receipt of a secret": {
    topic: function() {
      db.completeCreateUser(secret, this.callback);
    },
    "gotVerificationSecret completes without error": function (err, r) {
      assert.isNull(err);
    }
  }
});

suite.addBatch({
  "an email address is not reported": {
    topic: function() {
      db.isStaged('lloyd@nowhe.re', this.callback);
    },
    "as staged immediately after its verified": function (err, r) {
      assert.isNull(err);
      assert.strictEqual(r, false);
    }
  },
  "an email address is known": {
    topic: function() {
      db.emailKnown('lloyd@nowhe.re', this.callback);
    },
    "when it is": function (err, r) {
      assert.isNull(err);
      assert.strictEqual(r, true);
    }
  }
});

suite.addBatch({
  "checkAuth returns": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID('lloyd@nowhe.re', function(err, uid) {
        db.checkAuth(uid, cb);
      });
    },
    "the correct password": function(err, r) {
      assert.isNull(err);
      assert.strictEqual(r, "biglonghashofapassword");
    },
    "zero failed auth tries where there aren't any": function(err, r, failedAuthTries) {
      assert.isNull(err);
      assert.strictEqual(failedAuthTries, 0);
    }
  }
});

suite.addBatch({
  "incrementing failedAuthTries": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID('lloyd@nowhe.re', function(err, uid) {
        db.incAuthFailures(uid, function() {
          db.incAuthFailures(uid, function() {
            db.incAuthFailures(uid, function() {
              db.checkAuth(uid, cb);
            });
          })
        });
      });
    },
    "works": function(err, r, failedAuthTries) {
      assert.isNull(err);
      assert.strictEqual(failedAuthTries, 3);
    }
  }
});

suite.addBatch({
  "incrementing failedAuthTries": {
    topic: function() {
      var cb = this.callback;
      db.incAuthFailures(99999999, cb);
    },
    "fails when the user doesn't exist": function(err) {
      assert.strictEqual(err, "no such user");
    }
  }
});

suite.addBatch({
  "clearing failedAuthTries": {
    topic: function() {
      var cb = this.callback;
      db.clearAuthFailures(99999999, cb);
    },
    "fails when the user doesn't exist": function(err) {
      assert.strictEqual(err, "no such user");
    }
  }
});

suite.addBatch({
  "updating the user's password": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID('lloyd@nowhe.re', function(err, uid) {
        // increment auth failures before updating password to ensure
        // that update resets failures
        db.incAuthFailures(uid, function() {
          db.updatePassword(uid, "anotherbiglongpasswordhash", false, function() {
            db.checkAuth(uid, cb);
          });
        });
      });
    },
    "works": function(err, r, failedAuthTries) {
      assert.isNull(err);
      assert.strictEqual(r, "anotherbiglongpasswordhash");
    },
    "resets failed auth attempts": function(err, r, failedAuthTries) {
      assert.isNull(err);
      assert.strictEqual(failedAuthTries, 0);
    }
  }
});

suite.addBatch({
  "resetting failedAuthTries": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID('lloyd@nowhe.re', function(err, uid) {
        db.clearAuthFailures(uid, function() {
          db.checkAuth(uid, cb);
        });
      });
    },
    "works": function(err, r, failedAuthTries) {
      assert.isNull(err);
      assert.strictEqual(failedAuthTries, 0);
    }
  }
});

suite.addBatch({
  "emailToUID": {
    topic: function() {
      db.emailToUID('lloyd@nowhe.re', this.callback);
    },
    "returns a valid userid": function(err, r) {
      assert.isNull(err);
      assert.isNumber(r);
    },
    "returns a UID": {
      topic: function(err, uid) {
        db.userOwnsEmail(uid, 'lloyd@nowhe.re', this.callback);
      },
      "that owns the original email": function(err, r) {
        assert.isNull(err);
        assert.ok(r);
      }
    },
    "and user": {
      topic: function(err, uid) {
        db.userKnown(uid, this.callback);
      },
      "has a password set and is known": function(err, known, hasPass) {
        assert.equal(known, true);
        assert.equal(hasPass, true);
      }
    }
  }
});

suite.addBatch({
  "getting a UID": {
    topic: function() {
      db.emailToUID('lloyd@nowhe.re', this.callback);
    },
    "does not error": function(err, uid) {
      assert.isNull(err);
    },
    "then staging an email": {
      topic: function(err, uid) {
        // do not supply a password here.  Email addition only supplies a password
        // in the case it's the addition of a secondary address to an account with
        // only primaries.
        db.stageEmail(uid, 'lloyd@somewhe.re', undefined, this.callback);
      },
      "yields a valid secret": function(err, secret) {
        assert.isNull(err);
        assert.isString(secret);
        assert.strictEqual(secret.length, 48);
      },
      "then": {
        topic: function(err, secret) {
          var cb = this.callback;
          db.isStaged('lloyd@somewhe.re', function(err, r) { cb(secret, r); });
        },
        "makes it visible via isStaged": function(sekret, r) { assert.isTrue(r); },
        "lets you verify it": {
          topic: function(secret, r) {
            db.completeConfirmEmail(secret, this.callback);
          },
          "successfully": function(err, r) {
            assert.isNull(err);
          },
          "and knownEmail": {
            topic: function() { db.emailKnown('lloyd@somewhe.re', this.callback); },
            "returns true": function(err, r) {
              assert.isNull(err);
              assert.isTrue(r);
            }
          },
          "and isStaged": {
            topic: function() { db.isStaged('lloyd@somewhe.re', this.callback); },
            "returns false": function(err, r) {
              assert.isNull(err);
              assert.isFalse(r);
            }
          },
          "and user's password": {
            topic: function() {
              var self = this;
              db.emailToUID('lloyd@nowhe.re', function(err, uid) {
                db.checkAuth(uid, self.callback);
              });
            },
            "is still populated": function(err, hash) {
              assert.strictEqual(hash, "anotherbiglongpasswordhash");
            }
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
      "when they do": function(err, r) {
        assert.isNull(err);
        assert.isTrue(r);
      }
    },
    "is false": {
      topic: function() {
        db.emailsBelongToSameAccount('lloyd@anywhe.re', 'lloyd@somewhe.re', this.callback);
      },
      "when they don't": function(err, r) {
        assert.isNull(err);
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
    "is null": function (err, r) {
      assert.isNull(err);
      assert.isUndefined(r);
    }
  },
  "emailType of lloyd@somewhe.re": {
    topic: function() {
      db.emailType('lloyd@somewhe.re', this.callback);
    },
    "is 'secondary'": function (err, r) {
      assert.isNull(err);
      assert.strictEqual(r, 'secondary');
    }
  },
  "emailType of lloyd@nowhe.re": {
    topic: function() {
      db.emailType('lloyd@nowhe.re', this.callback);
    },
    "is 'secondary'": function (err, r) {
      assert.isNull(err);
      assert.strictEqual(r, 'secondary');
    }
  }
});

suite.addBatch({
  "removing an existing email": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID("lloyd@somewhe.re", function(err, uid) {
        db.removeEmail(uid, "lloyd@nowhe.re", cb);
      });
    },
    "returns no error": function(err, r) {
      assert.isNull(err);
      assert.isUndefined(r);
    },
    "causes emailKnown": {
      topic: function() {
        db.emailKnown('lloyd@nowhe.re', this.callback);
      },
      "to return false": function (err, r) {
        assert.isNull(err);
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
    "returns no error": function(err, r) {
      assert.isNull(err);
    },
    "causes emailKnown": {
      topic: function() {
        db.emailKnown('lloyd@primary.domain', this.callback);
      },
      "to return true": function (err, r) {
        assert.isNull(err);
        assert.strictEqual(r, true);
      }
    },
    "causes emailType": {
      topic: function() {
        db.emailType('lloyd@primary.domain', this.callback);
      },
      "to return 'primary'": function (err, r) {
        assert.isNull(err);
        assert.strictEqual(r, 'primary');
      }
    }
  }
});

suite.addBatch({
  "adding a primary email to that account": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID('lloyd@primary.domain', function(err, uid) {
        db.addPrimaryEmailToAccount(uid, "lloyd2@primary.domain", cb);
      });
    },
    "returns no error": function(err) {
      assert.isNull(err);
    },
    "causes emailKnown": {
      topic: function() {
        db.emailKnown('lloyd2@primary.domain', this.callback);
      },
      "to return true": function (err, r) {
        assert.isNull(err);
        assert.strictEqual(r, true);
      }
    },
    "causes emailType": {
      topic: function() {
        db.emailType('lloyd@primary.domain', this.callback);
      },
      "to return 'primary'": function (err, r) {
        assert.isNull(err);
        assert.strictEqual(r, 'primary');
      }
    }
  },
  "adding a primary email to an account with only secondaries": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID('lloyd@somewhe.re', function(err, uid) {
        db.addPrimaryEmailToAccount(uid, "lloyd3@primary.domain", cb);
      });
    },
    "returns no error": function(err) {
      assert.isNull(err);
    },
    "causes emailKnown": {
      topic: function() {
        db.emailKnown('lloyd3@primary.domain', this.callback);
      },
      "to return true": function (err, r) {
        assert.isNull(err);
        assert.strictEqual(r, true);
      }
    },
    "causes emailType": {
      topic: function() {
        db.emailType('lloyd3@primary.domain', this.callback);
      },
      "to return 'primary'": function (err, r) {
        assert.isNull(err);
        assert.strictEqual(r, 'primary');
      }
    }
  }
});

suite.addBatch({
  "adding a registered primary email to an account": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID('lloyd@primary.domain', function(err, uid) {
        db.addPrimaryEmailToAccount(uid, "lloyd3@primary.domain", cb);
      });
    },
    "returns no error": function(err) {
      assert.isNull(err);
    },
    "and emailKnown": {
      topic: function() {
        db.emailKnown('lloyd3@primary.domain', this.callback);
      },
      "still returns true": function (err, r) {
        assert.isNull(err);
        assert.strictEqual(r, true);
      }
    },
    "and emailType": {
      topic: function() {
        db.emailType('lloyd@primary.domain', this.callback);
      },
      "still returns 'primary'": function (err, r) {
        assert.isNull(err);
        assert.strictEqual(r, 'primary');
      }
    },
    "and email is removed": {
      topic: function() {
        db.emailsBelongToSameAccount('lloyd3@primary.domain', 'lloyd@somewhe.re', this.callback);
      },
      "from original account": function(err, r) {
        assert.isNull(err);
        assert.isFalse(r);
      }
    },
    "and email is added": {
      topic: function() {
        db.emailsBelongToSameAccount('lloyd3@primary.domain', 'lloyd@primary.domain', this.callback);
      },
      "to new account": function(err, r) {
        assert.isNull(err);
        assert.isTrue(r);
      }
    }
  }
});

suite.addBatch({
  ".emailInfo for primary email address": {
    topic: function() {
      db.emailInfo('lloyd@primary.domain', this.callback);
    },
    "returns a lastUsedAs of primary": function(err, r) {
      assert.isNull(err);
      assert.equal(r.lastUsedAs, 'primary');
      assert.equal(r.hasPassword, false);
    }
  },
  ".emailInfo for secondary email address": {
    topic: function() {
      db.emailInfo('lloyd@somewhe.re', this.callback);
    },
    "returns a lastUsedAs of secondary": function(err, r) {
      assert.isNull(err);
      assert(!!r);
      assert.equal(r.lastUsedAs, 'secondary');
      assert.equal(r.hasPassword, true);
    }
  },
  ".emailInfo for unknown email address": {
    topic: function() {
      db.emailInfo('unknown_email@example.domain', this.callback);
    },
    "returns no error and null": function(err, r) {
      assert.isNull(err);
      assert.isNull(r);
    }
  }
});

suite.addBatch({
  "canceling an account": {
    topic: function() {
      var cb = this.callback;
      db.emailToUID("lloyd@somewhe.re", function(err, uid) {
        db.cancelAccount(uid, cb);
      });
    },
    "returns no error": function(err) {
      assert.isNull(err);
    },
    "causes emailKnown": {
      topic: function() {
        db.emailKnown('lloyd@somewhe.re', this.callback);
      },
      "to return false": function (err, r) {
        assert.isNull(err);
        assert.strictEqual(r, false);
      }
    }
  }
});

var firstSeen;
suite.addBatch({
  "checking database for an IDP we don't know": {
    topic: function() {
      db.getIDPLastSeen("example.com", this.callback);
    },
    "returns null as lastSeen": function(err, lastSeen) {
      assert.isNull(err);
      assert.isNull(lastSeen);
    }
  },
  "noting that we've seen an IDP": {
    topic: function() {
      db.updateIDPLastSeen("idp.example.com", this.callback);
    },
    "works": function(err) {
        assert.isNull(err);
    },
    "and then checking if that IDP is known": {
      topic: function() {
        db.getIDPLastSeen("idp.example.com", this.callback);
      },
      "returns a recent date object": function(err, lastSeen) {
        assert.isNull(err);
        var delta = new Date() - lastSeen;
        assert(delta < 1000, "idp was not seen in the last second (" + delta + "ms ago)");
        firstSeen = lastSeen;
      },
      "and updating again after a second": {
        topic: function() {
          var cb = this.callback;
          setTimeout(function() {
            db.updateIDPLastSeen("idp.example.com", cb);
          }, 1000);
        },
        "works": function(err) {
          assert.isNull(err);
        },
        "and then checking if that IDP is known": {
          topic: function() {
            db.getIDPLastSeen("idp.example.com", this.callback);
          },
          "returns an updated date object": function(err, lastSeen) {
            assert.isNull(err);
            assert.notEqual(lastSeen.getTime(), firstSeen.getTime());
          },
          "but deleting": {
            topic: function() {
              db.forgetIDP("idp.example.com", this.callback);
            },
            "works": function(err) {
              assert.isNull(err);
            },
            "and then checking if that IDP is known": {
              topic: function() {
                db.getIDPLastSeen("idp.example.com", this.callback);
              },
              "returns zero": function(err, lastSeen) {
                assert.isNull(err);
                assert.strictEqual(lastSeen, null);
              }
            }
          }
        }
      }
    }
  }
});

suite.addBatch({
  "adding a user": {
    topic: function() {
      db.getIDPLastSeen("example.com", this.callback);
    },
    "returns null as lastSeen": function(err, lastSeen) {
      assert.isNull(err);
      assert.isNull(lastSeen);
    }
  },
  "noting that we've seen an IDP": {
    topic: function() {
      db.updateIDPLastSeen("idp.example.com", this.callback);
    },
    "works": function(err) {
        assert.isNull(err);
    },
    "and then checking if that IDP is known": {
      topic: function() {
        db.getIDPLastSeen("idp.example.com", this.callback);
      },
      "returns a recent date object": function(err, lastSeen) {
        assert.isNull(err);
        var delta = new Date() - lastSeen;
        assert(delta < 1000, "idp was not seen in the last second (" + delta + "ms ago)");
        firstSeen = lastSeen;
      },
      "and updating again after a second": {
        topic: function() {
          var cb = this.callback;
          setTimeout(function() {
            db.updateIDPLastSeen("idp.example.com", cb);
          }, 1000);
        },
        "works": function(err) {
          assert.isNull(err);
        },
        "and then checking if that IDP is known": {
          topic: function() {
            db.getIDPLastSeen("idp.example.com", this.callback);
          },
          "returns an updated date object": function(err, lastSeen) {
            assert.isNull(err);
            assert.notEqual(lastSeen.getTime(), firstSeen.getTime());
          },
          "but deleting": {
            topic: function() {
              db.forgetIDP("idp.example.com", this.callback);
            },
            "works": function(err) {
              assert.isNull(err);
            },
            "and then checking if that IDP is known": {
              topic: function() {
                db.getIDPLastSeen("idp.example.com", this.callback);
              },
              "returns zero": function(err, lastSeen) {
                assert.isNull(err);
                assert.strictEqual(lastSeen, null);
              }
            }
          }
        }
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
      assert.isNull(err);
    },
    "re-opening the database": {
      topic: function() {
        db.open(dbCfg, this.callback);
      },
      "works": function(err) {
        assert.isNull(err);
      },
      "and then purging": {
        topic: function() {
          db.closeAndRemove(this.callback);
        },
        "works": function(r) {
          assert.isNull(r);
        }
      }
    }
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
