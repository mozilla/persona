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
        topic: wsapi.get('/__heartbeat__'),
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

  // stop the database
  suite.addBatch({
    "stop the database": {
      topic: function() {
        require("../../lib/db.js").close(this.callback);
      },
      "stopped": function(x) {
        assert.isUndefined(x);
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