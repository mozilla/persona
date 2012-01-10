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

const assert =
require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
config = require('../lib/configuration.js'),
http = require('http');
secrets = require('../lib/secrets.js');

var suite = vows.describe('post-limiting');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

// test posting more than 10kb
suite.addBatch({
  "posting more than 10kb": {
    topic: function(assertion)  {
      var cb = this.callback;
      var req = http.request({
        host: '127.0.0.1',
        port: 10002,
        path: '/wsapi/authenticate_user',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        method: "POST"
      }, function (res) {
        cb(null, res);
      }).on('error', function (e) {
        cb(e);
      });
      req.write(secrets.weakGenerate(1024 * 10 + 1));
      req.end();
    },
    "fails": function (err, r) {
      assert.ok(/socket hang up/.test(err.toString()));
    }
  }
});

// test posting more than 10kb with content-length header
suite.addBatch({
  "posting more than 10kb with content-length": {
    topic: function(assertion)  {
      var cb = this.callback;
      var req = http.request({
        host: '127.0.0.1',
        port: 10002,
        path: '/wsapi/authenticate_user',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': 1024 * 10 + 1
        },
        method: "POST"
      }, function (res) {
        cb(null, res);
      }).on('error', function (e) {
        cb(e);
      });
      req.write(secrets.weakGenerate(1024 * 10 + 1));
      req.end();
    },
    "fails": function (err, r) {
      assert.strictEqual(413, r.statusCode);
    }
  }
});


start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
