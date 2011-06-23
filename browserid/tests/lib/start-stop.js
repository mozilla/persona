const assert = require('assert'),
      fs = require('fs'),
      path = require('path'),
      wsapi = require('./wsapi.js');

const varPath = path.join(path.dirname(path.dirname(__dirname)), "var");

function removeVarDir() {
  try {
    fs.readdirSync(varPath).forEach(function(f) {
        fs.unlinkSync(path.join(varPath, f));
    });
    fs.rmdirSync(varPath);
  } catch(e) {}
}

exports.addStartupBatches = function(suite) {
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
        const server = require("../../run.js");
        server.runServer();
        return true;
      },
      "server should be running": {
        topic: wsapi.get('/ping.txt'),
        "server is running": function (r, err) {
          assert.equal(r.code, 200);
        }
      }
    }
  });

  suite.addBatch({
    "wait for readiness": {
      topic: function() {
        var cb = this.callback;
        require("../../lib/db.js").onReady(function() { cb(true) });
      },
      "readiness has arrived": function(v) {
        assert.ok(v);
      }
    }
  });
};

exports.addShutdownBatches = function(suite) {
  // stop the server
  suite.addBatch({
    "stop the server": {
      topic: function() {
        const server = require("../../run.js");
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
}