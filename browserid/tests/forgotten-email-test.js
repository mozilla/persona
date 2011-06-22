#!/usr/bin/env node

const assert = require('assert'),
      vows = require('vows'),
      fs = require('fs'),
      path = require('path'),
      http = require('http');

const amMain = (process.argv[1] === __filename);
const varPath = path.join(path.dirname(__dirname), "var");

var suite = vows.describe('forgotten-email');

function removeVarDir() {
  try {
    fs.readdirSync(varPath).forEach(function(f) {
        fs.unlinkSync(path.join(varPath, f));
    });
    fs.rmdirSync(varPath);
  } catch(e) {}
}

suite.addBatch({
  "remove the user database": {
    topic: function() {
      removeVarDir();
      fs.mkdirSync(varPath, 0755);
      return true;
    },
    "directory should exist": function(x) {
      assert.ok(fs.statSync(varPath).isDirectory());
    }
  }
});

suite.addBatch({
  "run the server": {
    topic: function() {
      const server = require("../run.js");
      server.runServer();
      return true;
    },
    "server should be running": {
      topic: function() {
        var cb = this.callback;
        http.get({
          host: '127.0.0.1',
          port: '62700',
          path: '/ping.txt'
        }, function(res) {
          cb(true);
        }).on('error', function (e) {
          cb(false);
        });
      },
      "server is running": function (r) {
        assert.notStrictEqual(r, false);
      }
    }
  }
});


suite.addBatch({
  "wait for readiness": {
    topic: function() {
      var cb = this.callback;
      require("../lib/db.js").onReady(function() { cb(true) });
    },
    "readiness has arrived": function(v) {
      assert.ok(v);
    }
  }
});




// create a new account via the api with (first address)

// manually verify the account

// add a new email address to the account (second address)

// run the "forgot_email" flow with first address

// try to log into the first email address with oldpassword

// try to log into the second email address with oldpassword

// try to log into the first email with newpassword

// stop the server
suite.addBatch({
  "stop the server": {
    topic: function() {
      const server = require("../run.js");
      var cb = this.callback;
      server.stopServer(function() { cb(true); });
    },
    "stopped": function(x) {
      assert.strictEqual(x, true);
    }
  }
});


// clean up
suite.addBatch({
  "clean up": {
    topic: function() {
      removeVarDir();
      return true;
    },
    "directory should not exist": function(x) {
      assert.throws(function(){ fs.statSync(varPath) });
    }
  }
});

suite.run();
