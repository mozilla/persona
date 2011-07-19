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

// XXX: add exhaustive tests of the db API here

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
